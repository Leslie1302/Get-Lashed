import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, POLICY } from "@/lib/constants";
import { formatPrice, whatsAppUrl } from "@/lib/format";
import { findByRef, markDepositPaid, setStatus } from "@/lib/bookings";
import { getService } from "@/lib/availability";
import { bookingMessage, bookingWhatsAppUrl } from "@/lib/booking-message";
import { formatHours } from "@/lib/format";
import { isPaidInFull, paymentsConfigured, verifyTransaction } from "@/lib/paystack";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Outcome =
  | {
      state: "paid";
      service: string;
      when: string;
      amountGHS: number;
      /** Pre-written request to her, unlocked only by a verified payment. */
      whatsappUrl: string;
    }
  | { state: "failed" }
  | { state: "missing" };

/**
 * Paystack sends the client back here after payment. The reference in the URL
 * is checked against Paystack's own API before anything is confirmed — the
 * query string is attacker-controlled, so a booking must never be confirmed on
 * its say-so.
 */
async function settle(reference: string | undefined): Promise<Outcome> {
  if (!reference || !paymentsConfigured()) return { state: "missing" };

  try {
    const transaction = await verifyTransaction(reference);
    const ref = transaction.metadata?.ref;
    const booking = ref ? await findByRef(ref) : null;
    const service = booking && getService(booking.serviceId);

    // Expected amount comes from the booking's own service — the full price.
    // Reading it from the query string or the transaction would let anyone
    // confirm a booking by paying a pesewa.
    if (service && booking && isPaidInFull(transaction, service.priceGHS)) {
      await markDepositPaid(booking.ref);

      const date = new Date(booking.startsAt);
      const dateLabel = date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      });
      const timeLabel = formatHours(booking.startsAt.slice(11, 16));

      return {
        state: "paid",
        service: service.name,
        when: `${dateLabel} at ${timeLabel}`,
        amountGHS: service.priceGHS,
        whatsappUrl: bookingWhatsAppUrl(
          bookingMessage({
            ref: booking.ref,
            service,
            dateLabel,
            timeLabel,
            name: booking.clientName,
            phone: booking.phone,
            notes: booking.notes,
            paid: true,
          })
        ),
      };
    }

    // Abandoned or declined: release the slot straight away rather than
    // waiting for the hold to age out, so the next client can take it.
    if (ref && transaction.status !== "ongoing" && transaction.status !== "pending") {
      const booking = await findByRef(ref);
      if (booking?.status === "pending") await setStatus(booking.id, "cancelled").catch(() => {});
    }
    return { state: "failed" };
  } catch (error) {
    console.error("[confirmed]", error);
    return { state: "failed" };
  }
}

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const outcome = await settle(params.reference ?? params.trxref);

  if (outcome.state === "paid") {
    return (
      <Shell heading="Payment received." eyebrow="One step left">
        <dl className="mt-6 grid gap-3 text-base">
          <Row label="Service" value={outcome.service} />
          <Row label="When" value={outcome.when} />
          <Row label="Paid" value={`${formatPrice(outcome.amountGHS)} in full`} />
          <Row label="Where" value={BUSINESS.address} />
        </dl>

        <div className="mt-8 rounded-xl border border-terracotta/30 bg-terracotta/5 p-5">
          <p className="font-semibold">Send your request so we can confirm the time.</p>
          <p className="mt-1 text-sm leading-relaxed text-cocoa">
            Your payment is received and the slot is held for you. Tap below and send the
            message &mdash; it&rsquo;s already written. We&rsquo;ll reply on WhatsApp to confirm.
          </p>
          <a
            href={outcome.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-espresso px-6 font-semibold text-paper hover:bg-cocoa"
          >
            Send my request on WhatsApp
          </a>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-cocoa">
          Keep your Paystack payment reference. To cancel or move your appointment without
          losing your payment, message us at least {POLICY.cancelNoticeHours} hours before.
          Full terms are on our <Link href="/policy" className="underline">booking policy</Link>.
        </p>
      </Shell>
    );
  }

  return (
    <Shell
      heading={outcome.state === "missing" ? "Nothing to confirm" : "That payment didn't go through"}
      eyebrow="Booking"
    >
      <p className="mt-4 text-base leading-relaxed text-cocoa">
        {outcome.state === "missing"
          ? "This page confirms a booking after payment. If you were booking, start again from the booking page."
          : "No payment was taken and the slot has been released, so nothing has been charged. You can try again, or message us on WhatsApp and we'll book you in directly."}
      </p>
      <Actions message={`Hi ${BUSINESS.name}! I'd like to book an appointment.`} />
    </Shell>
  );
}

function Shell({
  eyebrow,
  heading,
  children,
}: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">{eyebrow}</p>
      <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
        {heading}
      </h1>
      {children}
    </div>
  );
}

function Actions({ message }: { message: string }) {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <a
        href={whatsAppUrl(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 items-center justify-center rounded-md bg-espresso px-6 font-semibold text-paper hover:bg-cocoa"
      >
        Message us on WhatsApp
      </a>
      <Link
        href="/book"
        className="inline-flex h-12 items-center justify-center rounded-md border border-sand px-6 font-semibold hover:bg-linen"
      >
        Back to booking
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-24 shrink-0 font-semibold text-cocoa">{label}</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  );
}
