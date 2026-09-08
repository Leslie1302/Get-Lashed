import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/constants";
import { verifyPassword } from "@/lib/admin-password";
import { createSession, sessionConfigured } from "@/lib/session";

/** ponytail: per-instance throttle, same ceiling as the booking limiter. */
const failures = new Map<string, number[]>();
const MAX_FAILURES = 8;

function tooManyFailures(ip: string): boolean {
  const recent = (failures.get(ip) ?? []).filter((t) => t > Date.now() - 900_000);
  failures.set(ip, recent);
  return recent.length >= MAX_FAILURES;
}

function recordFailure(ip: string) {
  failures.set(ip, [...(failures.get(ip) ?? []), Date.now()]);
  if (failures.size > 1_000) failures.clear();
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (tooManyFailures(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait 15 minutes." },
      { status: 429 }
    );
  }
  if (!sessionConfigured()) {
    return NextResponse.json(
      { error: "Admin isn't configured. Set ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyPassword(password)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  const session = await createSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: session.maxAge,
  });
  return response;
}
