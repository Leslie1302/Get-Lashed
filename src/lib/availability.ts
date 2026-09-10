import "server-only";
import { SCHEDULE, SERVICES, type Service } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import { busyOn, dateOverrides, weeklyHours } from "@/lib/bookings";
import {
  bookableWindow,
  dayStartMs,
  freeSlots,
  toHHMM,
  type BookingRules,
  type Slot as CoreSlot,
  type SlotConfig,
  type UnavailableReason,
} from "@/lib/availability-core";

export { dayStartMs };
export type { UnavailableReason };
export type Slot = CoreSlot;

/** The studio's rules, handed to the pure maths in availability-core. */
const RULES: BookingRules = {
  slotIntervalMins: SCHEDULE.slotIntervalMins,
  minLeadTimeHours: SCHEDULE.minLeadTimeHours,
  maxAdvanceDays: SCHEDULE.maxAdvanceDays,
};

export function todayInAccra(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getService(serviceId: string): Service | undefined {
  return SERVICES.find((s) => s.id === serviceId);
}

/** YYYY-MM-DD, and a real calendar date — not 2026-02-31. */
export function isValidDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(`${date}T00:00:00Z`).toISOString().startsWith(date)
  );
}

export function buildConfig(
  window: { openMinutes: number; closeMinutes: number },
  service: Service,
  busyMinutes: SlotConfig["busy"]
): SlotConfig {
  return {
    ...window,
    slotMinutes: SCHEDULE.slotIntervalMins,
    durationMinutes: service.durationMins,
    bufferMinutes: SCHEDULE.bufferMins,
    busy: busyMinutes,
  };
}

/** Free slots for a date and service, checked against her live schedule. */
export async function availableSlots(
  date: string,
  service: Service,
  nowMs = Date.now()
): Promise<{ slots: Slot[]; reason: UnavailableReason | "full" | null }> {
  const [hours, overrides] = await Promise.all([weeklyHours(), dateOverrides()]);
  const override = overrides.find((o) => o.date === date);

  const window = bookableWindow(date, nowMs, hours, RULES, override);
  if ("unavailable" in window) return { slots: [], reason: window.unavailable };

  const start = dayStartMs(date);
  const bookings = await busyOn(
    new Date(start).toISOString(),
    new Date(start + 86_400_000).toISOString()
  );
  const busy = bookings.map((b) => ({
    start: (Date.parse(b.startsAt) - start) / 60_000,
    end: (Date.parse(b.endsAt) - start) / 60_000,
  }));

  const slots = freeSlots(buildConfig(window, service, busy)).map((minutes) => ({
    time: toHHMM(minutes),
    label: formatHours(toHHMM(minutes)),
    startIso: new Date(start + minutes * 60_000).toISOString(),
    endIso: new Date(start + (minutes + service.durationMins) * 60_000).toISOString(),
  }));

  return { slots, reason: slots.length ? null : "full" };
}

/**
 * Re-derive one slot server-side and confirm it is still free. The client's
 * earlier availability check is advisory only — duration and end time are
 * always computed here from the service id, never taken from the request.
 */
export async function verifySlot(
  date: string,
  time: string,
  service: Service,
  nowMs = Date.now()
): Promise<Slot | null> {
  const { slots } = await availableSlots(date, service, nowMs);
  return slots.find((s) => s.time === time) ?? null;
}
