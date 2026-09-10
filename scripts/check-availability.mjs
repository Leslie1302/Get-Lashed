// Self-check for the slot maths. Plain Node, no test framework:
//   npm run check:availability
// availability-core.ts is dependency-free, so Node's own type stripping runs it
// directly (Node >= 22.6). Nothing here touches the network or the calendar.
import assert from "node:assert/strict";
import {
  slotStarts,
  isFree,
  freeSlots,
  toMinutes,
  toHHMM,
  alignUp,
  bookableWindow,
} from "../src/lib/availability-core.ts";

const base = {
  openMinutes: toMinutes("09:00"),
  closeMinutes: toMinutes("18:00"),
  slotMinutes: 60,
  durationMinutes: 75,
  bufferMinutes: 15,
  busy: [],
};

// Grid: 09:00 up to the last start that still finishes by 18:00.
assert.deepEqual(slotStarts(base).map(toHHMM), [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00",
]);

// An empty day is entirely free.
assert.equal(freeSlots(base).length, 8);

// An appointment 11:00-12:15 blocks the slots it overlaps...
const busy = [{ start: toMinutes("11:00"), end: toMinutes("12:15") }];
const free = freeSlots({ ...base, busy }).map(toHHMM);
assert.ok(!free.includes("11:00"), "the overlapping slot must be gone");
assert.ok(!free.includes("12:00"), "a slot starting inside the appointment must be gone");

// ...and the buffer applies on BOTH sides, not just after the new booking.
assert.ok(!free.includes("10:00"), "10:00-11:15 would run into the 11:00 appointment");
const short = freeSlots({ ...base, durationMinutes: 45, busy }).map(toHHMM);
assert.ok(!short.includes("12:00"), "12:00 is 0 min after an appointment ending 12:15");
assert.ok(short.includes("13:00"), "13:00 clears the 12:15 end plus a 15 min buffer");

// Back-to-back with exactly the buffer between is allowed.
assert.ok(
  isFree(toMinutes("09:00"), {
    ...base,
    durationMinutes: 60,
    busy: [{ start: toMinutes("10:15"), end: toMinutes("11:00") }],
  }),
  "09:00-10:00, 15 min buffer, then 10:15 is legal"
);

// A service longer than the day yields nothing rather than an off-grid slot.
assert.deepEqual(freeSlots({ ...base, durationMinutes: 600 }), []);

// Lead-time cutoffs land back on the grid.
assert.equal(toHHMM(alignUp(toMinutes("11:20"), toMinutes("09:00"), 60)), "12:00");
assert.equal(toHHMM(alignUp(toMinutes("08:00"), toMinutes("09:00"), 60)), "09:00");
assert.equal(toHHMM(alignUp(toMinutes("13:00"), toMinutes("09:00"), 60)), "13:00");



// --- bookableWindow: her schedule, overrides and notice -------------------
// This is what decides whether a client can book at all, so it is worth
// pinning. `now` is injected, so these never depend on when they are run.

const RULES = { slotIntervalMins: 60, minLeadTimeHours: 24, maxAdvanceDays: 30 };
const WEEK = {
  monday: { opens: "09:00", closes: "18:00" },
  tuesday: { opens: "09:00", closes: "18:00" },
  wednesday: { opens: "09:00", closes: "18:00" },
  thursday: { opens: "09:00", closes: "18:00" },
  friday: { opens: "09:00", closes: "20:00" },
  saturday: { opens: "09:00", closes: "20:00" },
  sunday: null,
};
// Monday 2026-09-14, 08:00.
const MON_8AM = Date.parse("2026-09-14T08:00:00Z");
const win = (date, now = MON_8AM, hours = WEEK, override) =>
  bookableWindow(date, now, hours, RULES, override);

assert.equal(win("2026-09-13").unavailable, "past", "yesterday is not bookable");
assert.equal(win("2026-09-20").unavailable, "closed", "Sunday is closed");
assert.equal(win("2026-10-30").unavailable, "too-far", "beyond the advance limit");

// A day's notice: booking today is too late, tomorrow opens after the cut-off.
assert.equal(win("2026-09-14").unavailable, "too-late", "same day needs more notice");
const tue = win("2026-09-15");
assert.equal(tue.openMinutes, toMinutes("09:00"), "24h from 08:00 Mon clears all of Tuesday");
assert.equal(tue.closeMinutes, toMinutes("18:00"));

// Booking late in the evening pushes the notice cut-off into the day after.
const lateWin = win("2026-09-15", Date.parse("2026-09-14T14:30:00Z"));
assert.equal(lateWin.openMinutes, toMinutes("15:00"), "cut-off rounds up onto the slot grid");

// An override closes a day that would otherwise be open...
assert.equal(
  win("2026-09-16", MON_8AM, WEEK, { opens: null, closes: null }).unavailable,
  "closed",
  "a closure override beats the weekly hours"
);
// ...and opens one that would otherwise be shut.
const openSunday = win("2026-09-20", MON_8AM, WEEK, { opens: "11:00", closes: "16:00" });
assert.equal(openSunday.openMinutes, toMinutes("11:00"), "an override can open a closed day");
assert.equal(openSunday.closeMinutes, toMinutes("16:00"));

// Changing her hours changes what is bookable, with no code change.
const shortWeek = { ...WEEK, tuesday: { opens: "13:00", closes: "17:00" } };
const shortDay = win("2026-09-15", MON_8AM, shortWeek);
assert.equal(shortDay.openMinutes, toMinutes("13:00"), "her saved hours drive availability");
assert.equal(shortDay.closeMinutes, toMinutes("17:00"));

// A day whose closing time is inside the notice window yields nothing at all.
assert.equal(
  win("2026-09-15", Date.parse("2026-09-14T23:00:00Z")).unavailable,
  "too-late",
  "no slots left once the notice period eats the day"
);

console.log("availability: all checks passed");
