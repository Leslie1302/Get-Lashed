import Link from "next/link";
import Image from "next/image";
import {
  BUSINESS,
  HERO_IMAGE,
  SERVICE_CATEGORIES,
  SERVICES,
} from "@/lib/constants";
import { formatPrice, whatsAppUrl } from "@/lib/format";

export default function HomePage() {
  const city = BUSINESS.address.split(",")[1]?.trim() ?? "Accra";
  const categoryCards = SERVICE_CATEGORIES.map((cat) => {
    const services = SERVICES.filter((s) => s.category === cat.id);
    const prices = services.map((s) => s.priceGHS);
    return {
      ...cat,
      count: services.length,
      fromPrice: Math.min(...prices),
      monogram: cat.label.charAt(0),
    };
  });

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
            {BUSINESS.name}
          </p>
          <h1 className="mt-4 text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight text-espresso md:text-6xl">
            {BUSINESS.tagline}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-cocoa">
            A small warm studio in <span className="font-semibold text-espresso">{city}</span> —
            every service bookable online or on WhatsApp, with real prices up front.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/book"
              className="inline-flex h-14 items-center justify-center rounded-md bg-terracotta px-10 text-base font-semibold text-paper transition-colors hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Book online
            </Link>
            <a
              href={whatsAppUrl(`Hi ${BUSINESS.name}! I'd like to book an appointment.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-espresso px-10 text-base font-semibold text-paper transition-colors hover:bg-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.04 2h-.02C6.4 2 2 6.4 2 12.02c0 1.76.47 3.49 1.36 5.02L2 22l5.05-1.32a9.94 9.94 0 0 0 4.99 1.27h.02C17.6 22 22 17.6 22 11.98 22 6.4 17.6 2 12.04 2zm0 18.2h-.02c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3 .79.8-2.92-.2-.3a8.18 8.18 0 0 1-1.25-4.41C7.1 6.3 9.33 4.07 12.04 4.07c2.71 0 4.94 2.23 4.97 4.94 0 2.71-2.24 4.94-4.97 4.94z" />
              </svg>
              Book on WhatsApp
            </a>
          </div>
        </div>

        {/* Hero photo. Set HERO_IMAGE in constants.ts to a real photo of her
            work; until then this is a plain tinted panel. It previously carried
            an invented client quote — that is a fabricated testimonial, and one
            should never ship. Hidden on mobile, so a phone visitor pays nothing
            for it either way. */}
        <div className="hidden aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-linen via-blush/60 to-sand md:block">
          {HERO_IMAGE && (
            <Image
              src={HERO_IMAGE}
              alt={`Nail and lash work by ${BUSINESS.name}`}
              width={800}
              height={1000}
              priority
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </section>

      {/* Category cards */}
      <section className="bg-linen" aria-labelledby="categories-heading">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 id="categories-heading" className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            What we do
          </h2>
          <p className="mt-3 max-w-lg text-cocoa">Pick a service and see the price. No surprises.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categoryCards.map((cat) => (
              <Link
                key={cat.id}
                href={`/services#${cat.id}`}
                className="group block overflow-hidden rounded-2xl border border-sand bg-paper transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                <div
                  className={`flex aspect-[4/3] items-center justify-center ${
                    cat.id === "nails"
                      ? "bg-sand/60"
                      : cat.id === "lashes"
                        ? "bg-linen"
                        : "bg-blush/50"
                  }`}
                >
                  <span className="font-display text-7xl font-medium text-cocoa/70">
                    {cat.monogram}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl font-medium">{cat.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cocoa">{cat.description}</p>
                  <p className="mt-4 text-sm text-cocoa">
                    {cat.count} {cat.count === 1 ? "service" : "services"} · from{" "}
                    <span className="font-semibold text-espresso">{formatPrice(cat.fromPrice)}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials slot */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="sr-only">Client words</h2>
        <div className="rounded-2xl border border-sand bg-linen/60 p-10">
          <p className="font-display text-2xl italic leading-snug text-espresso md:text-3xl">
            “The volume lash set outlasted my last wedding — two months in, still a full fan.”
          </p>
          <p className="mt-6 text-sm font-semibold tracking-wide text-cocoa">
            <span>— Ama, Osu</span> <span className="text-terracotta" aria-label="5 out of 5 stars">★★★★★</span>
          </p>
        </div>
      </section>
    </>
  );
}