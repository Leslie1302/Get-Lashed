"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SERVICES, WEEKDAY_ORDER } from "@/lib/constants";
import { formatHours, formatPrice } from "@/lib/format";
import type { Booking, DateOverride, DayHours } from "@/lib/bookings";
import UploadForm from "@/components/UploadForm";

const serviceName = (id: string) => SERVICES.find((s) => s.id === id)?.name ?? id;
const servicePrice = (id: string) => SERVICES.find((s) => s.id === id)?.priceGHS;

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })} · ${formatHours(iso.slice(11, 16))}`;
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function AdminPanel({
  pending,
  diary,
  hours,
  overrides,
  error,
  days,
}: {
  pending: Booking[];
  diary: Booking[];
  hours: Record<string, DayHours | null>;
  overrides: DateOverride[];
  error: string | null;
  days: number;
}) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-medium">Studio admin</h1>
        <button
          type="button"
          onClick={signOut}
          className="h-11 rounded-md border border-sand px-5 text-sm font-semibold hover:bg-linen"
        >
          Sign out
        </button>
      </div>

      {error && (
        <p className="mt-6 rounded-md bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          {error}
        </p>
      )}

      <Requests pending={pending} />
      <Diary diary={diary} days={days} />
      <Schedule hours={hours} overrides={overrides} />
      <UploadForm />
    </>
  );
}

/* ------------------------------------------------------------- requests */

function Requests({ pending }: { pending: Booking[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [reply, setReply] = useState<{ id: number; url: string; confirmed: boolean; refundOwed: boolean } | null>(
    null
  );

  async function decide(id: number, status: "confirmed" | "declined") {
    setBusy(id);
    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = (await res.json().catch(() => ({}))) as { replyUrl?: string; refundOwed?: boolean };
    setBusy(null);
    if (res.ok && data.replyUrl) {
      setReply({ id, url: data.replyUrl, confirmed: status === "confirmed", refundOwed: !!data.refundOwed });
    }
    router.refresh();
  }

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-medium">
        Requests{" "}
        {pending.length > 0 && (
          <span className="ml-1 rounded-full bg-terracotta px-2.5 py-0.5 align-middle text-sm font-semibold text-paper">
            {pending.length}
          </span>
        )}
      </h2>
      <p className="mt-2 text-sm text-cocoa">
        These slots are held while you decide. Declining frees the slot straight away.
      </p>

      {pending.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-sand bg-linen/40 px-4 py-6 text-center text-cocoa">
          Nothing waiting on you.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {pending.map((b) => (
            <li key={b.id} className="rounded-xl border border-sand bg-paper p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold">
                  {serviceName(b.serviceId)}
                  {servicePrice(b.serviceId) !== undefined && (
                    <span className="ml-2 font-normal text-cocoa">
                      {formatPrice(servicePrice(b.serviceId)!)}
                    </span>
                  )}
                </p>
                <p className="text-sm font-semibold text-terracotta">{when(b.startsAt)}</p>
              </div>
              <p className="mt-1 text-sm text-cocoa">
                {b.clientName} · {b.phone}
                {b.email ? ` · ${b.email}` : ""}
              </p>
              {b.notes && <p className="mt-1 text-sm italic text-mocha">“{b.notes}”</p>}
              <p className="mt-1 text-xs text-mocha">
                {b.ref} · asked {ago(b.createdAt)}
                {b.depositPaid && " · deposit paid"}
              </p>

              {reply?.id === b.id ? (
                <div className="mt-3 rounded-md bg-linen p-3">
                  <p className="text-sm font-semibold">
                    {reply.confirmed ? "Confirmed." : "Declined — slot is free again."}
                  </p>
                  <p className="mt-1 text-sm text-cocoa">
                    She hasn&rsquo;t been told yet — send the message below.
                  </p>
                  {reply.refundOwed && (
                    <p className="mt-2 rounded-md bg-terracotta/10 px-3 py-2 text-sm font-semibold text-terracotta">
                      This booking was paid. Refund it in your Paystack dashboard &mdash;
                      nothing here moves the money.
                    </p>
                  )}
                  <a
                    href={reply.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-10 items-center rounded-md bg-espresso px-4 text-sm font-semibold text-paper hover:bg-cocoa"
                  >
                    {reply.confirmed ? "Tell her on WhatsApp" : "Suggest another time"}
                  </a>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() => decide(b.id, "confirmed")}
                    className="h-10 rounded-md bg-terracotta px-5 text-sm font-semibold text-paper hover:bg-clay disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() => decide(b.id, "declined")}
                    className="h-10 rounded-md border border-sand px-5 text-sm font-semibold hover:bg-linen disabled:opacity-50"
                  >
                    Can&rsquo;t make it
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- diary */

function Diary({ diary, days }: { diary: Booking[]; days: number }) {
  const confirmed = diary.filter((b) => b.status === "confirmed");
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-medium">
        Diary <span className="text-mocha">· next {days} days</span>
      </h2>
      {confirmed.length === 0 ? (
        <p className="mt-5 text-cocoa">Nothing booked in yet.</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {confirmed.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg border border-sand px-4 py-3"
            >
              <span className="font-semibold">{when(b.startsAt)}</span>
              <span className="text-sm text-cocoa">
                {serviceName(b.serviceId)} — {b.clientName} · {b.phone}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- schedule */

function Schedule({
  hours,
  overrides,
}: {
  hours: Record<string, DayHours | null>;
  overrides: DateOverride[];
}) {
  const router = useRouter();
  const [week, setWeek] = useState(hours);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setDay(day: string, patch: Partial<DayHours> | null) {
    setWeek((w) => ({
      ...w,
      [day]: patch === null ? null : { opens: "09:00", closes: "18:00", ...w[day], ...patch },
    }));
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        week: WEEKDAY_ORDER.map((day, weekday) => ({
          weekday,
          opens: week[day]?.opens ?? null,
          closes: week[day]?.closes ?? null,
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setStatus(res.ok ? "Saved." : (data.error ?? "Couldn't save."));
    if (res.ok) router.refresh();
  }

  async function closeDate(form: React.FormEvent<HTMLFormElement>) {
    form.preventDefault();
    const data = new FormData(form.currentTarget);
    const date = String(data.get("date") ?? "");
    if (!date) return;
    await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        override: { date, opens: null, closes: null, note: String(data.get("note") ?? "") },
      }),
    });
    form.currentTarget.reset();
    router.refresh();
  }

  async function reopen(date: string) {
    await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clear: date }),
    });
    router.refresh();
  }

  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-medium">When you&rsquo;re open</h2>
      <p className="mt-2 text-sm text-cocoa">
        Clients can only book inside these hours. Changes apply to every future date.
      </p>

      <div className="mt-5 grid max-w-xl gap-2">
        {WEEKDAY_ORDER.map((day) => {
          const value = week[day];
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg border border-sand px-4 py-2.5">
              <span className="w-24 shrink-0 font-semibold capitalize">{day}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!value}
                  onChange={(e) => setDay(day, e.target.checked ? {} : null)}
                  className="h-4 w-4 accent-[color:var(--color-terracotta)]"
                />
                Open
              </label>
              {value && (
                <>
                  <input
                    type="time"
                    value={value.opens}
                    onChange={(e) => setDay(day, { opens: e.target.value })}
                    className="h-10 rounded-md border border-sand bg-paper px-2"
                  />
                  <span className="text-cocoa">to</span>
                  <input
                    type="time"
                    value={value.closes}
                    onChange={(e) => setDay(day, { closes: e.target.value })}
                    className="h-10 rounded-md border border-sand bg-paper px-2"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="h-11 rounded-md bg-terracotta px-6 font-semibold text-paper hover:bg-clay disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save hours"}
        </button>
        {status && <span className="text-sm text-cocoa">{status}</span>}
      </div>

      <h3 className="mt-10 font-display text-xl font-medium">Days you&rsquo;re closed</h3>
      <p className="mt-2 text-sm text-cocoa">
        Holidays, travel, anything one-off. Nobody can book these dates.
      </p>

      <form onSubmit={closeDate} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-cocoa">Date</span>
          <input
            type="date"
            name="date"
            required
            className="mt-1 block h-11 rounded-md border border-sand bg-paper px-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-cocoa">Reason (optional)</span>
          <input
            type="text"
            name="note"
            maxLength={200}
            placeholder="Public holiday"
            className="mt-1 block h-11 rounded-md border border-sand bg-paper px-3"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-md border border-sand px-5 font-semibold hover:bg-linen"
        >
          Close that day
        </button>
      </form>

      {overrides.length > 0 && (
        <ul className="mt-4 grid max-w-xl gap-2">
          {overrides.map((o) => (
            <li
              key={o.date}
              className="flex items-center justify-between gap-4 rounded-lg border border-sand px-4 py-2.5"
            >
              <span className="text-sm">
                <span className="font-semibold">{o.date}</span>
                {o.opens && o.closes ? ` · ${o.opens}–${o.closes}` : " · closed"}
                {o.note && <span className="text-cocoa"> — {o.note}</span>}
              </span>
              <button
                type="button"
                onClick={() => reopen(o.date)}
                className="text-sm font-semibold text-terracotta underline"
              >
                Undo
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
