import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-guard";
import { clearDateOverride, setDateOverride, setWeeklyHours } from "@/lib/bookings";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DayInput {
  weekday?: unknown;
  opens?: unknown;
  closes?: unknown;
}

/**
 * Save the studio's opening hours, or a one-off change to a single date.
 * Behind the admin session, checked here as well as in proxy.ts.
 */
export async function POST(request: Request) {
  if (!(await adminSession())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    week?: DayInput[];
    override?: { date?: unknown; opens?: unknown; closes?: unknown; note?: unknown };
    clear?: unknown;
  };

  try {
    if (Array.isArray(body.week)) {
      const week = [];
      for (const day of body.week) {
        const weekday = Number(day.weekday);
        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
          return NextResponse.json({ error: "Bad day of week." }, { status: 400 });
        }
        // Either both times or neither: neither means closed that day.
        const opens = typeof day.opens === "string" && day.opens ? day.opens : null;
        const closes = typeof day.closes === "string" && day.closes ? day.closes : null;
        if ((opens && !TIME.test(opens)) || (closes && !TIME.test(closes))) {
          return NextResponse.json({ error: "Times must look like 09:00." }, { status: 400 });
        }
        if (!!opens !== !!closes) {
          return NextResponse.json(
            { error: "Set both an opening and a closing time, or leave the day closed." },
            { status: 400 }
          );
        }
        if (opens && closes && opens >= closes) {
          return NextResponse.json(
            { error: "Closing time has to be after opening time." },
            { status: 400 }
          );
        }
        week.push({ weekday, opens, closes });
      }
      await setWeeklyHours(week);
    }

    if (typeof body.clear === "string") {
      if (!DATE.test(body.clear)) {
        return NextResponse.json({ error: "Bad date." }, { status: 400 });
      }
      await clearDateOverride(body.clear);
    }

    if (body.override) {
      const date = String(body.override.date ?? "");
      if (!DATE.test(date)) {
        return NextResponse.json({ error: "Bad date." }, { status: 400 });
      }
      const opens =
        typeof body.override.opens === "string" && body.override.opens
          ? body.override.opens
          : null;
      const closes =
        typeof body.override.closes === "string" && body.override.closes
          ? body.override.closes
          : null;
      if ((opens && !TIME.test(opens)) || (closes && !TIME.test(closes))) {
        return NextResponse.json({ error: "Times must look like 09:00." }, { status: 400 });
      }
      if (opens && closes && opens >= closes) {
        return NextResponse.json(
          { error: "Closing time has to be after opening time." },
          { status: 400 }
        );
      }
      await setDateOverride({
        date,
        opens,
        closes,
        note: typeof body.override.note === "string" ? body.override.note.slice(0, 200) : null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/schedule]", error);
    return NextResponse.json({ error: "Could not save the schedule." }, { status: 502 });
  }
}
