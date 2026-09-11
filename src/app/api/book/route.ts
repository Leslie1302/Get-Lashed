import { NextResponse } from "next/server";
import { BOOKING_GUARD, BUSINESS } from "@/lib/constants";
import { siteUrl } from "@/lib/site";
import { initializeTransaction, paymentsConfigured } from "@/lib/paystack";
import { formatHours } from "@/lib/format";
import { getService, isValidDate, verifySlot } from "@/lib/availability";
import { createPending } from "@/lib/bookings";
import { databaseConfigured } from "@/lib/db";
import { bookingMessage, bookingWhatsAppUrl } from "@/lib/booking-message";

/**
 * An unauthenticated write to the studio's real schedule. The guards below are
 * load-bearing, not polish: without them one script fills her diary with junk
 * and makes it unusable.
 *
 * ponytail: the rate limiter is a per-instance Map. That is a real ceiling —
 * Vercel can run several instances, so the effective limit is
 * maxPerIpPerHour x instances. Move to Vercel KV / Upstash if abuse gets past it.
 */
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const cutoff = Date.now() - 3_600_000;
  const recent = (attempts.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= BOOKING_GUARD.maxPerIpPerHour) {
    attempts.set(ip, recent);
    return true;
  }
  attempts.set(ip, [...recent, Date.now()]);
  if (attempts.size > 5_000) attempts.clear(); // crude cap, never unbounded
  return false;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

const NAME_MAX = 80;
const NOTES_MAX = 500;
/** Deliberately loose: Ghanaian numbers get written 024..., +233 24..., 0244-000-000. */
const PHONE = /^[+\d][\d\s()-]{7,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BookingBody {
  serviceId?: unknown;
  date?: unknown;
  time?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  notes?: unknown;
  company?: unknown; // honeypot — must stay empty
  startedAt?: unknown;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function fail(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return fail(
      "Too many booking attempts. Please try again later or message us on WhatsApp.",
      429
    );
  }

  let body: BookingBody;
  try {
    body = (await request.json()) as BookingBody;
  } catch {
    return fail("Malformed request.", 400);
  }

  // Bots fill every field they find, including the one hidden from people.
  if (str(body.company) !== "") return fail("Booking rejected.", 400);

  const elapsed = Date.now() - Number(body.startedAt ?? 0);
  if (!Number.isFinite(elapsed) || elapsed < BOOKING_GUARD.minFormMillis) {
    return fail("That was too quick — please try again.", 400);
  }
  if (elapsed > BOOKING_GUARD.maxFormMillis) {
    return fail("This form has been open too long. Please reload and try again.", 400);
  }

  const service = getService(str(body.serviceId));
  const date = str(body.date);
  const time = str(body.time);
  const name = str(body.name);
  const phone = str(body.phone);
  const email = str(body.email);
  const notes = str(body.notes);

  if (!service) return fail("Please choose a service.", 400);
  if (!isValidDate(date)) return fail("Please choose a valid date.", 400);
  if (!/^\d{2}:\d{2}$/.test(time)) return fail("Please choose a time.", 400);
  if (name.length < 2 || name.length > NAME_MAX) return fail("Please enter your name.", 400);
  if (!PHONE.test(phone)) return fail("Please enter a reachable phone number.", 400);
  if (email && !EMAIL.test(email)) return fail("That email address doesn't look right.", 400);
  if (notes.length > NOTES_MAX) return fail("Please shorten your notes.", 400);

  if (!databaseConfigured()) {
    return fail(
      `Online booking isn't switched on yet — message us on WhatsApp at ${BUSINESS.phone} and we'll book you in.`,
      503,
      "unconfigured"
    );
  }

  // Studio policy: no payment, no confirmed appointment. Payment is the full
  // service price, so there is no deposit amount to configure — the price list
  // is the only place a price lives.
  const takesPayment = paymentsConfigured();
  if (takesPayment && !EMAIL.test(email)) {
    return fail("Please enter your email — Paystack sends your payment reference there.", 400);
  }

  try {
    // Duration and end time are re-derived here from serviceId. Whatever the
    // client sent for them is ignored; its availability check was advisory.
    const slot = await verifySlot(date, time, service);
    if (!slot) {
      return fail("That slot was just taken. Please pick another time.", 409, "taken");
    }

    const created = await createPending({
      serviceId: service.id,
      startIso: slot.startIso,
      endIso: slot.endIso,
      name,
      phone,
      email: email || null,
      notes: notes || null,
    });

    // The database rejected it: two people hit the same slot at once and
    // Postgres picked a winner. Nothing here could have prevented that by
    // checking first — that is the whole point of the unique index.
    if (!created.ok) {
      return fail("That slot was just taken. Please pick another time.", 409, "taken");
    }

    const booking = created.booking;
    const payload = {
      ok: true as const,
      ref: booking.ref,
      service: service.name,
      date: dateLabel(date),
      time: formatHours(time),
    };

    // No Paystack configured: fall back to an unpaid WhatsApp request. The
    // handoff link is only ever returned on this path — when payment IS
    // required, the client must not be able to send the request without
    // paying, so the link is issued by /book/confirmed after Paystack has
    // verified the transaction, and never here.
    if (!takesPayment) {
      const message = bookingMessage({
        ref: booking.ref,
        service,
        dateLabel: dateLabel(date),
        timeLabel: formatHours(time),
        name,
        phone,
        notes: notes || null,
      });
      return NextResponse.json({ ...payload, whatsappUrl: bookingWhatsAppUrl(message) });
    }

    try {
      const transaction = await initializeTransaction({
        email,
        amountGHS: service.priceGHS,
        reference: `${booking.ref}-${Date.now().toString(36)}`,
        callbackUrl: `${siteUrl()}/book/confirmed`,
        metadata: { ref: booking.ref, service: service.name, date, time },
      });
      return NextResponse.json({ ...payload, authorizationUrl: transaction.authorization_url });
    } catch (error) {
      console.error("[book] payment init", error);
      return fail(
        `We couldn't start the payment. Please message us on WhatsApp at ${BUSINESS.phone}.`,
        502,
        "payment-error"
      );
    }
  } catch (error) {
    console.error("[book]", error);
    return fail(
      `We couldn't save your booking. Please message us on WhatsApp at ${BUSINESS.phone}.`,
      502,
      "server-error"
    );
  }
}
