import type { Metadata } from "next";
import { calendarConfigured, listUpcoming, type CalendarEvent } from "@/lib/google-calendar";
import { formatHours } from "@/lib/format";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Client contact details — never cache this page.
export const dynamic = "force-dynamic";

const DAYS_AHEAD = 60;

export default async function AdminPage() {
  let events: CalendarEvent[] = [];
  let error: string | null = null;

  if (!calendarConfigured()) {
    error = "GOOGLE_SERVICE_ACCOUNT_JSON isn't set, so bookings can't be listed.";
  } else {
    try {
      events = await listUpcoming(DAYS_AHEAD);
    } catch (cause) {
      console.error("[admin]", cause);
      error = "Couldn't reach Google Calendar.";
    }
  }

  const bookings = events.map((event) => {
    const startIso = event.start?.dateTime ?? `${event.start?.date}T00:00:00Z`;
    return {
      id: event.id ?? startIso,
      date: startIso.slice(0, 10),
      time: event.start?.dateTime ? formatHours(startIso.slice(11, 16)) : "All day",
      summary: event.summary ?? "(no title)",
      details: event.description ?? "",
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <AdminPanel bookings={bookings} error={error} days={DAYS_AHEAD} />
    </div>
  );
}
