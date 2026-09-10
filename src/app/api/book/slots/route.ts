import { NextResponse } from "next/server";
import { availableSlots, getService, isValidDate } from "@/lib/availability";
import { databaseConfigured } from "@/lib/db";

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

  if (!databaseConfigured()) {
    // WhatsApp is the standing fallback whenever the schedule is unreachable.
    return NextResponse.json({ slots: [], reason: "unconfigured" }, { status: 503 });
  }

  try {
    const { slots, reason } = await availableSlots(date, service);
    return NextResponse.json({ slots, reason });
  } catch (error) {
    console.error("[slots]", error);
    return NextResponse.json({ slots: [], reason: "schedule-error" }, { status: 502 });
  }
}
