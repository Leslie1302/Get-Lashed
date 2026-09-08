"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BUSINESS,
  DEPOSIT_GHS,
  SCHEDULE,
  SERVICES,
  SERVICE_CATEGORIES,
  type Service,
} from "@/lib/constants";
import { formatDuration, formatPrice, whatsAppUrl } from "@/lib/format";

interface Slot {
  time: string;
  label: string;
  startIso: string;
  endIso: string;
}

type SlotState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; slots: Slot[] }
  | { status: "empty"; reason: string }
  | { status: "error"; reason: string };

const REASON_TEXT: Record<string, string> = {
  closed: "We're closed on that day. Try another date.",
  blackout: "We're not taking bookings on that date.",
  past: "That date has already passed.",
  "too-far": `We only take bookings up to ${SCHEDULE.maxAdvanceDays} days ahead.`,
  "too-late": `Too late to book that day — we need ${
    SCHEDULE.minLeadTimeHours === 24 ? "a day's" : `${SCHEDULE.minLeadTimeHours} hours'`
  } notice. Try a later date, or ask on WhatsApp.`,
  full: "Fully booked that day. Try another date.",
  unconfigured: "Online booking isn't switched on yet.",
  "calendar-error": "We couldn't load times just now.",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function maxISO(): string {
  return new Date(Date.now() + SCHEDULE.maxAdvanceDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export default function BookingForm() {
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slotState, setSlotState] = useState<SlotState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    service: string;
    date: string;
    time: string;
    price: string;
  } | null>(null);

  // Submit-timing check: the server rejects anything filled implausibly fast.
  // Stamped on mount, not during render — render must stay pure.
  const startedAt = useRef(0);
  const slotsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Only fetches. The "loading" and "idle" transitions happen in the event
  // handlers that cause them, so this effect never sets state synchronously.
  useEffect(() => {
    if (!service || !date) return;
    const controller = new AbortController();

    fetch(`/api/book/slots?service=${encodeURIComponent(service.id)}&date=${date}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as { slots?: Slot[]; reason?: string };
        if (data.slots?.length) return setSlotState({ status: "ready", slots: data.slots });
        if (!res.ok) {
          return setSlotState({ status: "error", reason: data.reason ?? "calendar-error" });
        }
        setSlotState({ status: "empty", reason: data.reason ?? "full" });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSlotState({ status: "error", reason: "calendar-error" });
      });

    return () => controller.abort();
  }, [service, date]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!service || !date || !time) return;
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          date,
          time,
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email"),
          notes: form.get("notes"),
          company: form.get("company"),
          startedAt: startedAt.current,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        authorizationUrl?: string;
        service?: string;
        date?: string;
        time?: string;
        price?: string;
      };

      // With a deposit due, the slot is held and the client goes to Paystack.
      // Stay in "submitting" through the redirect so the button can't be
      // pressed twice and hold two slots.
      if (data.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }

      if (data.ok) {
        setConfirmed({
          service: data.service!,
          date: data.date!,
          time: data.time!,
          price: data.price!,
        });
        return;
      }

      setError(data.error ?? "Something went wrong.");
      if (data.code === "taken") {
        // The slot list is now stale — refetch by nudging the effect.
        setTime("");
        setSlotState({ status: "loading" });
        setDate((d) => d);
        const refreshed = await fetch(
          `/api/book/slots?service=${encodeURIComponent(service.id)}&date=${date}`
        ).then((r) => r.json() as Promise<{ slots?: Slot[]; reason?: string }>);
        setSlotState(
          refreshed.slots?.length
            ? { status: "ready", slots: refreshed.slots }
            : { status: "empty", reason: refreshed.reason ?? "full" }
        );
        slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } catch {
      setError("We couldn't reach the studio. Please try WhatsApp below.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-sand bg-linen/60 p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
          You&rsquo;re booked
        </p>
        <h2 className="mt-3 font-display text-3xl font-medium">See you soon.</h2>
        <dl className="mt-6 grid gap-3 text-base">
          <Row label="Service" value={confirmed.service} />
          <Row label="When" value={`${confirmed.date} at ${confirmed.time}`} />
          <Row label="Price" value={confirmed.price} />
          <Row label="Where" value={BUSINESS.address} />
        </dl>
        <p className="mt-6 text-sm leading-relaxed text-cocoa">
          Need to change or cancel? Message us on WhatsApp — that&rsquo;s the fastest way to
          reach us.
        </p>
        <a
          href={whatsAppUrl(
            `Hi ${BUSINESS.name}! About my ${confirmed.service} booking on ${confirmed.date} at ${confirmed.time}...`
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-12 items-center rounded-md bg-espresso px-6 font-semibold text-paper hover:bg-cocoa"
        >
          Message us on WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-10">
      <fieldset>
        <legend className="font-display text-2xl font-medium">1. Pick a service</legend>
        <div className="mt-5 grid gap-6">
          {SERVICE_CATEGORIES.map((category) => (
            <div key={category.id}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mocha">
                {category.label}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {SERVICES.filter((s) => s.category === category.id).map((s) => (
                  <label
                    key={s.id}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      service?.id === s.id
                        ? "border-terracotta bg-linen"
                        : "border-sand hover:border-mocha"
                    }`}
                  >
                    <input
                      type="radio"
                      name="service"
                      value={s.id}
                      checked={service?.id === s.id}
                      onChange={() => {
                        setService(s);
                        setTime("");
                        setSlotState(date ? { status: "loading" } : { status: "idle" });
                      }}
                      className="sr-only"
                    />
                    <span className="block font-semibold">{s.name}</span>
                    <span className="mt-1 block text-sm text-cocoa">
                      {formatPrice(s.priceGHS)} · {formatDuration(s.durationMins)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={!service} className="disabled:opacity-45">
        <legend className="font-display text-2xl font-medium">2. Pick a date &amp; time</legend>
        <label className="mt-5 block max-w-xs">
          <span className="text-sm font-semibold text-cocoa">Date</span>
          {/* Native date input — no picker library, and Android renders its own. */}
          <input
            type="date"
            name="date"
            value={date}
            min={todayISO()}
            max={maxISO()}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
              setSlotState(
                service && e.target.value ? { status: "loading" } : { status: "idle" }
              );
            }}
            required
            className="mt-2 h-12 w-full rounded-md border border-sand bg-paper px-4"
          />
        </label>

        <div ref={slotsRef} className="mt-6" aria-live="polite">
          {slotState.status === "loading" && (
            <p className="text-sm text-cocoa">Checking the diary…</p>
          )}
          {slotState.status === "ready" && (
            <div className="flex flex-wrap gap-2">
              {slotState.slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setTime(slot.time)}
                  aria-pressed={time === slot.time}
                  className={`h-12 rounded-md border px-5 font-semibold ${
                    time === slot.time
                      ? "border-terracotta bg-terracotta text-paper"
                      : "border-sand hover:border-terracotta hover:text-terracotta"
                  }`}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          )}
          {(slotState.status === "empty" || slotState.status === "error") && (
            <div className="rounded-xl border border-dashed border-sand bg-linen/50 p-5">
              <p className="font-semibold">
                {REASON_TEXT[slotState.reason] ?? "No times available."}
              </p>
              <a
                href={whatsAppUrl(
                  `Hi ${BUSINESS.name}! I'd like to book ${service?.name ?? "an appointment"}${
                    date ? ` around ${date}` : ""
                  }.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block font-semibold text-terracotta underline"
              >
                Ask us on WhatsApp instead →
              </a>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset disabled={!time} className="disabled:opacity-45">
        <legend className="font-display text-2xl font-medium">3. Your details</legend>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="name" required autoComplete="name" maxLength={80} />
          <Field
            label="Phone (WhatsApp)"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="024 000 0000"
          />
          <Field
            label={DEPOSIT_GHS > 0 ? "Email (for your receipt)" : "Email (optional)"}
            name="email"
            type="email"
            required={DEPOSIT_GHS > 0}
            autoComplete="email"
            className="sm:col-span-2"
          />
          <label className="sm:col-span-2 block">
            <span className="text-sm font-semibold text-cocoa">
              Anything we should know? (optional)
            </span>
            <textarea
              name="notes"
              rows={3}
              maxLength={500}
              className="mt-2 w-full rounded-md border border-sand bg-paper px-4 py-3"
            />
          </label>
        </div>

        {/* Honeypot: hidden from people, irresistible to bots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-md bg-terracotta/10 px-4 py-3 text-terracotta">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !time}
          className="mt-6 inline-flex h-14 items-center rounded-md bg-terracotta px-10 text-base font-semibold text-paper hover:bg-clay disabled:opacity-50"
        >
          {submitting
            ? DEPOSIT_GHS > 0
              ? "Taking you to payment…"
              : "Booking…"
            : DEPOSIT_GHS > 0
              ? `Pay ${formatPrice(DEPOSIT_GHS)} deposit`
              : "Confirm booking"}
        </button>
        {DEPOSIT_GHS > 0 && service && (
          <p className="mt-3 text-sm text-cocoa">
            A {formatPrice(DEPOSIT_GHS)} deposit confirms your slot. The balance of{" "}
            {formatPrice(service.priceGHS - DEPOSIT_GHS)} is settled at the studio. Your slot is
            held while you pay.
          </p>
        )}
        <p className="mt-3 text-sm text-cocoa">
          Prefer to chat?{" "}
          <a
            href={whatsAppUrl(`Hi ${BUSINESS.name}! I'd like to book an appointment.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-terracotta underline"
          >
            Book on WhatsApp
          </a>{" "}
          or see our <Link href="/services" className="underline">full price list</Link>.
        </p>
      </fieldset>
    </form>
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

function Field({
  label,
  className = "",
  ...props
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-cocoa">{label}</span>
      <input
        {...props}
        className="mt-2 h-12 w-full rounded-md border border-sand bg-paper px-4"
      />
    </label>
  );
}
