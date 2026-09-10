import "server-only";
import { SCHEDULE, WEEKDAY_ORDER } from "@/lib/constants";
import { isSlotTakenError, sql } from "@/lib/db";

export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: number;
  ref: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  status: BookingStatus;
  depositPaid: boolean;
  createdAt: string;
}

interface Row {
  id: number;
  ref: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  client_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  status: BookingStatus;
  deposit_paid: boolean;
  created_at: string;
}

const toBooking = (r: Row): Booking => ({
  id: r.id,
  ref: r.ref,
  serviceId: r.service_id,
  startsAt: new Date(r.starts_at).toISOString(),
  endsAt: new Date(r.ends_at).toISOString(),
  clientName: r.client_name,
  phone: r.phone,
  email: r.email,
  notes: r.notes,
  status: r.status,
  depositPaid: r.deposit_paid,
  createdAt: new Date(r.created_at).toISOString(),
});

/**
 * A pending booking holds its slot, so nobody else can take it while she
 * decides. If she never decides, the hold would block that slot forever —
 * so it stops counting after this long and the slot quietly returns.
 */
export const PENDING_HOLD_HOURS = 24;

/* ------------------------------------------------------------------ hours */

export interface DayHours {
  opens: string;
  closes: string;
}

/** The owner's weekly hours, keyed by weekday name. Null means closed. */
export async function weeklyHours(): Promise<Record<string, DayHours | null>> {
  const rows = (await sql()`
    SELECT weekday, opens, closes FROM opening_hours
  `) as { weekday: number; opens: string | null; closes: string | null }[];

  const week: Record<string, DayHours | null> = {};
  WEEKDAY_ORDER.forEach((day, index) => {
    const row = rows.find((r) => r.weekday === index);
    week[day] = row?.opens && row.closes ? { opens: row.opens, closes: row.closes } : null;
  });
  return week;
}

export async function setWeeklyHours(
  hours: { weekday: number; opens: string | null; closes: string | null }[]
): Promise<void> {
  for (const h of hours) {
    await sql()`
      INSERT INTO opening_hours (weekday, opens, closes)
      VALUES (${h.weekday}, ${h.opens}, ${h.closes})
      ON CONFLICT (weekday) DO UPDATE SET opens = EXCLUDED.opens, closes = EXCLUDED.closes`;
  }
}

export interface DateOverride {
  date: string;
  opens: string | null;
  closes: string | null;
  note: string | null;
}

/** One-off closures and special hours, from today onwards. */
export async function dateOverrides(): Promise<DateOverride[]> {
  const rows = (await sql()`
    SELECT to_char(on_date, 'YYYY-MM-DD') AS date, opens, closes, note
    FROM date_overrides
    WHERE on_date >= CURRENT_DATE
    ORDER BY on_date`) as DateOverride[];
  return rows;
}

export async function setDateOverride(o: DateOverride): Promise<void> {
  await sql()`
    INSERT INTO date_overrides (on_date, opens, closes, note)
    VALUES (${o.date}, ${o.opens}, ${o.closes}, ${o.note})
    ON CONFLICT (on_date) DO UPDATE
      SET opens = EXCLUDED.opens, closes = EXCLUDED.closes, note = EXCLUDED.note`;
}

export async function clearDateOverride(date: string): Promise<void> {
  await sql()`DELETE FROM date_overrides WHERE on_date = ${date}`;
}

/* --------------------------------------------------------------- bookings */

/** Live bookings overlapping a day — what makes a slot unavailable. */
export async function busyOn(dayStartIso: string, dayEndIso: string): Promise<Booking[]> {
  const rows = (await sql()`
    SELECT * FROM bookings
    WHERE starts_at < ${dayEndIso} AND ends_at > ${dayStartIso}
      AND (
        status = 'confirmed'
        OR (status = 'pending'
            AND created_at > now() - (${PENDING_HOLD_HOURS} || ' hours')::interval)
      )
    ORDER BY starts_at`) as Row[];
  return rows.map(toBooking);
}

/** Everything still to come, for the admin schedule view. */
export async function upcoming(days: number): Promise<Booking[]> {
  const rows = (await sql()`
    SELECT * FROM bookings
    WHERE ends_at > now()
      AND starts_at < now() + (${days} || ' days')::interval
      AND status <> 'declined'
    ORDER BY starts_at`) as Row[];
  return rows.map(toBooking);
}

/** Requests still waiting on her, newest first. */
export async function pendingRequests(): Promise<Booking[]> {
  const rows = (await sql()`
    SELECT * FROM bookings
    WHERE status = 'pending' AND ends_at > now()
    ORDER BY created_at DESC`) as Row[];
  return rows.map(toBooking);
}

export async function confirmedFrom(sinceIso: string): Promise<Booking[]> {
  const rows = (await sql()`
    SELECT * FROM bookings
    WHERE status = 'confirmed' AND ends_at > ${sinceIso}
    ORDER BY starts_at`) as Row[];
  return rows.map(toBooking);
}

/** Short, unambiguous, and safe to read aloud over a bad phone line. */
function makeRef(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY3479"; // no O/0, I/1, S/5, B/8
  let ref = "";
  for (let i = 0; i < 5; i++) {
    ref += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `GL-${ref}`;
}

export type CreateResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "taken" };

export async function createPending(input: {
  serviceId: string;
  startIso: string;
  endIso: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  depositPaid?: boolean;
}): Promise<CreateResult> {
  try {
    const rows = (await sql()`
      INSERT INTO bookings
        (ref, service_id, starts_at, ends_at, client_name, phone, email, notes, deposit_paid)
      VALUES
        (${makeRef()}, ${input.serviceId}, ${input.startIso}, ${input.endIso},
         ${input.name}, ${input.phone}, ${input.email}, ${input.notes},
         ${input.depositPaid ?? false})
      RETURNING *`) as Row[];
    return { ok: true, booking: toBooking(rows[0]) };
  } catch (error) {
    // The unique index fired: somebody else took this slot microseconds ago.
    if (isSlotTakenError(error)) return { ok: false, reason: "taken" };
    throw error;
  }
}

export async function setStatus(id: number, status: BookingStatus): Promise<Booking | null> {
  const rows = (await sql()`
    UPDATE bookings SET status = ${status}, decided_at = now()
    WHERE id = ${id}
    RETURNING *`) as Row[];
  return rows[0] ? toBooking(rows[0]) : null;
}

export async function findByRef(ref: string): Promise<Booking | null> {
  const rows = (await sql()`SELECT * FROM bookings WHERE ref = ${ref}`) as Row[];
  return rows[0] ? toBooking(rows[0]) : null;
}

export async function markDepositPaid(ref: string): Promise<void> {
  await sql()`UPDATE bookings SET deposit_paid = TRUE WHERE ref = ${ref}`;
}

/* ----------------------------------------------------------- fallbacks */

/**
 * The hours to use before the database has any. Keeps /services and /about
 * readable on a fresh deploy instead of showing a blank week.
 */
export function fallbackHours(): Record<string, DayHours | null> {
  const week: Record<string, DayHours | null> = {};
  for (const day of WEEKDAY_ORDER) {
    const h = SCHEDULE.openingHours[day];
    week[day] = h ? { opens: h.open, closes: h.close } : null;
  }
  return week;
}
