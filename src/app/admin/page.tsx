import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin-guard";
import { databaseConfigured, isMissingTableError } from "@/lib/db";
import {
  dateOverrides,
  fallbackHours,
  pendingRequests,
  upcoming,
  weeklyHours,
  type Booking,
  type DateOverride,
  type DayHours,
} from "@/lib/bookings";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Client names and phone numbers — never cache this page.
export const dynamic = "force-dynamic";

const DAYS_AHEAD = 60;

export default async function AdminPage() {
  // Also enforced in proxy.ts. Repeated here so the page cannot be served
  // unguarded if the host skips middleware — see lib/admin-guard.ts.
  if (!(await adminSession())) redirect("/admin/login");

  let pending: Booking[] = [];
  let diary: Booking[] = [];
  let hours: Record<string, DayHours | null> = fallbackHours();
  let overrides: DateOverride[] = [];
  let error: string | null = null;

  if (!databaseConfigured()) {
    error =
      "DATABASE_URL isn't set, so there's no schedule to read. Add it in Netlify (Site configuration \u2192 Environment variables) and redeploy.";
  } else {
    try {
      [pending, diary, hours, overrides] = await Promise.all([
        pendingRequests(),
        upcoming(DAYS_AHEAD),
        weeklyHours(),
        dateOverrides(),
      ]);
    } catch (cause) {
      console.error("[admin]", cause);
      error = isMissingTableError(cause)
        ? "Connected to the database, but the tables don't exist yet. Run `npm run db:setup` once from the project folder, with DATABASE_URL set in .env.local."
        : "Couldn't reach the database. Check DATABASE_URL is Neon's POOLED connection string and that the Neon project isn't suspended.";
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <AdminPanel
        pending={pending}
        diary={diary}
        hours={hours}
        overrides={overrides}
        error={error}
        days={DAYS_AHEAD}
      />
    </div>
  );
}
