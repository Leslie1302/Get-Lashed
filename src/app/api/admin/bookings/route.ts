import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin-guard";
import { getService } from "@/lib/availability";
import { setStatus, type BookingStatus } from "@/lib/bookings";
import { formatHours } from "@/lib/format";
import { decisionMessage } from "@/lib/booking-message";

/**
 * Confirm or decline one request. Behind the admin session, checked here as
 * well as in proxy.ts — see lib/admin-guard.ts for why both.
 *
 * Confirming greys the slot out for everyone else; declining frees it
 * immediately, because the unique index that reserves a slot only counts
 * pending and confirmed rows.
 */
export async function POST(request: Request) {
  if (!(await adminSession())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    status?: unknown;
  };

  const id = Number(body.id);
  const status = String(body.status) as BookingStatus;

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Unknown booking." }, { status: 400 });
  }
  if (!["confirmed", "declined", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Unknown decision." }, { status: 400 });
  }

  try {
    const booking = await setStatus(id, status);
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const service = getService(booking.serviceId);
    const start = new Date(booking.startsAt);

    // Hand back a ready-written reply so she can tell the client in one tap
    // rather than composing the same message every time.
    const reply = decisionMessage({
      ref: booking.ref,
      confirmed: status === "confirmed",
      serviceName: service?.name ?? booking.serviceId,
      dateLabel: start.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }),
      timeLabel: formatHours(booking.startsAt.slice(11, 16)),
      paidGHS: booking.depositPaid ? service?.priceGHS : undefined,
    });

    return NextResponse.json({
      ok: true,
      status: booking.status,
      // Declining a paid booking leaves money owed. Paystack refunds are a
      // manual action in her dashboard — this app never moves money — so the
      // panel has to say so out loud or it quietly doesn't happen.
      refundOwed: booking.depositPaid && status !== "confirmed",
      // The client's own number, so the reply opens in the right chat.
      replyUrl: `https://wa.me/${booking.phone.replace(/\D/g, "").replace(/^0/, "233")}?text=${encodeURIComponent(reply)}`,
    });
  } catch (error) {
    console.error("[admin/bookings]", error);
    return NextResponse.json({ error: "Could not save that." }, { status: 502 });
  }
}
