import "server-only";
import { SCHEDULE, SERVICES, WEEKDAY_ORDER, type Service } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import { getBusy } from "@/lib/google-calendar";
import {
  alignUp,
  freeSlots,
  toHHMM,
  toMinutes,
  type SlotConfig,
} from "@/lib/availability-core";

// ponytail: Accra is UTC+0 with no DST, so a "YYYY-MM-DDTHH:MM:00Z" string is
// both the wall clock and the instant. Every Calendar call still sends
// timeZone: "Africa/Accra" explicitly — this shortcut is local to the maths.
// Add a real tz conversion here if the studio ever opens outside Ghana.
export function dayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function todayInAccra(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getService(serviceId: string): Service | undefined {
  return SERVICES.find((s) => s.id === serviceId);
}

/** YYYY-MM-DD, and a real calendar date — not 2026-02-31. */
export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
}

export type UnavailableReason = "past" | "too-far" | "blackout" | "closed" | "too-late";

export interface Slot {
  /** "HH:MM" in Accra. */
  time: string;
  label: string;
  startIso: string;
  endIso: string;
}

/**
 * The bookable window for a date, after opening hours, blackouts, the max
 * advance limit and (for today) the minimum lead time. Pure apart from `now`,
 * which is injected so the self-check can pin it.
 */
export function bookableWindow(
  date: string,
  nowMs: number
): { openMinutes: number; closeMinutes: number } | { unavailable: UnavailableReason } {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (date < today) return { unavailable: "past" };
  if (dayStartMs(date) - dayStartMs(today) > SCHEDULE.maxAdvanceDays * 86_400_000) {
    return { unavailable: "too-far" };
  }
  if ((SCHEDULE.blackoutDates as readonly string[]).includes(date)) {
    return { unavailable: "blackout" };
  }

  const weekday = WEEKDAY_ORDER[(new Date(dayStartMs(date)).getUTCDay() + 6) % 7];
  const hours = SCHEDULE.openingHours[weekday];
  if (!hours) return { unavailable: "closed" };

  const openMinutes = toMinutes(hours.open);
  const closeMinutes = toMinutes(hours.close);
  if (date !== today) return { openMinutes, closeMinutes };

  const cutoff = Math.ceil((nowMs - dayStartMs(date)) / 60_000) + SCHEDULE.minLeadTimeHours * 60;
  if (cutoff >= closeMinutes) return { unavailable: "too-late" };
  return {
    openMinutes: alignUp(cutoff, openMinutes, SCHEDULE.slotIntervalMins),
    closeMinutes,
  };
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

/** Free slots for a date and service, checked against the live calendar. */
export async function availableSlots(
  date: string,
  service: Service,
  nowMs = Date.now()
): Promise<Slot[]> {
  const window = bookableWindow(date, nowMs);
  if ("unavailable" in window) return [];

  const start = dayStartMs(date);
  const busy = (await getBusy(new Date(start).toISOString(), new Date(start + 86_400_000).toISOString())).map(
    (b) => ({ start: (b.start - start) / 60_000, end: (b.end - start) / 60_000 })
  );

  return freeSlots(buildConfig(window, service, busy)).map((minutes) => ({
    time: toHHMM(minutes),
    label: formatHours(toHHMM(minutes)),
    startIso: new Date(start + minutes * 60_000).toISOString(),
    endIso: new Date(start + (minutes + service.durationMins) * 60_000).toISOString(),
  }));
}

/**
 * Re-derive one slot server-side and confirm it is still free. The client's
 * earlier availability check is advisory only — duration and end time are
 * always computed here from the service id, never accepted from the request.
 */
export async function verifySlot(
  date: string,
  time: string,
  service: Service,
  nowMs = Date.now()
): Promise<Slot | null> {
  const slots = await availableSlots(date, service, nowMs);
  return slots.find((s) => s.time === time) ?? null;
}
