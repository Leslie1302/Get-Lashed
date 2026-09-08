import { NextResponse } from "next/server";
import { DEPOSIT_GHS } from "@/lib/constants";
import { confirmBooking } from "@/lib/google-calendar";
import { isPaidInFull, paymentsConfigured, verifyWebhookSignature } from "@/lib/paystack";

/**
 * Paystack's server-to-server confirmation. This is not belt-and-braces: the
 * browser callback only fires if the client comes back to the site, and on a
 * phone they often don't — they pay, see the Mobile Money prompt succeed, and
 * close the tab. Without this the money is taken and the hold quietly expires.
 *
 * Point Paystack at https://<domain>/api/paystack/webhook in the dashboard.
 */
export async function POST(request: Request) {
  if (!paymentsConfigured()) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // The signature covers the exact bytes sent — read the raw body, never a
  // re-serialised object, or every event fails verification.
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    // Anyone can POST here; an unsigned request is not from Paystack.
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      metadata?: Record<string, string> | null;
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  if (event.event !== "charge.success" || !event.data) {
    return NextResponse.json({ ok: true }); // not ours to act on
  }

  const eventId = event.data.metadata?.eventId;
  const paid = isPaidInFull(
    {
      status: event.data.status ?? "",
      amount: event.data.amount ?? 0,
      currency: event.data.currency ?? "",
      reference: event.data.reference ?? "",
      metadata: event.data.metadata,
    },
    DEPOSIT_GHS
  );

  if (eventId && paid) {
    try {
      // confirmBooking is idempotent, so the callback page and this webhook
      // racing each other is harmless.
      await confirmBooking(eventId);
    } catch (error) {
      // 500 asks Paystack to retry, which is what we want if Calendar is down.
      console.error("[paystack webhook]", error);
      return NextResponse.json({ error: "could not confirm" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
