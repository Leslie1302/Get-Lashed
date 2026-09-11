import type { Metadata } from "next";
import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import { BUSINESS, SCHEDULE } from "@/lib/constants";
import { whatsAppUrl } from "@/lib/format";
import { paymentsConfigured } from "@/lib/paystack";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: `Book nails, lashes or pedi-mani with ${BUSINESS.name} in Accra — pick a service, a day and a time, or message us on WhatsApp.`,
};

export default function BookPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">Booking</p>
        <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
          Book your appointment
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cocoa">
          Three steps, about a minute. We need{" "}
          {SCHEDULE.minLeadTimeHours === 24
            ? "a day's"
            : `${SCHEDULE.minLeadTimeHours} hours'`}{" "}
          notice, and you can book up to {SCHEDULE.maxAdvanceDays} days ahead.
        </p>
        <p className="mt-4 rounded-md bg-linen px-4 py-3 text-sm text-cocoa">
          Booking around a public holiday? Message us on WhatsApp first — holidays
          aren&rsquo;t blocked out in the online diary, so a slot showing free may not be.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {/* Ahead of the form, not after it: the payment and cancellation
              terms only protect the studio if they were readable BEFORE the
              client paid. */}
          <Link
            href="/policy"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border-2 border-terracotta px-6 font-semibold text-terracotta hover:bg-terracotta/10"
          >
            Read the booking policy
          </Link>
          <a
            href={whatsAppUrl(`Hi ${BUSINESS.name}! I'd like to book an appointment.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-espresso px-6 font-semibold text-paper hover:bg-cocoa"
          >
            Or book on WhatsApp
          </a>
        </div>
      </header>

      <div className="mt-12">
        <BookingForm paymentRequired={paymentsConfigured()} />
      </div>
    </div>
  );
}
