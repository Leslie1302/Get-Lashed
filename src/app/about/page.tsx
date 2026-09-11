import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { publicHours } from "@/lib/public-hours";
import {
  BUSINESS,
  PHOTOS,
  SCHEDULE,
  WEEKDAY_ORDER,
  mapDirectionsUrl,
  mapEmbedUrl,
} from "@/lib/constants";
import { formatHours, whatsAppUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const hours = await publicHours();
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <header className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
          About
        </p>
        <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
          A small studio, a personal touch
        </h1>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        {/* Bio + contact */}
        <div className="flex flex-col gap-8">
          {/* Decorative stock, not the studio's own work — empty alt so it is
              skipped by screen readers rather than described as if it were. */}
          <div className="aspect-[4/5] overflow-hidden rounded-2xl">
            <Image
              src={PHOTOS.about}
              alt=""
              width={900}
              height={1125}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-4 text-base leading-relaxed text-cocoa">
            {/* PLACEHOLDER: replace with the studio's own story — who she is,
                how long she's been doing this, what she's known for. Written
                here only from what the site itself can vouch for; no invented
                history, because a made-up origin story is the fastest way to
                sound like every other salon page. */}
            <p>
              {BUSINESS.name} is a small studio in Accra doing nails, lashes and
              pedicures, run by one technician who does every set herself.
            </p>
            <p>
              Everything runs by appointment. Each booking gets its own slot plus a{" "}
              {SCHEDULE.bufferMins}-minute buffer, so nobody is squeezed in between
              clients and your time is your own.
            </p>
            <p>
              Prices are listed in full on the{" "}
              <Link href="/services" className="underline hover:text-espresso">
                services page
              </Link>{" "}
              — no quoting on the day. Book online, or send a message on WhatsApp and
              she&rsquo;ll sort it out with you directly.
            </p>
          </div>

          <div className="rounded-2xl border border-sand bg-linen/60 p-6">
            <h2 className="font-display text-xl font-medium">Find us</h2>
            <address className="not-italic">
              <p className="mt-3 text-sm text-cocoa">
                <a
                  href={mapDirectionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-espresso"
                >
                  {BUSINESS.address}
                </a>
              </p>
              <p className="mt-1 text-sm">
                <a
                  href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}
                  className="text-cocoa hover:text-espresso"
                >
                  {BUSINESS.phone}
                </a>
              </p>
              <p className="mt-1 text-sm">
                <a
                  href={`tel:${BUSINESS.phoneAlt.replace(/\s/g, "")}`}
                  className="text-cocoa hover:text-espresso"
                >
                  {BUSINESS.phoneAlt}
                </a>
              </p>
              <p className="mt-3">
                <a
                  href={whatsAppUrl(`Hi ${BUSINESS.name}! Quick question about your services.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-terracotta px-6 text-sm font-semibold text-paper hover:bg-clay"
                >
                  WhatsApp us
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Map + hours */}
        <div className="flex flex-col gap-8">
          <div className="overflow-hidden rounded-2xl border border-sand">
            <iframe
              src={mapEmbedUrl()}
              title={`Map to ${BUSINESS.name}, ${BUSINESS.address}`}
              className="h-72 w-full md:h-80"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="rounded-2xl border border-sand bg-paper p-6">
            <h2 className="font-display text-xl font-medium">Opening hours</h2>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Weekly opening hours</caption>
              <tbody>
                {WEEKDAY_ORDER.map((day) => {
                  const h = hours[day];
                  return (
                    <tr key={day} className="border-b border-sand/70 last:border-0">
                      <th scope="row" className="py-2.5 text-left font-body font-semibold text-espresso">
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </th>
                      <td className="py-2.5 text-right text-cocoa">
                        {h ? `${formatHours(h.opens)} – ${formatHours(h.closes)}` : "Closed"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 rounded-md bg-linen px-4 py-3 text-sm text-cocoa">
              <strong className="font-semibold text-espresso">Public holidays:</strong> the
              studio may be closed, and holidays aren&rsquo;t blocked out in the online
              diary. Message us on WhatsApp to confirm before booking around one, or before
              you travel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}