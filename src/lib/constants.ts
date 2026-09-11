export const BUSINESS = {
  name: "Get Lashed",
  tagline: "Lashes, nails and pedicures — Kweiman, Accra",
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

export type ServiceCategory = "nails" | "pedicure" | "lashes";

export const SERVICE_CATEGORIES: {
  id: ServiceCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "nails",
    label: "Nails",
    description: "BIAB, acrylics and French tips — natural or extended.",
  },
  {
    id: "pedicure",
    label: "Pedicure",
    description: "From a clean naked pedi to BIAB toes.",
  },
  {
    id: "lashes",
    label: "Lashes",
    description: "Classic, hybrid, volume and custom sets, plus refills.",
  },
];

/**
 * One selectable extra or variant on a service. `addGHS` is ADDED to the
 * service's base price — the total is computed server-side at booking, never
 * taken from the browser, because that total is what Paystack charges.
 */
export interface ServiceChoice {
  id: string;
  label: string;
  addGHS: number;
  // No addMins: every current extra fits inside the service's own duration.
  // Add one here AND thread it through availability.ts together, or slots
  // will be booked too short.
}

export interface ServiceOptions {
  /** The question put to the client. */
  label: string;
  /**
   * Required means the base price alone doesn't describe a real appointment —
   * a hybrid set IS either light or full — so there is nothing to decline.
   * Optional means a "no thanks" choice is added automatically and preselected.
   */
  required?: boolean;
  /** Wording of the decline choice. Ignored when required. */
  declineLabel?: string;
  choices: ServiceChoice[];
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  /** Base price. With options, the lowest the appointment can cost. */
  priceGHS: number;
  durationMins: number;
  description: string;
  options?: ServiceOptions;
  /** Shown beside the price where the final amount can differ at the studio. */
  priceNote?: string;
}

/** Extra nail design — the same choice across all three French tip sets. */
const EXTRA_DESIGN: ServiceOptions = {
  label: "Add an extra nail design?",
  declineLabel: "No extra design",
  choices: [
    { id: "design-20", label: "Extra design — GH₵20", addGHS: 20 },
    { id: "design-30", label: "More detailed design — GH₵30", addGHS: 30 },
  ],
};

/**
 * The studio's real menu.
 *
 * Prices are what Paystack charges, in full, before a request reaches her.
 * A wrong number here debits a real client the wrong amount, so nothing in
 * this list is a placeholder — every price came from the studio.
 *
 * Durations marked PROVISIONAL were not supplied and are estimates. They only
 * decide how long a slot is blocked out, never what anyone is charged.
 */
export const SERVICES: Service[] = [
  /* ---------------------------------------------------------------- nails */
  {
    id: "biab-natural",
    name: "BIAB — Natural Nails",
    category: "nails",
    priceGHS: 500,
    durationMins: 150,
    description:
      "BIAB applied directly onto your natural nails without extensions, for a durable, polished finish.",
  },
  {
    id: "biab-extensions",
    name: "BIAB + Extensions",
    category: "nails",
    priceGHS: 600,
    durationMins: 180,
    description:
      "BIAB with extensions for additional length, strength and a polished finish.",
    priceNote: "Final price may vary with length and design.",
  },
  {
    id: "short-acrylic-french",
    name: "Short Acrylic + French Tips",
    category: "nails",
    priceGHS: 250,
    durationMins: 120,
    description:
      "Short acrylic extensions finished with classic French tips for a clean, timeless look.",
    options: EXTRA_DESIGN,
  },
  {
    id: "medium-acrylic-french",
    name: "Medium Acrylic + French Tips",
    category: "nails",
    priceGHS: 450,
    durationMins: 135,
    description:
      "Medium acrylic extensions with French tips for an elegant, wearable length.",
    options: EXTRA_DESIGN,
  },
  {
    id: "long-acrylic-french",
    name: "Long Acrylic + French Tips",
    category: "nails",
    priceGHS: 480,
    durationMins: 150,
    description:
      "Long acrylic extensions finished with French tips for a bold yet elegant look.",
    options: EXTRA_DESIGN,
  },
  {
    id: "custom-stick-on-nails",
    name: "Custom Stick-On Nails",
    category: "nails",
    priceGHS: 100,
    durationMins: 60, // PROVISIONAL
    description:
      "Custom-made stick-on nails based on your preferred shape, length and design.",
    options: {
      label: "Choose your finish",
      required: true,
      choices: [
        { id: "plain-gel", label: "Plain gel colour — GH₵100", addGHS: 0 },
        { id: "french", label: "French tips — GH₵150", addGHS: 50 },
        { id: "french-design", label: "French tips with extra design — GH₵200", addGHS: 100 },
      ],
    },
  },
  {
    id: "soak-off",
    name: "Soak-Off / Removal",
    category: "nails",
    priceGHS: 85,
    durationMins: 45, // PROVISIONAL
    description:
      "Removal of existing acrylic, BIAB or other nail enhancements before a new set. Please arrive 30 minutes early.",
  },

  /* ------------------------------------------------------------- pedicure */
  {
    id: "naked-pedicure",
    name: "Naked Pedicure",
    category: "pedicure",
    priceGHS: 120,
    durationMins: 45, // PROVISIONAL
    description: "A clean and refreshing pedicure without gel polish.",
  },
  {
    id: "pedicure-gel",
    name: "Pedicure + Gel Polish",
    category: "pedicure",
    priceGHS: 180,
    durationMins: 60, // PROVISIONAL
    description: "A complete pedicure finished with gel polish.",
  },
  {
    id: "pedicure-biab-toes",
    name: "Pedicure + BIAB Toes",
    category: "pedicure",
    priceGHS: 300,
    durationMins: 90, // PROVISIONAL
    description: "A pedicure finished with BIAB on the toes for a durable, neat finish.",
  },
  {
    id: "custom-stick-on-toes",
    name: "Custom Stick-On Toes",
    category: "pedicure",
    priceGHS: 100,
    durationMins: 45, // PROVISIONAL
    description:
      "Custom-made stick-on toes based on your preferred shape, length and design.",
  },

  /* --------------------------------------------------------------- lashes */
  {
    id: "classic-lashes",
    name: "Classic Lashes",
    category: "lashes",
    priceGHS: 180,
    durationMins: 90, // PROVISIONAL
    description: "Soft, natural-looking lash enhancement.",
  },
  {
    id: "hybrid-lashes",
    name: "Hybrid Lashes",
    category: "lashes",
    priceGHS: 200,
    durationMins: 105, // PROVISIONAL
    description: "A blend of classic and volume techniques for added definition.",
    options: {
      label: "Choose your volume",
      required: true,
      choices: [
        { id: "light", label: "Light hybrid — GH₵200", addGHS: 0 },
        { id: "full", label: "Full hybrid — GH₵250", addGHS: 50 },
      ],
    },
  },
  {
    id: "volume-lashes",
    name: "Volume Lashes",
    category: "lashes",
    priceGHS: 350,
    durationMins: 120, // PROVISIONAL
    description: "A fuller lash look with beautiful definition.",
  },
  {
    id: "custom-lashes",
    name: "Custom Made Lashes",
    category: "lashes",
    priceGHS: 450,
    durationMins: 135, // PROVISIONAL
    description: "A customised lash set created to suit your preferred look and volume.",
    options: {
      label: "Choose your set",
      required: true,
      choices: [
        { id: "set-450", label: "GH₵450 set", addGHS: 0 },
        { id: "set-550", label: "GH₵550 set", addGHS: 100 },
      ],
    },
  },
  {
    id: "lash-removal",
    name: "Lash Removal",
    category: "lashes",
    priceGHS: 70,
    durationMins: 30, // PROVISIONAL
    description: "Professional removal of an existing lash set.",
  },
  {
    id: "lash-refill",
    name: "Lash Refill",
    category: "lashes",
    priceGHS: 90,
    durationMins: 75, // PROVISIONAL
    description:
      "Refresh your existing lash set and restore its appearance. A refill is half the price of the set being refilled.",
    options: {
      // Half of each set above. Kept as explicit numbers rather than computed
      // from SERVICES: a refill price that silently moved when a set's price
      // changed would be discovered by a client at checkout.
      label: "Which set are you refilling?",
      required: true,
      choices: [
        { id: "classic", label: "Classic — GH₵90", addGHS: 0 },
        { id: "hybrid-light", label: "Light hybrid — GH₵100", addGHS: 10 },
        { id: "hybrid-full", label: "Full hybrid — GH₵125", addGHS: 35 },
        { id: "volume", label: "Volume — GH₵175", addGHS: 85 },
        { id: "custom-450", label: "Custom (GH₵450 set) — GH₵225", addGHS: 135 },
        { id: "custom-550", label: "Custom (GH₵550 set) — GH₵275", addGHS: 185 },
      ],
    },
  },
];

/** Every choice a client may pick, including the decline one when allowed. */
export function serviceChoices(service: Service): ServiceChoice[] {
  const options = service.options;
  if (!options) return [];
  if (options.required) return options.choices;
  return [
    { id: "none", label: options.declineLabel ?? "No thank you", addGHS: 0 },
    ...options.choices,
  ];
}

/** The chosen extra, or null. Unknown ids resolve to null, never to a guess. */
export function serviceChoice(service: Service, choiceId?: string | null): ServiceChoice | null {
  if (!service.options || !choiceId) return null;
  return serviceChoices(service).find((c) => c.id === choiceId) ?? null;
}

/** What the appointment costs. This is the amount Paystack charges. */
export function servicePrice(service: Service, choiceId?: string | null): number {
  return service.priceGHS + (serviceChoice(service, choiceId)?.addGHS ?? 0);
}

/** A required option with nothing picked is not a bookable appointment. */
export function choiceMissing(service: Service, choiceId?: string | null): boolean {
  return !!service.options?.required && !serviceChoice(service, choiceId);
}

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
 * Payment policy, as the studio states it publicly on /policy.
 *
 * The appointment is paid IN FULL online — there is no part-deposit. So there
 * is no amount to configure here: the charge is the service's own price, and a
 * second copy of it in this file could only ever disagree with the price list.
 *
 * Payment is required whenever PAYSTACK_SECRET_KEY is set. Without the key the
 * site falls back to taking requests over WhatsApp, which is how it behaves
 * before Paystack is connected.
 */
export const POLICY = {
  /** Minutes of lateness tolerated before the appointment may be shortened. */
  graceMins: 15,
  /** After this, it may be cut short or cancelled with no refund. */
  lateCancelMins: 20,
  /** Notice required to cancel or move without losing the payment. */
  cancelNoticeHours: 10,
  /** How early to arrive when a soak-off is needed. */
  soakOffEarlyMins: 30,
  maxGuests: 1,
} as const;

/**
 * Both studio lines, for the policy page. Deliberately derived from BUSINESS
 * rather than retyped: a phone number written twice is a phone number that
 * eventually disagrees with itself.
 */
export const CONTACT_NUMBERS = [BUSINESS.phone, BUSINESS.phoneAlt] as const;

/** Anti-abuse limits for the unauthenticated POST /api/book. */
export const BOOKING_GUARD = {
  maxPerIpPerHour: 5,
  /** A human cannot fill the form faster than this. */
  minFormMillis: 3_000,
  /** Stale form — the page sat open too long, make them reload. */
  maxFormMillis: 2 * 60 * 60 * 1000,
} as const;
