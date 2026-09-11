// The nail and lash finishes offered on /try-on.
//
// A nail finish is either a flat colour or an image swatch from
// /public/designs. Both are painted into a square canvas that the AR code
// warps onto each nail, so anything that can be drawn into that square works —
// which is why patterns are files rather than hand-written canvas code.
//
// Adding a design: drop a square image in /public/designs and add a line to
// NAIL_DESIGNS. `npm run check:ar` fails if the file is missing or misnamed.
// See README, "Adding a nail design", for the swatch spec.

export interface NailDesign {
  id: string;
  name: string;
  /** Flat polish colour. Ignored when `image` is set. */
  color?: string;
  /** Square swatch under /public/designs — the pattern only, no nail shape. */
  image?: string;
  /** Optional french tip painted over the colour or image. */
  tip?: string;
  /**
   * True for the patterned finishes, which are the paid "extra nail design"
   * add-on rather than a plain colour. Shown on the swatch so nobody picks a
   * look here and meets a price they weren't expecting at checkout.
   */
  extra?: boolean;
}

export interface LashDesign {
  id: string;
  name: string;
  color: string;
  /**
   * Length multiplier, 1 (natural) to ~3 (dramatic). A plain number rather
   * than 1|2|3 so the hybrid tiers can sit between the classic and volume
   * looks — otherwise light and full hybrid render identically and splitting
   * them tells the client nothing.
   */
  flair: number;
  /** The service this look books — id from SERVICES. */
  serviceId: string;
  /** Which of that service's required options this look is, when it maps to one. */
  optionId?: string;
}

// Ordered to match the menu: the BIAB and French finishes she actually sells
// come first, then plain gel colours, then the patterned designs that carry
// the extra-design charge.
export const NAIL_DESIGNS: NailDesign[] = [
  { id: "biab-natural", name: "BIAB Natural", color: "#edd9cd" },
  { id: "french", name: "French Tips", color: "#e9ceb5", tip: "#fdf6f2" },
  { id: "classic", name: "Classic Red", color: "#b03052" },
  { id: "bubblegum", name: "Bubblegum", color: "#f2a0bd" },
  { id: "midnight", name: "Midnight", color: "#2b2b45" },
  { id: "gold-glitter", name: "Gold Glitter", image: "/designs/gold-glitter.jpg", extra: true },
  { id: "white-marble", name: "White Marble", image: "/designs/white-marble.jpg", extra: true },
  { id: "leopard", name: "Leopard", image: "/designs/leopard.jpg", extra: true },
  { id: "chrome", name: "Chrome", image: "/designs/chrome.jpg", extra: true },
  {
    id: "midnight-shimmer",
    name: "Midnight Shimmer",
    image: "/designs/midnight-shimmer.jpg",
    extra: true,
  },
  { id: "rose-ombre", name: "Rose Ombré", image: "/designs/rose-ombre.jpg", extra: true },
];

/**
 * The nail services a client can preview, in the order they appear above the
 * design swatches, each with the length it opens at.
 *
 * Soak-off is deliberately absent: it removes a set rather than being one, so
 * there is nothing to look at.
 *
 * Kept here rather than on NAIL_LENGTHS so ar-geometry stays pure maths with
 * no idea the price list exists.
 */
export const TRY_ON_NAIL_SERVICES: { id: string; lengthId: string }[] = [
  { id: "biab-natural", lengthId: "natural" },
  { id: "biab-extensions", lengthId: "medium" },
  { id: "short-acrylic-french", lengthId: "short" },
  { id: "medium-acrylic-french", lengthId: "medium" },
  { id: "long-acrylic-french", lengthId: "long" },
  { id: "custom-stick-on-nails", lengthId: "medium" },
];

/**
 * Which paid option the chosen finish implies, or null when the finish alone
 * doesn't settle it.
 *
 * Custom Stick-On Nails is the clean case: its three tiers ARE finishes, so a
 * plain colour is the GH₵100 set, a French tip the GH₵150, and a pattern the
 * GH₵200 — no guessing, and the try-on can quote the real price.
 *
 * The acrylic + French sets take the extra-design add-on, but whether a given
 * pattern is the GH₵20 or the GH₵30 tier isn't recorded per design, so those
 * return null and the booking form asks.
 */
export function nailOptionId(serviceId: string, design: NailDesign): string | null {
  if (serviceId !== "custom-stick-on-nails") return null;
  if (design.extra) return "french-design";
  if (design.tip) return "french";
  return "plain-gel";
}

/**
 * Lashes are a thin fill along the lash line — a texture would never read, so
 * these differ by length and density rather than colour.
 *
 * One entry per lash set on the menu, and nothing else. The previous list had
 * Violet Haze, Mocha and Soft Brown, which the studio does not offer: letting
 * someone fall in love with a look they cannot book is worse than offering
 * fewer.
 */
export const LASH_DESIGNS: LashDesign[] = [
  { id: "classic", name: "Classic", color: "#15130f", flair: 1, serviceId: "classic-lashes" },
  {
    id: "hybrid-light",
    name: "Light Hybrid",
    color: "#0d0d0d",
    flair: 1.8,
    serviceId: "hybrid-lashes",
    optionId: "light",
  },
  {
    id: "hybrid-full",
    name: "Full Hybrid",
    color: "#0d0d0d",
    flair: 2.3,
    serviceId: "hybrid-lashes",
    optionId: "full",
  },
  { id: "volume", name: "Volume", color: "#000000", flair: 3, serviceId: "volume-lashes" },
  // No optionId: the two Custom tiers differ by price, not by anything this
  // preview can draw, so the choice belongs on the booking form.
  { id: "custom", name: "Custom", color: "#000000", flair: 3.2, serviceId: "custom-lashes" },
];

/** CSS for the picker swatch, so a button shows the pattern it will paint. */
export function swatchStyle(design: NailDesign): React.CSSProperties {
  return design.image
    ? { backgroundImage: `url(${design.image})`, backgroundSize: "cover" }
    : { background: design.color };
}

const SIZE = 256;

/**
 * Paint one finish into the square the AR code warps onto a nail. In that
 * square, y=0 is the cuticle and y=SIZE the free edge — which is why the
 * french tip is drawn at the bottom.
 */
export async function paintNail(design: NailDesign, size = SIZE): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (design.image) {
    ctx.drawImage(await loadImage(design.image), 0, 0, size, size);
  } else {
    ctx.fillStyle = design.color ?? "#c9a9a6";
    ctx.fillRect(0, 0, size, size);
  }

  if (design.tip) {
    // The smile line: thinner white at the centre, deeper at the sidewalls,
    // following the free edge the way a real french manicure does.
    ctx.fillStyle = design.tip;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.75);
    ctx.quadraticCurveTo(size * 0.5, size * 0.88, size, size * 0.75);
    ctx.lineTo(size, size);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();
  }

  // A soft highlight across the upper nail. Without it a flat fill reads as
  // matte paint rather than polish.
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.ellipse(size * 0.42, size * 0.3, size * 0.3, size * 0.13, -0.45, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin today; set so moving these to a CDN later needs no change.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Design image failed to load: ${src}`));
    img.src = src;
  });
}
