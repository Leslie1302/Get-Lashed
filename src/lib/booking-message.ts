import { BUSINESS, POLICY, type Service } from "@/lib/constants";
import { formatPrice, whatsAppUrl } from "@/lib/format";

/**
 * The message the client sends her on WhatsApp after booking.
 *
 * Notification lives in this one file on purpose. Today the client's own phone
 * sends it, which needs no Meta approval and no per-message cost. Swapping to
 * the WhatsApp Cloud API or an SMS gateway later means adding a sender here —
 * the booking flow itself does not change.
 */
export function bookingMessage(params: {
  ref: string;
  service: Service;
  dateLabel: string;
  timeLabel: string;
  name: string;
  phone: string;
  notes?: string | null;
  /** Paid in full online. Unpaid requests only happen when Paystack is off. */
  paid?: boolean;
}): string {
  return [
    `New booking request — ${params.ref}`,
    "",
    `${params.service.name} · ${formatPrice(params.service.priceGHS)} · ${params.service.durationMins} min`,
    `${params.dateLabel} at ${params.timeLabel}`,
    "",
    `Name: ${params.name}`,
    `Phone: ${params.phone}`,
    params.notes ? `Notes: ${params.notes}` : null,
    params.paid ? `PAID: ${formatPrice(params.service.priceGHS)}` : null,
    "",
    "Please confirm, or suggest another time.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** wa.me link that opens WhatsApp with that message ready to send to her. */
export function bookingWhatsAppUrl(message: string): string {
  return whatsAppUrl(message);
}

/** What she sends the client back once she has decided. */
export function decisionMessage(params: {
  ref: string;
  confirmed: boolean;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  /** Amount the client actually paid, in cedis. Zero when Paystack is off. */
  paidGHS?: number;
}): string {
  if (params.confirmed) {
    return [
      `Hi! Your ${params.serviceName} on ${params.dateLabel} at ${params.timeLabel} is confirmed.`,
      `Booking ${params.ref}.`,
      params.paidGHS
        ? `Payment of ${formatPrice(params.paidGHS)} received in full.`
        : null,
      `Please arrive on time — there's a ${POLICY.graceMins}-minute grace period.`,
      `See you at ${BUSINESS.address}.`,
    ]
      .filter((line) => line !== null)
      .join(" ");
  }
  return [
    `Hi! I'm sorry — I can't make ${params.dateLabel} at ${params.timeLabel} work for your`,
    `${params.serviceName} (booking ${params.ref}).`,
    // Never decline a paid booking without saying what happens to the money.
    // Silence here reads as keeping it, and she has to act on the refund in
    // Paystack herself — nothing in this app moves money back.
    params.paidGHS
      ? `Your ${formatPrice(params.paidGHS)} will be refunded in full, or I can hold it against a new time — whichever you prefer.`
      : null,
    "Could we find another time? Here's what I have free:",
  ]
    .filter((line) => line !== null)
    .join(" ");
}
