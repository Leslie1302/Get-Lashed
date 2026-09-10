import { timingSafeEqual } from "node:crypto";
import { BUSINESS, SERVICES } from "@/lib/constants";
import { confirmedFrom } from "@/lib/bookings";
import { databaseConfigured } from "@/lib/db";

/**
 * A private iCalendar feed of confirmed bookings, so she keeps appointments and
 * reminders in the phone calendar she already uses. Read-only and one-way: the
 * app is the schedule, this is a mirror of it.
 *
 * The URL is the credential — anyone holding it sees client names and phone
 * numbers — so it must be a long random string and never linked publicly.
 * Generate one with:  openssl rand -hex 24
 */
export const dynamic = "force-dynamic";

function tokenMatches(given: string): boolean {
  const expected = process.env.CALENDAR_FEED_TOKEN;
  // A short token would be brute-forceable against an unauthenticated endpoint.
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Escape per RFC 5545: commas, semicolons, backslashes and newlines. */
function esc(value: string): string {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Same response for a wrong token as for a missing feed: no confirmation
  // that the endpoint exists at all.
  if (!tokenMatches(token.replace(/\.ics$/, ""))) {
    return new Response("Not found", { status: 404 });
  }
  if (!databaseConfigured()) return new Response("Not found", { status: 404 });

  // A little history so past appointments don't vanish from her calendar.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const bookings = await confirmedFrom(since);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Get Lashed//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(BUSINESS.name)} bookings`,
    "X-WR-TIMEZONE:Africa/Accra",
    // Tell the phone how often to re-check. Most clients honour it loosely.
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const b of bookings) {
    const service = SERVICES.find((s) => s.id === b.serviceId);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.ref}@getlashed`,
      `DTSTAMP:${stamp(b.createdAt)}`,
      `DTSTART:${stamp(b.startsAt)}`,
      `DTEND:${stamp(b.endsAt)}`,
      `SUMMARY:${esc(`${service?.name ?? b.serviceId} — ${b.clientName}`)}`,
      `DESCRIPTION:${esc(
        [
          `Client: ${b.clientName}`,
          `Phone: ${b.phone}`,
          b.email ? `Email: ${b.email}` : null,
          b.notes ? `Notes: ${b.notes}` : null,
          `Booking ${b.ref}`,
        ]
          .filter(Boolean)
          .join("\n")
      )}`,
      `LOCATION:${esc(BUSINESS.address)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`${b.clientName} in an hour`)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
