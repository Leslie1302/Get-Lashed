// Self-check for the AR maths. No camera, no browser, no network:
//   npm run check:ar
// Covers the two things that are easy to get subtly wrong and impossible to
// eyeball: the synthesised nail quad, and the adaptive smoothing filter.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  FINGERS,
  NAIL_LENGTHS,
  NAIL_SHAPES,
  nailQuad,
  smoothPoints,
  handKey,
} from "../src/lib/ar-geometry.ts";
import { NAIL_DESIGNS, LASH_DESIGNS } from "../src/lib/designs.ts";

const HEIGHT = 720;

/** A synthetic right hand, fingers pointing up the image (y decreasing). */
function hand({ spread = 40, length = 30 } = {}) {
  const points = Array.from({ length: 21 }, () => [0, 0]);
  FINGERS.forEach(([tip, dip], i) => {
    const x = 200 + i * spread;
    points[tip] = [x, 300];
    points[dip] = [x, 300 + length];
  });
  return points;
}

function near(a, b, tolerance = 1e-9) {
  return Math.abs(a - b) <= tolerance;
}

// --- nailQuad -------------------------------------------------------------

const quad = nailQuad(hand(), 1);
assert.ok(quad, "a well-formed hand yields a quad");
assert.equal(quad.length, 4);

// Opposite sides equal => parallelogram. The affine warp in TryOn assumes it;
// if this ever fails, the design will shear across the nail.
const side = (a, b) => [quad[b][0] - quad[a][0], quad[b][1] - quad[a][1]];
const [ax, ay] = side(0, 1);
const [bx, by] = side(3, 2);
assert.ok(near(ax, bx) && near(ay, by), "base->tip edges must be parallel and equal");

// The nail runs along the finger axis: this hand points straight up, so the
// long edge must be vertical and pointing towards decreasing y.
assert.ok(near(ax, 0), "long edge is parallel to the finger");
assert.ok(ay < 0, "the nail extends towards the fingertip, not the knuckle");

// Length: 0.65 of the DIP-to-tip distance for an index finger.
const lengthOf = (h, finger) => {
  const q = nailQuad(h, finger);
  return Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
};
const widthOf = (h, finger) => {
  const q = nailQuad(h, finger);
  return Math.hypot(q[0][0] - q[3][0], q[0][1] - q[3][1]);
};
assert.ok(near(lengthOf(hand(), 1), 30 * 0.65), "index nail spans 0.65 of the finger segment");

// The nail must sit ON the finger, not past it. This is the regression that
// made every nail float off the fingertip onto the background behind the hand.
const q1 = nailQuad(hand(), 1);
const tipY = 300; // fingertip y in the synthetic hand
for (const [, y] of q1) {
  assert.ok(y > tipY - 30 * 0.7, "no corner reaches back past the DIP joint");
  assert.ok(y >= tipY - 1e-9 - 30 * 0.05, "no corner sits more than a sliver past the fingertip");
}

// Width tracks the gap to the next fingertip, and is clamped relative to this
// nail's own length — so a nail can never come out wider than it is long.
// Between the clamps, width scales linearly with the apparent hand size —
// asserted as a proportion so retuning the constants doesn't break it.
const w45 = widthOf(hand({ spread: 45 }), 1);
const w55 = widthOf(hand({ spread: 55 }), 1);
assert.ok(near(w55 / w45, 55 / 45, 1e-9), "width tracks the gap to the next fingertip");

// ...but only within the tolerance band, so an odd hand pose can't produce a
// nail twice the width of the finger it sits on.
assert.ok(
  widthOf(hand({ spread: 500 }), 1) < widthOf(hand({ spread: 50 }), 1) * 1.4,
  "spacing corrects the width, it does not dictate it"
);
// --- extensions -----------------------------------------------------------
// The studio fits extensions, so length past the fingertip is a real option —
// but it must grow forward only, and must not widen the nail bed.
const natural = nailQuad(hand(), 1, 0);
const longer = nailQuad(hand(), 1, 0.7);
const naturalLen = Math.hypot(natural[1][0] - natural[0][0], natural[1][1] - natural[0][1]);
const longerLen = Math.hypot(longer[1][0] - longer[0][0], longer[1][1] - longer[0][1]);

assert.ok(near(longerLen, naturalLen * 1.7, 1e-9), "extend adds length in proportion");
assert.ok(
  near(Math.hypot(longer[0][0] - longer[3][0], longer[0][1] - longer[3][1]),
       Math.hypot(natural[0][0] - natural[3][0], natural[0][1] - natural[3][1]), 1e-9),
  "an extension is longer, not wider — the nail bed it sits on hasn't changed"
);
assert.deepEqual(longer[0], natural[0], "the cuticle end must not move when extending");
assert.deepEqual(longer[3], natural[3], "the cuticle end must not move when extending");
assert.ok(longer[1][1] < natural[1][1], "the free edge extends past the fingertip");
assert.deepEqual(nailQuad(hand(), 1, -5), natural, "a negative extension is ignored, not inverted");

for (const { id, extend } of NAIL_LENGTHS) {
  assert.ok(extend >= 0, `length "${id}" cannot be negative`);
  for (let f = 0; f < FINGERS.length; f++) {
    assert.ok(nailQuad(hand(), f, extend), `length "${id}" produces a quad for finger ${f}`);
  }
}
assert.equal(NAIL_LENGTHS[0].extend, 0, "the first length option must fit a natural nail");

// --- shapes ---------------------------------------------------------------
const shapeIds = new Set();
for (const s of NAIL_SHAPES) {
  assert.ok(s.id && s.name, "every shape needs an id and a name");
  assert.ok(!shapeIds.has(s.id), `duplicate shape id: ${s.id}`);
  shapeIds.add(s.id);
  // Taper at 1 would collapse the free edge to a single point and the nail
  // would vanish into a spike.
  assert.ok(s.taper >= 0 && s.taper < 0.9, `"${s.id}" taper must stay under 0.9`);
  assert.ok(s.tipCurve >= 0 && s.tipCurve <= 0.5, `"${s.id}" tipCurve out of range`);
  assert.ok(s.sideCurve >= 0 && s.sideCurve <= 0.3, `"${s.id}" sideCurve out of range`);
}

// Plausible width-to-length ratios per finger, at any hand spread. A thumb
// nail really is wider than it is long; the other four really are not.
const RATIO = [[0.9, 1.3], [0.7, 1.0], [0.7, 1.0], [0.7, 1.0], [0.7, 1.02]];
for (const spread of [2, 20, 40, 90, 500]) {
  for (let f = 0; f < FINGERS.length; f++) {
    const ratio = widthOf(hand({ spread }), f) / lengthOf(hand({ spread }), f);
    const [lo, hi] = RATIO[f];
    assert.ok(
      ratio >= lo && ratio <= hi,
      `finger ${f} at spread ${spread}: width/length ${ratio.toFixed(2)} outside ${lo}-${hi}`
    );
  }
}

// Per-finger proportions: a thumb nail is shorter and wider than an index, a
// little-finger nail smaller than both. Without this every nail is identical,
// which is what makes a set read as stamped on.
const h = hand({ spread: 60 });
assert.ok(lengthOf(h, 0) < lengthOf(h, 1), "thumb nail is shorter than index");
assert.ok(widthOf(h, 0) / lengthOf(h, 0) > widthOf(h, 1) / lengthOf(h, 1), "thumb nail is relatively wider");
assert.ok(lengthOf(h, 2) > lengthOf(h, 1), "middle nail is the longest");
assert.ok(lengthOf(h, 4) < lengthOf(h, 3), "little nail is shorter than ring");

// Degenerate and missing input must not produce NaN corners.
const collapsed = hand();
collapsed[FINGERS[1][1]] = [...collapsed[FINGERS[1][0]]]; // DIP on top of the tip
assert.equal(nailQuad(collapsed, 1), null, "a zero-length finger yields no quad");

const missing = hand();
missing[FINGERS[2][0]] = undefined;
assert.equal(nailQuad(missing, 2), null, "a missing landmark yields no quad");
assert.equal(nailQuad(hand(), 99), null, "an unknown finger yields no quad");

for (let f = 0; f < FINGERS.length; f++) {
  for (const [x, y] of nailQuad(hand(), f)) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `finger ${f} corner is finite`);
  }
}

// --- smoothPoints ---------------------------------------------------------

const at = (x, y) => [[x, y]];

// No history, or a changed point count, passes straight through.
assert.deepEqual(smoothPoints(undefined, at(5, 5), HEIGHT), at(5, 5));
assert.deepEqual(smoothPoints([], at(5, 5), HEIGHT), at(5, 5));

// Output always lies between the previous and the new position — never past it.
const stepped = smoothPoints(at(0, 0), at(100, 0), HEIGHT)[0];
assert.ok(stepped[0] > 0 && stepped[0] < 100, "smoothed point stays between old and new");

// A motionless point is smoothed hard, which is what kills the shimmer.
const still = smoothPoints(at(10, 10), at(10.4, 10), HEIGHT)[0];
assert.ok(Math.abs(still[0] - 10) < 0.1, "sub-pixel jitter is mostly rejected");

// The whole point of the adaptive filter: how much of the new position is
// taken depends on how fast the hand is actually moving. Pixel deltas below
// are per frame at 720p. These pin the tuning — if a future edit makes the
// overlay shimmery or laggy, one of them fails.
const gainAt = (dx) => smoothPoints(at(0, 0), at(dx, 0), HEIGHT)[0][0] / dx;

const jitter = gainAt(0.5); // landmark noise on a hand held still
const deliberate = gainAt(5); // slow, controlled movement
const fast = gainAt(200); // a quick wave

assert.ok(
  fast > deliberate && deliberate > jitter,
  "smoothing must back off monotonically as the hand speeds up"
);
assert.ok(jitter < 0.25, "sensor jitter is mostly rejected, or the fill shimmers");
assert.ok(deliberate > 0.3 && deliberate < 0.8, "slow movement is tracked but damped");
assert.ok(fast > 0.9, "a fast hand is followed closely, or the overlay drags behind it");

// Repeated identical input converges on that input rather than drifting.
let converging = at(0, 0);
for (let i = 0; i < 200; i++) converging = smoothPoints(converging, at(50, 50), HEIGHT);
assert.ok(
  Math.abs(converging[0][0] - 50) < 0.5 && Math.abs(converging[0][1] - 50) < 0.5,
  "the filter settles on a held position instead of creeping"
);

// Resolution independence: the same real-world motion smooths the same way.
const smallFrame = smoothPoints(at(0, 0), at(36, 0), 360)[0][0] / 36;
const largeFrame = smoothPoints(at(0, 0), at(72, 0), 720)[0][0] / 72;
assert.ok(Math.abs(smallFrame - largeFrame) < 1e-9, "behaviour must not change with resolution");

// --- handKey --------------------------------------------------------------

assert.equal(handKey("Left", 0), handKey("Left", 1), "one hand keeps its filter when its index moves");
assert.notEqual(handKey("Left", 0), handKey("Right", 0), "two hands never share a filter");
assert.equal(handKey(undefined, 1), "idx:1", "missing handedness falls back to the index");
assert.equal(handKey("", 1), "idx:1", "an empty label falls back to the index");

// --- designs --------------------------------------------------------------
// A design whose file is missing paints nothing at all, and an invisible nail
// looks identical to the tracking having failed. Catch it here instead.

const ids = new Set();
for (const d of NAIL_DESIGNS) {
  assert.ok(d.id && d.name, "every nail design needs an id and a name");
  assert.ok(!ids.has(d.id), `duplicate nail design id: ${d.id}`);
  ids.add(d.id);
  assert.ok(d.color || d.image, `"${d.id}" has neither a colour nor an image`);

  if (d.image) {
    assert.ok(d.image.startsWith("/designs/"), `"${d.id}" image must live in /public/designs`);
    assert.ok(
      existsSync(new URL(`../public${d.image}`, import.meta.url)),
      `"${d.id}" points at a missing file: public${d.image}`
    );
  }
  if (d.color) assert.match(d.color, /^#[0-9a-f]{6}$/i, `"${d.id}" colour must be a 6-digit hex`);
  if (d.tip) assert.match(d.tip, /^#[0-9a-f]{6}$/i, `"${d.id}" tip colour must be a 6-digit hex`);
}

const lashIds = new Set();
for (const d of LASH_DESIGNS) {
  assert.ok(!lashIds.has(d.id), `duplicate lash design id: ${d.id}`);
  lashIds.add(d.id);
  assert.match(d.color, /^#[0-9a-f]{6}$/i, `"${d.id}" colour must be a 6-digit hex`);
  // Multiplies lash length in the overlay. Outside this range it either
  // renders shorter than the real lash line or runs off the eyelid.
  assert.ok(
    typeof d.flair === "number" && d.flair >= 1 && d.flair <= 3.5,
    `"${d.id}" flair must be a number between 1 and 3.5`
  );
}

console.log(
  `ar: all checks passed (${NAIL_DESIGNS.length} nail designs, ${LASH_DESIGNS.length} lash styles)`
);
