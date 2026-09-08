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
