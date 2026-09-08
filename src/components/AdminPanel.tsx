"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SERVICE_CATEGORIES } from "@/lib/constants";

export interface AdminBooking {
  id: string;
  date: string;
  time: string;
  summary: string;
  details: string;
}

export default function AdminPanel({
  bookings,
  error,
  days,
}: {
  bookings: AdminBooking[];
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

      <section className="mt-12">
        <h2 className="font-display text-2xl font-medium">
          Bookings <span className="text-mocha">· next {days} days</span>
        </h2>

        {error && (
          <p className="mt-4 rounded-md bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            {error}
          </p>
        )}

        {!error && bookings.length === 0 && (
          <p className="mt-4 text-cocoa">Nothing booked yet.</p>
        )}

        {bookings.length > 0 && (
          <ul className="mt-5 grid gap-3">
            {bookings.map((booking) => (
              <li key={booking.id} className="rounded-xl border border-sand p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold">{booking.summary}</p>
                  <p className="text-sm font-semibold text-terracotta">
                    {booking.date} · {booking.time}
                  </p>
                </div>
                {booking.details && (
                  <pre className="mt-2 whitespace-pre-wrap font-body text-sm text-cocoa">
                    {booking.details}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <UploadForm />
    </>
  );
}

function UploadForm() {
  const router = useRouter();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus({ kind: "busy" });

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      body: new FormData(form),
    });
    if (res.ok) {
      form.reset();
      setStatus({ kind: "done" });
      router.refresh();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setStatus({ kind: "error", message: data.error ?? "Upload failed." });
  }

  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl font-medium">Add a portfolio photo</h2>
      <p className="mt-2 text-sm text-cocoa">
        Goes straight to Cloudinary and appears on the portfolio page. The category you pick
        becomes its tag.
      </p>

      <form onSubmit={upload} className="mt-5 grid max-w-lg gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-cocoa">Photo</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="mt-2 block w-full text-sm file:mr-4 file:h-11 file:rounded-md file:border-0 file:bg-espresso file:px-5 file:font-semibold file:text-paper"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-cocoa">Category</span>
          <select
            name="category"
            required
            defaultValue=""
            className="mt-2 h-12 w-full rounded-md border border-sand bg-paper px-4"
          >
            <option value="" disabled>
              Choose one
            </option>
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-cocoa">Caption (optional)</span>
          <input
            type="text"
            name="caption"
            maxLength={200}
            className="mt-2 h-12 w-full rounded-md border border-sand bg-paper px-4"
          />
        </label>

        {status.kind === "error" && (
          <p role="alert" className="rounded-md bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            {status.message}
          </p>
        )}
        {status.kind === "done" && (
          <p className="rounded-md bg-linen px-4 py-3 text-sm font-semibold">Uploaded.</p>
        )}

        <button
          type="submit"
          disabled={status.kind === "busy"}
          className="h-12 rounded-md bg-terracotta font-semibold text-paper hover:bg-clay disabled:opacity-50"
        >
          {status.kind === "busy" ? "Uploading…" : "Upload"}
        </button>
      </form>
    </section>
  );
}
