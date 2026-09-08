import { NextResponse } from "next/server";
import {
  availableSlots,
  bookableWindow,
  getService,
  isValidDate,
} from "@/lib/availability";
import { calendarConfigured } from "@/lib/google-calendar";

/** GET /api/book/slots?service=gel-manicure&date=2026-09-10 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const service = getService(params.get("service") ?? "");

  if (!service) {
    return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  }
  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
  }

  const window = bookableWindow(date, Date.now());
  if ("unavailable" in window) {
    return NextResponse.json({ slots: [], reason: window.unavailable });
  }
  if (!calendarConfigured()) {
    // WhatsApp is the standing fallback whenever the calendar is unreachable.
    return NextResponse.json({ slots: [], reason: "unconfigured" }, { status: 503 });
  }

  try {
    const slots = await availableSlots(date, service);
    return NextResponse.json({ slots, reason: slots.length ? null : "full" });
  } catch (error) {
    console.error("[slots]", error);
    return NextResponse.json({ slots: [], reason: "calendar-error" }, { status: 502 });
  }
}
