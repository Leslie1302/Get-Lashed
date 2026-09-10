// Pure slot maths. No imports, no Date, no env — so scripts/check-availability.mjs
// can exercise it with plain Node and so the server can re-derive every slot it
// is asked to book.

export interface Interval {
  start: number;
  end: number;
}

export interface SlotConfig {
  /** Minutes from midnight the first slot may start. */
  openMinutes: number;
  /** Minutes from midnight by which the service must have finished. */
  closeMinutes: number;
  slotMinutes: number;
  durationMinutes: number;
  bufferMinutes: number;
  /** Existing appointments, in minutes from the same midnight. */
  busy: Interval[];
}

/** Candidate starts on the slot grid, anchored to `openMinutes`. */
export function slotStarts(cfg: SlotConfig): number[] {
  const starts: number[] = [];
  const last = cfg.closeMinutes - cfg.durationMinutes;
  for (let s = cfg.openMinutes; s <= last; s += cfg.slotMinutes) starts.push(s);
  return starts;
}

/**
 * Free when no existing appointment overlaps the slot, with the buffer applied
 * on BOTH sides: the technician needs cleanup time after the previous client as
 * much as before the next one.
 */
export function isFree(start: number, cfg: SlotConfig): boolean {
  const end = start + cfg.durationMinutes;
  return !cfg.busy.some(
    (b) => start < b.end + cfg.bufferMinutes && b.start - cfg.bufferMinutes < end
  );
}

export function freeSlots(cfg: SlotConfig): number[] {
  return slotStarts(cfg).filter((s) => isFree(s, cfg));
}

/** "09:30" -> 570 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 570 -> "09:30" */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Round up to the next grid step at or after `minutes`. */
export function alignUp(minutes: number, anchor: number, step: number): number {
  if (minutes <= anchor) return anchor;
  return anchor + Math.ceil((minutes - anchor) / step) * step;
}

/** Day names, Monday first — the order Ghanaian opening hours are written in. */
export const WEEKDAY_ORDER = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
] as const;

export interface DayHours {
  opens: string;
  closes: string;
}

/** The studio's booking rules, passed in so this file stays pure. */
export interface BookingRules {
  slotIntervalMins: number;
  minLeadTimeHours: number;
  maxAdvanceDays: number;
}

/** Midnight of a date, in ms. Accra is UTC+0, so this is exact. */
export function dayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export type UnavailableReason = "past" | "too-far" | "closed" | "too-late";

export interface Slot {
  time: string;
  label: string;
  startIso: string;
  endIso: string;
}

/**
 * The bookable window for a date: her weekly hours, overridden by any one-off
 * entry for that exact date, then trimmed by the minimum notice.
 *
 * The schedule and the clock are passed in rather than fetched, so the maths
 * stays pure and the self-check can pin both.
 */
export function bookableWindow(
  date: string,
  nowMs: number,
  hours: Record<string, DayHours | null>,
  rules: BookingRules,
  override?: { opens: string | null; closes: string | null }
): { openMinutes: number; closeMinutes: number } | { unavailable: UnavailableReason } {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  if (date < today) return { unavailable: "past" };
  if (dayStartMs(date) - dayStartMs(today) > rules.maxAdvanceDays * 86_400_000) {
    return { unavailable: "too-far" };
  }

  // An override wins outright — it is how she closes for a holiday or opens
  // late on one particular day. A row with no hours means closed.
  let day: DayHours | null;
  if (override) {
    day =
      override.opens && override.closes
        ? { opens: override.opens, closes: override.closes }
        : null;
  } else {
    const weekday = WEEKDAY_ORDER[(new Date(dayStartMs(date)).getUTCDay() + 6) % 7];
    day = hours[weekday] ?? null;
  }
  if (!day) return { unavailable: "closed" };

  const openMinutes = toMinutes(day.opens);
  const closeMinutes = toMinutes(day.closes);

  // Minimum notice, measured from now. With a day's notice this can bite into
  // tomorrow as well as today, so it is applied to every date rather than only
  // the current one.
  const earliest =
    Math.ceil((nowMs - dayStartMs(date)) / 60_000) + rules.minLeadTimeHours * 60;
  if (earliest >= closeMinutes) return { unavailable: "too-late" };

  return {
    openMinutes: alignUp(
      Math.max(openMinutes, earliest),
      openMinutes,
      rules.slotIntervalMins
    ),
    closeMinutes,
  };
}

