// Pure AR maths — no canvas, no DOM, no MediaPipe. Kept separate so the part
// that is easy to get subtly wrong can be checked without a camera:
//   npm run check:ar

export type Point = [number, number];

/** [fingertip, DIP joint] per finger. MediaPipe gives 21 hand landmarks and
 * none of them are nail-bed corners, so the nail is synthesised from these. */
export const FINGERS: readonly (readonly [number, number])[] = [
  [4, 3],
  [8, 7],
  [12, 11],
  [16, 15],
  [20, 19],
];

/** Adjacent fingers, used to scale nail width to the hand's apparent size. */
const NEIGHBOURS: readonly (readonly number[])[] = [[1], [0, 2], [1, 3], [2, 4], [3]];

// Where the nail sits along the DIP-joint-to-fingertip segment, as fractions
// of that distance. The nail bed covers roughly the distal two thirds of it;
// the remainder nearer the joint is knuckle, and beyond the tip is thin air.
//
// The first version placed the nail from 0.18 behind the tip to 0.32 PAST it,
// which put most of the overlay off the end of the finger and onto whatever
// was behind the hand. The natural nail must end at the fingertip; anything
// beyond it is an extension, and that is opt-in via `extend`.
const NAIL_BASE = 0.62;
const NAIL_TIP = 0.03;
const NAIL_LENGTH = NAIL_BASE + NAIL_TIP;

/**
 * Extension lengths, as a multiple of the natural nail's length added past the
 * fingertip. The studio fits extensions, so this is a real menu choice rather
 * than decoration — and it is the one place the overlay is *supposed* to leave
 * the finger, which is why it is separate from the fit above.
 */
export const NAIL_LENGTHS = [
  { id: "natural", name: "Natural", extend: 0 },
  { id: "short", name: "Short", extend: 0.35 },
  { id: "medium", name: "Medium", extend: 0.7 },
  { id: "long", name: "Long", extend: 1.15 },
] as const;

export type NailLength = (typeof NAIL_LENGTHS)[number];

/**
 * Nail shapes, as parameters for the outline drawn over the quad.
 *
 * - `taper`   how much narrower the free edge is than the nail bed (0 = square
 *             sides, 0.5 = half the width at the tip)
 * - `tipCurve` how far the free edge bows past the tip corners, as a fraction
 *             of nail length. 0 is a flat edge, higher is rounder or pointier.
 * - `sideCurve` outward bow of the sidewalls at their midpoint.
 *
 * Taper makes the outline a trapezoid rather than a parallelogram. That is
 * fine because the shape is a clip path: the texture underneath is still warped
 * across a parallelogram, and at nail size the difference is invisible.
 */
export interface NailShape {
  id: string;
  name: string;
  taper: number;
  tipCurve: number;
  sideCurve: number;
}

export const NAIL_SHAPES: readonly NailShape[] = [
  { id: "square", name: "Square", taper: 0.0, tipCurve: 0.02, sideCurve: 0.03 },
  { id: "squoval", name: "Squoval", taper: 0.06, tipCurve: 0.1, sideCurve: 0.06 },
  { id: "round", name: "Round", taper: 0.12, tipCurve: 0.22, sideCurve: 0.08 },
  { id: "almond", name: "Almond", taper: 0.42, tipCurve: 0.3, sideCurve: 0.12 },
  { id: "coffin", name: "Coffin", taper: 0.34, tipCurve: 0.03, sideCurve: 0.02 },
  { id: "stiletto", name: "Stiletto", taper: 0.72, tipCurve: 0.34, sideCurve: 0.14 },
];

/** Half-width as a fraction of the gap to the nearest adjacent fingertip. */
const NEIGHBOUR_HALF_WIDTH = 0.17;
/**
 * How far the measured finger spacing may pull the width away from the
 * anatomical target. Width/length is close to constant per finger, so the
 * nail's own length is the reliable signal; spacing only corrects for a
 * foreshortened finger, where DIP-to-tip shrinks but the nail does not.
 */
const WIDTH_TOLERANCE = 0.15;

/**
 * Per-finger proportions: [length multiplier, width ÷ length], thumb first.
 * Nails are not interchangeable — a thumb nail is shorter than an index and
 * genuinely wider than it is long, a little-finger nail smaller than both.
 * One ratio for all five is the main reason a set reads as stamped on.
 */
const FINGER_SHAPE: readonly (readonly [number, number])[] = [
  [0.82, 1.1], // thumb — wider than it is long
  [1.0, 0.86], // index
  [1.06, 0.84], // middle — the longest
  [1.0, 0.86], // ring
  [0.84, 0.88], // little
];

/**
 * The four corners of one nail, in order: base-left, tip-left, tip-right,
 * base-right. A parallelogram by construction, which is what lets the design
 * be drawn with a plain affine transform.
 *
 * `extend` adds length past the fingertip for extensions, as a multiple of the
 * natural nail length. Zero fits the natural nail exactly.
 *
 * Returns null when the finger's landmarks are missing or degenerate.
 */
export function nailQuad(
  points: readonly Point[],
  finger: number,
  extend = 0
): Point[] | null {
  const spec = FINGERS[finger];
  if (!spec) return null;
  const tip = points[spec[0]];
  const dip = points[spec[1]];
  if (!tip || !dip) return null;

  const length = Math.hypot(tip[0] - dip[0], tip[1] - dip[1]);
  if (!Number.isFinite(length) || length < 1e-6) return null;

  const ux = (tip[0] - dip[0]) / length;
  const uy = (tip[1] - dip[1]) / length;
  const px = -uy;
  const py = ux;

  let nearest = Infinity;
  for (const n of NEIGHBOURS[finger]) {
    const other = points[FINGERS[n][0]];
    if (!other) continue;
    nearest = Math.min(nearest, Math.hypot(tip[0] - other[0], tip[1] - other[1]));
  }

  const [lengthScale, widthRatio] = FINGER_SHAPE[finger];
  const naturalLength = length * NAIL_LENGTH * lengthScale;

  // Anatomical width, nudged by the measured spacing between fingertips. Width
  // is set by the NATURAL nail: an extension is longer, not wider — the nail
  // bed it is glued to hasn't changed size.
  const target = (naturalLength * widthRatio) / 2;
  const half = clamp(
    nearest === Infinity ? target : nearest * NEIGHBOUR_HALF_WIDTH,
    target * (1 - WIDTH_TOLERANCE),
    target * (1 + WIDTH_TOLERANCE)
  );

  const baseX = tip[0] - ux * length * NAIL_BASE * lengthScale;
  const baseY = tip[1] - uy * length * NAIL_BASE * lengthScale;
  // The free edge: at the fingertip for a natural nail, beyond it for an
  // extension. The base never moves — extensions grow forward, not backward.
  const past = length * NAIL_TIP * lengthScale + naturalLength * Math.max(0, extend);
  const endX = tip[0] + ux * past;
  const endY = tip[1] + uy * past;

  return [
    [baseX + px * half, baseY + py * half],
    [endX + px * half, endY + py * half],
    [endX - px * half, endY - py * half],
    [baseX - px * half, baseY - py * half],
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Heaviest smoothing applied to a motionless point. Raw landmarks jitter by a
 * pixel or two per frame, which reads as shimmer on a flat colour fill.
 */
const MAX_SMOOTHING = 0.85;
/**
 * How quickly smoothing backs off as a point speeds up. Higher = follows fast
 * movement more closely at the cost of more shimmer.
 *
 * This is the cheap half of a one-euro filter: fixed-alpha EMA is either
 * shimmery (low alpha) or laggy (high alpha), because the right trade-off
 * depends on how fast the hand is actually moving. Speed is measured as a
 * fraction of frame height per frame, so behaviour doesn't change with
 * resolution.
 */
const SPEED_SENSITIVITY = 90;

/**
 * Adaptive exponential moving average over a set of tracked points.
 * `frameHeight` normalises speed so a 480p and a 1080p stream behave alike.
 */
export function smoothPoints(
  previous: readonly Point[] | undefined,
  next: readonly Point[],
  frameHeight: number
): Point[] {
  if (!previous || previous.length !== next.length) return next as Point[];
  const scale = frameHeight > 0 ? frameHeight : 1;

  return next.map(([x, y], i) => {
    const [px, py] = previous[i];
    const speed = Math.hypot(x - px, y - py) / scale;
    const alpha = MAX_SMOOTHING / (1 + speed * SPEED_SENSITIVITY);
    return [px * alpha + x * (1 - alpha), py * alpha + y * (1 - alpha)] as Point;
  });
}

/**
 * A stable identity for one tracked hand. MediaPipe does not guarantee the
 * order of `landmarks` between frames, so keying the smoothing cache by array
 * index makes two hands swap filters mid-motion and lurch. The handedness
 * label is stable per physical hand; the index is only a fallback for when the
 * classifier gives nothing.
 */
export function handKey(handedness: string | undefined, index: number): string {
  return handedness && handedness.length > 0 ? `hand:${handedness}` : `idx:${index}`;
}
