import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin-guard";
import { databaseConfigured } from "@/lib/db";
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
      "DATABASE_URL isn't set, so there's no schedule to read. Create the Neon database in Vercel and redeploy.";
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
      error =
        "Couldn't reach the database. If this is a fresh deploy, run `npm run db:setup` to create the tables.";
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
