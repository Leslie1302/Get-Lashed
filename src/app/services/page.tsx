import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  PHOTOS,
  SERVICE_CATEGORIES,
  SERVICES,
  serviceChoices,
  servicePrice,
  type ServiceCategory,
} from "@/lib/constants";
import { formatDuration, formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Services & Prices",
};

const CATEGORY_BG: Record<ServiceCategory, string> = {
  nails: "bg-sand/60",
  lashes: "bg-linen",
  pedicure: "bg-blush/50",
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <header className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
          Services
        </p>
        <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
          Services &amp; prices
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cocoa">
          Every treatment, every price — in Ghana cedis. Pick one and book it; the
          15-minute buffer between appointments means you&rsquo;re never rushed out.
        </p>
      </header>

      {/* Decorative: alt is empty so screen readers skip it rather than
          announcing a stock photo that carries no information. */}
      <div className="mt-10 aspect-[3/2] overflow-hidden rounded-2xl sm:aspect-[5/2]">
        <Image
          src={PHOTOS.services}
          alt=""
          width={1200}
          height={800}
          className="h-full w-full object-cover"
        />
      </div>

      {SERVICE_CATEGORIES.map((cat) => {
        const services = SERVICES.filter((s) => s.category === cat.id);
        return (
          <section
            key={cat.id}
            id={cat.id}
            className="mt-16 scroll-mt-24"
            aria-labelledby={`${cat.id}-heading`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`${cat.id}-heading`} className="font-display text-2xl font-medium tracking-tight md:text-3xl">
                {cat.label}
              </h2>
              <p className="text-sm text-cocoa">{cat.description}</p>
            </div>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <li
                  key={service.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-sand bg-paper transition-shadow hover:shadow-md"
                >
                  <div className={`flex aspect-[4/3] items-center justify-center ${CATEGORY_BG[cat.id]}`} aria-hidden="true">
                    <span className="font-display text-6xl font-medium text-cocoa/60">
                      {service.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-xl font-medium">{service.name}</h3>
                      <p className="whitespace-nowrap font-bold text-espresso">
                        {service.options ? (
                          <>
                            {formatPrice(service.priceGHS)}
                            <span className="font-normal text-cocoa">
                              –
                              {formatPrice(
                                Math.max(
                                  ...serviceChoices(service).map((c) =>
                                    servicePrice(service, c.id)
                                  )
                                )
                              )}
                            </span>
                          </>
                        ) : (
                          formatPrice(service.priceGHS)
                        )}
                      </p>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-mocha">
                      {formatDuration(service.durationMins)}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-cocoa">
                      {service.description}
                    </p>
                    {service.priceNote && (
                      <p className="mt-2 text-xs italic text-mocha">{service.priceNote}</p>
                    )}
                    {service.options && (
                      <ul className="mt-3 grid gap-1 text-xs text-mocha">
                        {serviceChoices(service)
                          .filter((c) => c.addGHS > 0)
                          .map((c) => (
                            <li key={c.id}>+ {c.label}</li>
                          ))}
                      </ul>
                    )}
                    <Link
                      href={`/book?service=${service.id}`}
                      className="mt-6 inline-flex h-11 items-center justify-center rounded-md border-2 border-espresso px-6 text-sm font-semibold text-espresso transition-colors hover:bg-espresso hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                    >
                      Book this service
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}