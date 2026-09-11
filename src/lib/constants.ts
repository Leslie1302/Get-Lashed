export const BUSINESS = {
  name: "Get Lashed",
  tagline: "Lashes, nails and pedi-mani — Kweiman, Accra",
  /** The number clients call. */
  phone: "+233 50 663 7726",
  /** Second line. */
  phoneAlt: "+233 55 251 8871",
  /** International format, digits only — no + and no spaces. */
  whatsappNumber: "233506637726",
  /**
   * No public email: enquiries go through WhatsApp or the booking form, so
   * there is no inbox for a stray message to die in. Nothing on the site
   * renders a mailto link. (Clients still give their own email at checkout —
   * Paystack sends the receipt there.)
   */
  email: null as string | null,
  /** The landmark clients are given directions to. */
  address: "Lelca Groceries, Kweiman, Accra",
  /**
   * Google Maps query for the pin. A Plus Code is more precise than a street
   * name here and Maps resolves it directly, so there's no lat/lng to keep in
   * sync and nothing to geocode.
   */
  mapQuery: "QRMC+43, Kweiman, Ghana",
  socialLinks: {
    instagram: "https://instagram.com/getlashed.gh",
    snapchat: "https://snapchat.com/add/naaatswei001",
  },
} as const;

/**
 * Home page hero photo — a path under /public (e.g. "/hero.jpg") or a
 * Cloudinary URL. Null shows a plain tinted panel instead. Portrait crops work
 * best; it renders at 4:5 beside the headline on desktop and is hidden on
 * mobile, so it never costs a phone visitor anything.
 */
export const HERO_IMAGE: string | null = "/photos/hero-nails.jpg";

/**
 * Supporting photography. These are stock, used decoratively — they are NOT
 * the studio's work and must never be presented as it. The portfolio gallery
 * is the place client work belongs, and that comes from Cloudinary.
 */
export const PHOTOS = {
  about: "/photos/studio-manicure.jpg",
  services: "/photos/pedicure.jpg",
} as const;

/** Embedded map of the studio pin. */
export function mapEmbedUrl(): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(BUSINESS.mapQuery)}&z=17&output=embed`;
}

/** "Open in Maps" / directions link. */
export function mapDirectionsUrl(): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    BUSINESS.mapQuery
  )}`;
}

export type ServiceCategory = "nails" | "lashes" | "pedimani";

export const SERVICE_CATEGORIES: {
  id: ServiceCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "nails",
    label: "Nails",
    description: "Manicures, gel & extensions — shape, colour and finish.",
  },
  {
    id: "lashes",
    label: "Lashes",
    description: "Classic to volume lash sets and lifts, tailored to your eyes.",
  },
  {
    id: "pedimani",
    label: "Pedi + Mani",
    description: "Full hand and foot care — soak, scrub, shape and polish.",
  },
];

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  priceGHS: number;
  durationMins: number;
  description: string;
}

/**
 * PLACEHOLDER — every name, price and duration below is invented.
 *
 * These drive the price list, the booking form, the slot lengths, the deposit
 * balance and the JSON-LD Google shows in search results. Replace them with the
 * studio's real menu before launch; a wrong price here is a wrong price quoted
 * to a client.
 */
export const SERVICES: Service[] = [
  {
    id: "gel-manicure",
    name: "Gel Manicure",
    category: "nails",
    priceGHS: 200,
    durationMins: 75,
    description: "Cuticle care, shaping and a long-wear gel polish in any shade.",
  },
  {
    id: "classic-manicure",
    name: "Classic Manicure",
    category: "nails",
    priceGHS: 150,
    durationMins: 45,
    description: "Tidy hands, softened cuticles and a polished finish.",
  },
  {
    id: "gel-x-extensions",
    name: "Gel-X Extensions",
    category: "nails",
    priceGHS: 380,
    durationMins: 120,
    description: "Durable full set of gel extensions in your length and shape.",
  },
  {
    id: "classic-lash-set",
    name: "Classic Lash Set",
    category: "lashes",
    priceGHS: 350,
    durationMins: 120,
    description: "A natural, feather-light lash set with one extension per lash.",
  },
  {
    id: "volume-lash-set",
    name: "Volume Lash Set",
    category: "lashes",
    priceGHS: 550,
    durationMins: 150,
    description: "Fluffy multi-layered fans for a fuller, dramatic look.",
  },
  {
    id: "lash-lift",
    name: "Lash Lift & Tint",
    category: "lashes",
    priceGHS: 250,
    durationMins: 60,
    description: "Curls and darkens your natural lashes — no extensions needed.",
  },
  {
    id: "spa-pedicure",
    name: "Spa Pedicure",
    category: "pedimani",
    priceGHS: 180,
    durationMins: 60,
    description: "Soak, exfoliating scrub, cuticle care and polish.",
  },
  {
    id: "mani-pedi-combo",
    name: "Mani + Pedi Combo",
    category: "pedimani",
    priceGHS: 300,
    durationMins: 105,
    description: "The full hand and foot treatment together at a better price.",
  },
];

type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKDAY_ORDER: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type DayHours = { open: string; close: string } | null;

/** PLACEHOLDER — real opening hours, buffer and lead time still needed. */
export const SCHEDULE = {
  openingHours: {
    monday: { open: "09:00", close: "18:00" },
    tuesday: { open: "09:00", close: "18:00" },
    wednesday: { open: "09:00", close: "18:00" },
    thursday: { open: "09:00", close: "18:00" },
    friday: { open: "09:00", close: "20:00" },
    saturday: { open: "09:00", close: "20:00" },
    sunday: null,
  } satisfies Record<Weekday, DayHours>,
  slotIntervalMins: 60,
  bufferMins: 15,
  /** A day's notice. */
  minLeadTimeHours: 24,
  maxAdvanceDays: 30,
  /**
   * Individual closure dates, "YYYY-MM-DD". Left empty deliberately: holidays
   * are handled by the "message us before a public holiday" note shown on the
   * booking and about pages, rather than by maintaining a calendar of them
   * here. Add a date only to hard-block a day that would otherwise be bookable.
   */
  blackoutDates: [] as string[],
} as const;
export const ADMIN_COOKIE = "gl_admin";
export const ADMIN_SESSION_HOURS = 8;

/** Cloudinary folder new portfolio uploads land in. */
export const PORTFOLIO_FOLDER = "portfolio";

/**
 * Deposit taken online to confirm a booking, in cedis. The balance is settled
 * at the studio.
 *
 * ZERO DISABLES DEPOSITS: bookings confirm immediately and no payment is asked
 * for, which is how the site behaves right now. Set this to the amount the
 * studio actually charges, add PAYSTACK_SECRET_KEY, and the booking flow
 * switches to hold-then-pay.
 *
 * Deliberately not pre-filled — a guessed figure would charge real clients
 * real money.
 */
export const DEPOSIT_GHS = 0;

/** Anti-abuse limits for the unauthenticated POST /api/book. */
export const BOOKING_GUARD = {
  maxPerIpPerHour: 5,
  /** A human cannot fill the form faster than this. */
  minFormMillis: 3_000,
  /** Stale form — the page sat open too long, make them reload. */
  maxFormMillis: 2 * 60 * 60 * 1000,
} as const;
