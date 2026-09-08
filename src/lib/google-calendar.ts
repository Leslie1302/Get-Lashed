import "server-only";
import { createSign } from "node:crypto";
import { CALENDAR_ID } from "@/lib/constants";

/** Accra is UTC+0 with no DST — but never let Google infer it. Always send this. */
export const TIME_ZONE = "Africa/Accra";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Service account only. A refresh token issued against a consent screen in
 * Testing status dies after 7 days, which would take the booking flow down the
 * week after launch. Share the business calendar with the service account's
 * email ("Make changes to events") instead. No refresh flow exists here.
 */
function credentials(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  const creds = JSON.parse(raw) as { client_email: string; private_key: string };
  // Vercel env vars keep newlines escaped; a real PEM needs them literal.
  return { ...creds, private_key: creds.private_key.replace(/\\n/g, "\n") };
}

export function calendarConfigured(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

// ponytail: one process-wide token, refreshed a minute early. Tokens last an
// hour and are per-service-account, so there is nothing to key this by.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const creds = credentials();
  if (!creds) throw new CalendarNotConfiguredError();

  const now = Math.floor(Date.now() / 1000);
  const payload = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  )}`;
  const signature = b64url(
    createSign("RSA-SHA256").update(payload).sign(creds.private_key)
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${payload}.${signature}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

export class CalendarNotConfiguredError extends Error {
  constructor() {
    super("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    this.name = "CalendarNotConfiguredError";
  }
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${await accessToken()}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
}

export interface BusyInterval {
  start: number;
  end: number;
}

/**
 * How long an unpaid booking holds its slot. A client sent to Paystack may
 * never come back — they close the tab, the network drops, the card fails. The
 * hold is a `tentative` Calendar event, and once it is older than this it
 * stops counting as busy, so the slot frees itself with no database and no
 * cron job.
 *
 * ponytail: expiry is evaluated at read time, not swept. A stale hold stays
 * visible in the calendar (its summary is prefixed UNPAID) until the slot is
 * rebooked or the owner deletes it — deliberate, so a payment that succeeds
 * late is still visible rather than silently vanishing.
 */
export const HOLD_MINUTES = 15;

/** False once an unpaid hold has expired and its slot is available again. */
function holdsSlot(event: CalendarEvent, now: number): boolean {
  if (event.status !== "tentative") return true;
  const created = Date.parse(event.created ?? "");
  if (!Number.isFinite(created)) return true; // unknown age: treat as busy
  return now - created < HOLD_MINUTES * 60_000;
}

/** Busy intervals (ms epoch) between two instants. Cancelled events excluded. */
export async function getBusy(timeMinIso: string, timeMaxIso: string): Promise<BusyInterval[]> {
  const qs = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    timeZone: TIME_ZONE,
    singleEvents: "true",
    maxResults: "250",
  });
  const res = await api(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${qs}`);
  if (!res.ok) throw new Error(`calendar list failed: ${res.status} ${await res.text()}`);

  const now = Date.now();
  const data = (await res.json()) as { items?: CalendarEvent[] };
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && holdsSlot(e, now))
    .map((e) => ({
      // An all-day event blocks the whole day.
      start: new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`).getTime(),
      end: new Date(e.end?.dateTime ?? `${e.end?.date}T00:00:00Z`).getTime(),
    }))
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end));
}

export interface CalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  /** RFC3339 creation time, used to expire unpaid holds. */
  created?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/** Upcoming events, newest first, for the admin bookings view. */
export async function listUpcoming(days: number): Promise<CalendarEvent[]> {
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  const qs = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: until.toISOString(),
    timeZone: TIME_ZONE,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await api(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${qs}`);
  if (!res.ok) throw new Error(`calendar list failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { items?: CalendarEvent[] };
  return (data.items ?? []).filter((e) => e.status !== "cancelled");
}

/**
 * Deterministic event id from the slot start. Calendar ids allow only a-v and
 * 0-9, which is exactly base32hex, so `toString(32)` is safe. Two simultaneous
 * bookings for one slot therefore collide inside Google — the loser gets 409 —
 * instead of racing between a list and an insert.
 */
export function slotEventId(startMs: number, attempt = 0): string {
  const base = `bk${Math.floor(startMs / 1000).toString(32)}`;
  return attempt === 0 ? base : `${base}r${attempt}`;
}

export type InsertResult = { ok: true; id: string } | { ok: false; reason: "taken" };

export async function insertBooking(params: {
  id: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  /** "tentative" marks an unpaid hold; it expires after HOLD_MINUTES. */
  status?: "confirmed" | "tentative";
}): Promise<InsertResult> {
  const res = await api(`/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
    method: "POST",
    body: JSON.stringify({
      id: params.id,
      summary: params.summary,
      description: params.description,
      status: params.status ?? "confirmed",
      start: { dateTime: params.startIso, timeZone: TIME_ZONE },
      end: { dateTime: params.endIso, timeZone: TIME_ZONE },
    }),
  });
  if (res.status === 409) return { ok: false, reason: "taken" };
  if (!res.ok) throw new Error(`calendar insert failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { ok: true, id: data.id };
}

/**
 * A cancelled event keeps its id forever, so rebooking a freed slot needs a
 * suffix. Only bump past ids we can confirm are cancelled — never past a live
 * booking, or we would double-book the slot under a different id.
 */
export async function freeEventId(startMs: number): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = slotEventId(startMs, attempt);
    const res = await api(
      `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`
    );
    if (res.status === 404) return id;
    if (!res.ok) throw new Error(`calendar get failed: ${res.status} ${await res.text()}`);
    const event = (await res.json()) as CalendarEvent;

    // An expired unpaid hold is as good as free: delete it so its id can be
    // reused, rather than burning a suffix on every abandoned payment.
    if (event.status === "tentative" && !holdsSlot(event, Date.now())) {
      await deleteEvent(id);
      return id;
    }
    if (event.status !== "cancelled") return null; // slot genuinely taken
  }
  return null;
}

/** Promote a paid hold to a real booking. Safe to call twice. */
export async function confirmBooking(id: string): Promise<void> {
  const res = await api(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`
  );
  if (!res.ok) throw new Error(`calendar get failed: ${res.status} ${await res.text()}`);
  const event = (await res.json()) as CalendarEvent;
  if (event.status === "confirmed") return;

  const patch = await api(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "confirmed",
        summary: (event.summary ?? "").replace(/^UNPAID · /, ""),
        description: `${event.description ?? ""}\nDeposit paid online.`.trim(),
      }),
    }
  );
  if (!patch.ok) throw new Error(`calendar patch failed: ${patch.status} ${await patch.text()}`);
}

/** Release a hold whose payment failed or was abandoned. */
export async function deleteEvent(id: string): Promise<void> {
  const res = await api(
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  // 404/410 mean it is already gone, which is the outcome we wanted.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`calendar delete failed: ${res.status} ${await res.text()}`);
  }
}
