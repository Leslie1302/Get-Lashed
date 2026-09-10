import { BUSINESS, DEPOSIT_GHS, type Service } from "@/lib/constants";
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
  depositPaid?: boolean;
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
    DEPOSIT_GHS > 0
      ? `Deposit: ${params.depositPaid ? `${formatPrice(DEPOSIT_GHS)} paid` : "not paid"}`
      : null,
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
}): string {
  if (params.confirmed) {
    return [
      `Hi! Your ${params.serviceName} on ${params.dateLabel} at ${params.timeLabel} is confirmed.`,
      `Booking ${params.ref}.`,
      `See you at ${BUSINESS.address}.`,
    ].join(" ");
  }
  return [
    `Hi! I'm sorry — I can't make ${params.dateLabel} at ${params.timeLabel} work for your`,
    `${params.serviceName} (booking ${params.ref}).`,
    "Could we find another time? Here's what I have free:",
  ].join(" ");
}
