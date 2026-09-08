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
}

export interface LashDesign {
  id: string;
  name: string;
  color: string;
  /** Length multiplier: natural < volume < dramatic. */
  flair: 1 | 2 | 3;
}

export const NAIL_DESIGNS: NailDesign[] = [
  { id: "classic", name: "Classic Red", color: "#b03052" },
  { id: "bubblegum", name: "Bubblegum", color: "#f2a0bd" },
  { id: "midnight", name: "Midnight", color: "#2b2b45" },
  { id: "nude-french", name: "Nude French", color: "#e9ceb5", tip: "#fdf6f2" },
  { id: "gold-glitter", name: "Gold Glitter", image: "/designs/gold-glitter.jpg" },
  { id: "white-marble", name: "White Marble", image: "/designs/white-marble.jpg" },
  { id: "leopard", name: "Leopard", image: "/designs/leopard.jpg" },
  { id: "chrome", name: "Chrome", image: "/designs/chrome.jpg" },
  { id: "midnight-shimmer", name: "Midnight Shimmer", image: "/designs/midnight-shimmer.jpg" },
  { id: "rose-ombre", name: "Rose Ombré", image: "/designs/rose-ombre.jpg" },
];

/** Lashes are a thin fill along the lash line — a texture would never read. */
export const LASH_DESIGNS: LashDesign[] = [
  { id: "natural", name: "Natural", color: "#15130f", flair: 1 },
  { id: "classic-black", name: "Classic", color: "#0d0d0d", flair: 2 },
  { id: "light-brown", name: "Soft Brown", color: "#5b4630", flair: 1 },
  { id: "dramatic", name: "Dramatic", color: "#000000", flair: 3 },
  { id: "violet", name: "Violet Haze", color: "#3d2b5e", flair: 2 },
  { id: "mocha", name: "Mocha", color: "#43301f", flair: 2 },
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
