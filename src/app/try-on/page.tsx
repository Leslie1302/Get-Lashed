import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TryOn from "@/components/TryOn";

export const metadata: Metadata = {
  title: "Virtual try-on (Beta)",
  description:
    "See a nail colour or lash style on yourself, live in your browser. Nothing is recorded or uploaded.",
};

// MediaPipe touches `window`, so it must never be evaluated on the server.
// It isn't: TryOn imports it inside the Start-camera handler, not at module
// scope. That also keeps the ~10 MB payload off the initial page load, which
// is the same reason `ssr: false` is unnecessary here — and `ssr: false` is
// not allowed in a Server Component in Next 16 anyway.

export default function TryOnPage() {
  // Off unless explicitly enabled, so a bad AR day can't take the site down.
  if (process.env.NEXT_PUBLIC_ENABLE_AR !== "true") notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <header className="max-w-2xl">
        <p className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
          Try-on
          <span className="rounded-full bg-espresso px-2.5 py-1 text-[11px] tracking-normal text-paper">
            Beta
          </span>
        </p>
        <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
          See it on yourself first
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cocoa">
          Point your camera at your hand or your face and try a colour on. It all runs on your
          phone — no photo or video ever leaves your device.
        </p>
      </header>

      <div className="mt-10">
        <TryOn />
      </div>

      <p className="mt-10 text-sm leading-relaxed text-mocha">
        This is a preview, and the fit is approximate — it&rsquo;s meant for picking a colour,
        not judging a shape. Happy with one?{" "}
        <Link href="/book" className="font-semibold text-terracotta underline">
          Book it in
        </Link>
        .
      </p>
    </div>
  );
}
