import { ADMIN_SESSION_HOURS } from "@/lib/constants";

/**
 * Signed session cookie. WebCrypto (not node:crypto) so the identical verify
 * runs in middleware on the Edge runtime and in route handlers on Node.
 *
 * Value is `<expiry base36>.<HMAC-SHA256 base64url>`. It carries no secret and
 * no client data — it only proves the server issued it and says when it dies.
 */
const encoder = new TextEncoder();

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be set to at least 32 characters");
  }
  return value;
}

export function sessionConfigured(): boolean {
  return (
    !!process.env.ADMIN_SESSION_SECRET &&
    process.env.ADMIN_SESSION_SECRET.length >= 32 &&
    !!process.env.ADMIN_PASSWORD_HASH
  );
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createSession(): Promise<{ value: string; maxAge: number }> {
  const maxAge = ADMIN_SESSION_HOURS * 3600;
  const expiry = Date.now() + maxAge * 1000;
  const payload = expiry.toString(36);
  const signature = await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload));
  return { value: `${payload}.${b64url(signature)}`, maxAge };
}

export async function verifySession(cookie: string | undefined): Promise<boolean> {
  // Missing config fails closed: no secret means nobody gets in, rather than a
  // 500 that leaks which half of the setup is missing.
  if (!cookie || !sessionConfigured()) return false;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return false;

  const expiry = parseInt(payload, 36);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  // crypto.subtle.verify is constant-time, so no separate timing-safe compare.
  const expected = await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload));
  return b64url(expected) === signature;
}
