import { NextResponse } from "next/server";
import { BOOKING_GUARD, BUSINESS, DEPOSIT_GHS } from "@/lib/constants";
import { siteUrl } from "@/lib/site";
import { initializeTransaction, paymentsConfigured } from "@/lib/paystack";
import { formatPrice } from "@/lib/format";
import { getService, isValidDate, verifySlot } from "@/lib/availability";
import {
  calendarConfigured,
  deleteEvent,
  freeEventId,
  insertBooking,
  slotEventId,
} from "@/lib/google-calendar";

/**
 * This route is an unauthenticated write to a live business calendar. The
 * guards below are load-bearing, not polish: without them one script fills the
 * owner's real schedule with junk and makes it unusable.
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

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return fail("Too many booking attempts. Please try again later or message us on WhatsApp.", 429);
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

  if (!calendarConfigured()) {
    return fail(
      `Online booking isn't switched on yet — message us on WhatsApp at ${BUSINESS.phone} and we'll book you in.`,
      503,
      "unconfigured"
    );
  }

  // Deposits are on only when an amount is set AND the key is present. With an
  // amount but no key, refuse rather than quietly booking people for free.
  const takesDeposit = DEPOSIT_GHS > 0;
  if (takesDeposit && !paymentsConfigured()) {
    console.error("[book] DEPOSIT_GHS is set but PAYSTACK_SECRET_KEY is missing");
    return fail(
      `Online payment isn't available right now. Please message us on WhatsApp at ${BUSINESS.phone}.`,
      503,
      "unconfigured"
    );
  }
  // Paystack sends the receipt by email, so it stops being optional.
  if (takesDeposit && !EMAIL.test(email)) {
    return fail("Please enter your email — we send the payment receipt there.", 400);
  }

  try {
    // Duration and end time are re-derived from serviceId here. Whatever the
    // client sent for them is ignored; its availability check was advisory.
    const slot = await verifySlot(date, time, service);
    if (!slot) {
      return fail("That slot was just taken. Please pick another time.", 409, "taken");
    }

    const startMs = Date.parse(slot.startIso);
    const id = (await freeEventId(startMs)) ?? slotEventId(startMs);
    const result = await insertBooking({
      id,
      // The prefix makes an unpaid hold obvious at a glance in the calendar.
      summary: `${takesDeposit ? "UNPAID · " : ""}${service.name} — ${name}`,
      description: [
        `Service: ${service.name} (${formatPrice(service.priceGHS)}, ${service.durationMins} min)`,
        `Name: ${name}`,
        `Phone: ${phone}`,
        email ? `Email: ${email}` : null,
        notes ? `Notes: ${notes}` : null,
        takesDeposit
          ? `Deposit due: ${formatPrice(DEPOSIT_GHS)} (balance ${formatPrice(
              service.priceGHS - DEPOSIT_GHS
            )} at the studio)`
          : null,
        "Booked online.",
      ]
        .filter(Boolean)
        .join("\n"),
      startIso: slot.startIso,
      endIso: slot.endIso,
      status: takesDeposit ? "tentative" : "confirmed",
    });

    if (!result.ok) {
      return fail("That slot was just taken. Please pick another time.", 409, "taken");
    }

    if (!takesDeposit) {
      return NextResponse.json({
        ok: true,
        service: service.name,
        date,
        time: slot.label,
        price: formatPrice(service.priceGHS),
      });
    }

    // The slot is now held as tentative. If anything below fails, or the
    // client never pays, the hold expires by itself after HOLD_MINUTES.
    try {
      const transaction = await initializeTransaction({
        email,
        amountGHS: DEPOSIT_GHS,
        // Unique per attempt: Paystack rejects a reused reference, and one
        // slot can legitimately be paid for twice if a first attempt failed.
        reference: `${id}-${Date.now().toString(36)}`,
        callbackUrl: `${siteUrl()}/book/confirmed`,
        metadata: { eventId: id, service: service.name, date, time: slot.time },
      });
      return NextResponse.json({ ok: true, authorizationUrl: transaction.authorization_url });
    } catch (error) {
      console.error("[book] payment init", error);
      await deleteEvent(id).catch(() => {}); // don't sit on a slot we can't sell
      return fail(
        `We couldn't start the payment. Please message us on WhatsApp at ${BUSINESS.phone}.`,
        502,
        "payment-error"
      );
    }
  } catch (error) {
    console.error("[book]", error);
    return fail(
      `We couldn't reach the calendar. Please message us on WhatsApp at ${BUSINESS.phone}.`,
      502,
      "calendar-error"
    );
  }
}
