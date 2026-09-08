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

console.log("availability: all checks passed");
