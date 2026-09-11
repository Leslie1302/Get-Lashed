import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, CONTACT_NUMBERS, POLICY } from "@/lib/constants";
import { whatsAppUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Booking Policy",
  description: `Appointments, payment, lateness, cancellations and studio etiquette at ${BUSINESS.name}.`,
  alternates: { canonical: "/policy" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-sand pt-8">
      <h2 className="font-display text-2xl font-medium tracking-tight">{title}</h2>
      <div className="mt-4 grid gap-4 text-base leading-relaxed text-cocoa">{children}</div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <header>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
          Before you book
        </p>
        <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
          Booking Policy
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cocoa">
          Please read these carefully before securing your appointment.
        </p>
      </header>

      {/* The payment rule is the one that costs a client money if they miss it,
          so it leads rather than sitting in document order. */}
      <div className="mt-10 rounded-xl border border-terracotta/30 bg-terracotta/5 p-6">
        <p className="font-display text-xl font-medium">
          No payment = no confirmed appointment.
        </p>
        <p className="mt-2 text-base leading-relaxed text-cocoa">
          Your appointment is only confirmed once payment has been made in full. Unpaid
          bookings may be cancelled and the slot released.
        </p>
      </div>

      <div className="mt-12 grid gap-12">
        <Section title="Appointments">
          <p>
            If you cannot find a suitable slot, please call or WhatsApp{" "}
            {CONTACT_NUMBERS.map((number, i) => (
              <span key={number}>
                {i > 0 && " or "}
                <a href={`tel:${number.replace(/\s/g, "")}`} className="underline">
                  {number}
                </a>
              </span>
            ))}{" "}
            so we can check whether another option is available.
          </p>
          <p>
            If you need additional services such as toes, soak-off or pedicure, please tell us
            before your appointment so enough time can be allocated.
          </p>
        </Section>

        <Section title="Payment &amp; confirmation">
          <p>
            Online bookings are sent to us only after a successful Paystack payment. Please keep
            your Paystack payment reference for your records.
          </p>
          <p>
            Appointments are paid in full at the time of booking &mdash; the price you see on the{" "}
            <Link href="/services" className="underline">
              service list
            </Link>{" "}
            is the amount charged.
          </p>
        </Section>

        <Section title="Late arrivals">
          <p>
            A {POLICY.graceMins}-minute grace period is allowed. After {POLICY.lateCancelMins}{" "}
            minutes, your appointment may be adjusted to fit the remaining time, or cancelled.
          </p>
          <p>No refund is given for cancellations caused by excessive lateness.</p>
        </Section>

        <Section title="Cancellation &amp; rescheduling">
          <p>
            Cancellations and rescheduling must be made at least{" "}
            <strong className="font-semibold text-espresso">
              {POLICY.cancelNoticeHours} hours
            </strong>{" "}
            before your appointment to avoid losing your payment.
          </p>
          <p>Missed appointments and late cancellations may result in loss of payment.</p>
        </Section>

        <Section title="Soak-off">
          <p>
            If you have old nail enhancements that need removing, please book a soak-off or tell
            us beforehand. Soak-off is not free and requires additional time.
          </p>
          <p>
            If you need a soak-off, kindly arrive {POLICY.soakOffEarlyMins} minutes earlier.
          </p>
        </Section>

        <Section title="Guests &amp; studio etiquette">
          <ul className="grid list-disc gap-2 pl-5">
            <li>No children or pets are allowed.</li>
            <li>
              A maximum of {POLICY.maxGuests} guest is permitted per client.
            </li>
            <li>Please use earphones when watching videos or listening to music.</li>
            <li>Keep phone volume low and take calls quietly.</li>
          </ul>
          <p>We kindly ask everyone to help us keep the studio calm.</p>
        </Section>
      </div>

      <div className="mt-14 flex flex-col gap-3 border-t border-sand pt-10 sm:flex-row">
        <Link
          href="/book"
          className="inline-flex h-12 items-center justify-center rounded-md bg-terracotta px-6 font-semibold text-paper hover:bg-clay"
        >
          Book an appointment
        </Link>
        <a
          href={whatsAppUrl(`Hi ${BUSINESS.name}! I have a question about booking.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center rounded-md border border-sand px-6 font-semibold hover:bg-linen"
        >
          Ask us a question
        </a>
      </div>
    </div>
  );
}
