"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  past: "That date has already passed.",
  "too-far": `We only take bookings up to ${SCHEDULE.maxAdvanceDays} days ahead.`,
  "too-late": `Too late to book that day — we need ${
    SCHEDULE.minLeadTimeHours === 24 ? "a day's" : `${SCHEDULE.minLeadTimeHours} hours'`
  } notice. Try a later date, or ask on WhatsApp.`,
  full: "Fully booked that day. Try another date.",
  unconfigured: "Online booking isn't switched on yet.",
  "schedule-error": "We couldn't load times just now.",
};

/**
 * The bookable date range, resolved in the browser.
 *
 * /book is prerendered, so anything computed during render is frozen at BUILD
 * time — a week-old deploy offered a date picker whose earliest date was a week
 * in the past. Reading the clock during render is also a hydration mismatch,
 * since the server's "today" and the visitor's need not agree. Both problems
 * go away by filling these in after mount; until then the input simply has no
 * limits, and the server re-checks the date anyway.
 */
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Nothing to subscribe to: the value is fixed for the life of the page. */
const noSubscribe = () => () => {};
const noServerValue = () => undefined;

function useDateRange(): { min?: string; max?: string } {
  // useSyncExternalStore is the primitive for "a value the server cannot know":
  // the server snapshot is undefined, the client's is today's date, and React
  // fills it in after hydration without a mismatch. Each snapshot returns the
  // same string all day, so it is stable enough to compare by identity.
  const min = useSyncExternalStore(noSubscribe, () => isoDay(Date.now()), noServerValue);
  const max = useSyncExternalStore(
    noSubscribe,
    () => isoDay(Date.now() + SCHEDULE.maxAdvanceDays * 86_400_000),
    noServerValue
  );
  return { min, max };
}

export default function BookingForm() {
  const dateRange = useDateRange();
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slotState, setSlotState] = useState<SlotState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    ref: string;
    service: string;
    date: string;
    time: string;
    whatsappUrl: string;
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
          return setSlotState({ status: "error", reason: data.reason ?? "schedule-error" });
        }
        setSlotState({ status: "empty", reason: data.reason ?? "full" });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSlotState({ status: "error", reason: "schedule-error" });
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
        ref?: string;
        service?: string;
        date?: string;
        time?: string;
        whatsappUrl?: string;
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
          ref: data.ref!,
          service: data.service!,
          date: data.date!,
          time: data.time!,
          whatsappUrl: data.whatsappUrl!,
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
          Request sent
        </p>
        <h2 className="mt-3 font-display text-3xl font-medium">
          One more tap to lock it in.
        </h2>
        <dl className="mt-6 grid gap-3 text-base">
          <Row label="Service" value={confirmed.service} />
          <Row label="When" value={`${confirmed.date} at ${confirmed.time}`} />
          <Row label="Reference" value={confirmed.ref} />
          <Row label="Where" value={BUSINESS.address} />
        </dl>

        <p className="mt-6 text-sm leading-relaxed text-cocoa">
          Your slot is held. Send the request on WhatsApp and she&rsquo;ll confirm the time
          with you directly — usually within a few hours. If the time doesn&rsquo;t suit
          her, she&rsquo;ll suggest another in the same chat.
        </p>

        {/* The whole point of the screen. Prominent, and the message is already
            written — the client only has to press send. */}
        <a
          href={confirmed.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-terracotta px-8 text-base font-semibold text-paper hover:bg-clay sm:w-auto"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.47 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.11 3.22 5.11 4.51.71.31 1.27.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.04 2h-.02C6.4 2 2 6.4 2 12.02c0 1.76.47 3.49 1.36 5.02L2 22l5.05-1.32a9.94 9.94 0 0 0 4.99 1.27h.02C17.6 22 22 17.6 22 11.98 22 6.4 17.6 2 12.04 2zm0 18.2h-.02c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3 .79.8-2.92-.2-.3a8.18 8.18 0 0 1-1.25-4.41C7.1 6.3 9.33 4.07 12.04 4.07c2.71 0 4.94 2.23 4.97 4.94 0 2.71-2.24 4.94-4.97 4.94z" />
          </svg>
          Send the request on WhatsApp
        </a>

        <p className="mt-4 text-xs leading-relaxed text-mocha">
          Didn&rsquo;t send? Your request is saved either way under{" "}
          <span className="font-semibold">{confirmed.ref}</span> — she&rsquo;ll see it. But
          sending gets you an answer far quicker.
        </p>
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
            min={dateRange.min}
            max={dateRange.max}
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
