import { BUSINESS } from "@/lib/constants";

export function formatPrice(ghs: number): string {
  return `GH\u20b5 ${ghs.toLocaleString("en-GH")}`;
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h} hr ${m} min`;
}

export function formatHours(date: string): string {
  const [h, m] = date.split(":").map(Number);
  const isPm = h >= 12;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${isPm ? "pm" : "am"}`;
}

export function whatsAppUrl(message: string): string {
  return `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`;
}