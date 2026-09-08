"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/admin";
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const password = new FormData(event.currentTarget).get("password");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      // Only /admin paths, so a crafted ?next= can't bounce you off-site.
      router.replace(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
      return;
    }
    const data = (await res.json()) as { error?: string };
    setError(data.error ?? "Login failed.");
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-24">
      <h1 className="font-display text-3xl font-medium">Studio admin</h1>
      <form onSubmit={submit} className="mt-8 grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-cocoa">Password</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            autoFocus
            className="mt-2 h-12 w-full rounded-md border border-sand bg-paper px-4"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-md bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-12 rounded-md bg-terracotta font-semibold text-paper hover:bg-clay disabled:opacity-50"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
