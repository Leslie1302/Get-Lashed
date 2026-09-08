import Link from "next/link";
import { BUSINESS, SCHEDULE, WEEKDAY_ORDER } from "@/lib/constants";
import { formatHours, whatsAppUrl } from "@/lib/format";

export default function SiteFooter() {
  const week = WEEKDAY_ORDER.map((day) => ({
    day: day.charAt(0).toUpperCase() + day.slice(1),
    hours: SCHEDULE.openingHours[day],
  }));

  return (
    <footer className="border-t border-sand bg-linen">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <p className="font-display text-lg font-semibold">{BUSINESS.name}</p>
          <p className="mt-2 max-w-xs text-sm text-cocoa">{BUSINESS.tagline}</p>
          <div className="mt-4 flex gap-3">
            {Object.entries(BUSINESS.socialLinks).map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-sand bg-paper px-3 py-1.5 text-xs font-semibold capitalize text-cocoa hover:border-terracotta hover:text-terracotta"
              >
                {platform}
              </a>
            ))}
          </div>
        </div>

        <address className="not-italic">
          <p className="font-display text-sm font-semibold">Visit us</p>
          <p className="mt-2 text-sm text-cocoa">{BUSINESS.address}</p>
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
          <p className="mt-2 text-sm">
            <a
              href={whatsAppUrl(`Hi ${BUSINESS.name}! I'd like to make a booking.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-terracotta hover:text-clay"
            >
              WhatsApp us
            </a>
          </p>
        </address>

        <div>
          <p className="font-display text-sm font-semibold">Opening hours</p>
          <table className="mt-2 w-full max-w-xs text-sm">
            <caption className="sr-only">Weekly opening hours</caption>
            <tbody>
              {week.map(({ day, hours }) => (
                <tr key={day} className="border-b border-sand/70 last:border-0">
                  <th scope="row" className="py-1.5 text-left font-body font-semibold text-cocoa">
                    {day}
                  </th>
                  <td className="py-1.5 text-right text-cocoa">
                    {hours
                      ? `${formatHours(hours.open)} – ${formatHours(hours.close)}`
                      : "Closed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="border-t border-sand/70">
        <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-cocoa">
          © {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.{" "}
          <Link href="/book" className="underline hover:text-espresso">
            Book online
          </Link>
        </p>
      </div>
    </footer>
  );
}