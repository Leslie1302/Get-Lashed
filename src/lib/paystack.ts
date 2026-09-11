import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { CURRENCY, SUBUNIT, type VerifiedTransaction } from "@/lib/paystack-core";

export { CURRENCY, isPaidInFull } from "@/lib/paystack-core";
export type { VerifiedTransaction } from "@/lib/paystack-core";

/**
 * Paystack, over plain fetch. Three endpoints and an HMAC check don't justify
 * an SDK, and the official Node library pulls in a dependency tree we'd have
 * to keep patched for a site that takes one kind of payment.
 *
 * Which payment channels appear (Mobile Money, card, bank) is configured in
 * the Paystack dashboard, not here — that's the merchant's decision to make
 * and change without a deploy.
 */
const API = "https://api.paystack.co";


function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new PaymentsNotConfiguredError();
  return key;
}

export function paymentsConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super("PAYSTACK_SECRET_KEY is not set");
    this.name = "PaymentsNotConfiguredError";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      authorization: `Bearer ${secretKey()}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  });
  const body = (await res.json()) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !body.status) {
    throw new Error(`paystack ${path} failed: ${res.status} ${body.message ?? ""}`);
  }
  return body.data as T;
}

export interface InitializedTransaction {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(params: {
  email: string;
  amountGHS: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}): Promise<InitializedTransaction> {
  return api<InitializedTransaction>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountGHS * SUBUNIT),
      currency: CURRENCY,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
}

/**
 * Confirm a transaction with Paystack directly. Never trust the browser's
 * callback: anyone can open /book/confirmed?reference=… and claim a slot they
 * never paid for. The amount and currency are re-checked by the caller against
 * what we actually asked for.
 */
export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  return api<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Paystack signs webhook bodies with HMAC-SHA512 of the raw body under the
 * secret key. Verified against the exact bytes received — re-serialising the
 * JSON changes the digest and every event would be rejected.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
