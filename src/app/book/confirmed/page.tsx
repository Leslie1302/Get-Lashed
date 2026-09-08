import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, DEPOSIT_GHS } from "@/lib/constants";
import { formatPrice, whatsAppUrl } from "@/lib/format";
import { confirmBooking, deleteEvent } from "@/lib/google-calendar";
import { isPaidInFull, paymentsConfigured, verifyTransaction } from "@/lib/paystack";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Outcome =
  | { state: "paid"; service?: string; date?: string; time?: string }
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
    const eventId = transaction.metadata?.eventId;

    if (isPaidInFull(transaction, DEPOSIT_GHS)) {
      if (eventId) await confirmBooking(eventId);
      return {
        state: "paid",
        service: transaction.metadata?.service,
        date: transaction.metadata?.date,
        time: transaction.metadata?.time,
      };
    }

    // Abandoned or declined: release the slot straight away rather than
    // waiting for the hold to age out, so the next client can take it.
    if (eventId && transaction.status !== "ongoing" && transaction.status !== "pending") {
      await deleteEvent(eventId).catch(() => {});
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
      <Shell heading="You're booked." eyebrow="Confirmed">
        <dl className="mt-6 grid gap-3 text-base">
          {outcome.service && <Row label="Service" value={outcome.service} />}
          {outcome.date && outcome.time && (
            <Row label="When" value={`${outcome.date} at ${outcome.time}`} />
          )}
          <Row label="Deposit" value={`${formatPrice(DEPOSIT_GHS)} paid`} />
          <Row label="Where" value={BUSINESS.address} />
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-cocoa">
          Your receipt is on its way by email. The balance is settled at the studio. Need to
          change or cancel? Message us on WhatsApp — that&rsquo;s the fastest way to reach us.
        </p>
        <Actions message={`Hi ${BUSINESS.name}! About my booking...`} />
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
