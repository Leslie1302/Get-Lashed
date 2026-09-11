import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/constants";
import { verifySession } from "@/lib/session";

/**
 * The same session check proxy.ts runs, repeated inside the handler.
 *
 * That repetition is deliberate. proxy.ts is Next's middleware, and whether it
 * runs at all is the HOST's decision: Next 16 renamed `middleware.ts` to
 * `proxy.ts`, and an adapter that hasn't followed the rename skips the file in
 * silence — no error, no warning, just an unguarded route. The failure mode is
 * the worst one available here: /api/admin/bookings returns client names,
 * phone numbers and email addresses to anyone who asks, and /api/admin/schedule
 * lets them rewrite her opening hours. Under Ghana's Data Protection Act
 * (Act 843) that's our liability, and "the platform was supposed to handle it"
 * is not a defence.
 *
 * So the guard lives here too, in the app, where nothing about the deployment
 * target can switch it off. proxy.ts stays as the cheap first pass that
 * rejects before the handler ever loads.
 *
 * Kept out of session.ts on purpose: this imports next/headers, which does not
 * exist in the Edge middleware runtime that proxy.ts is bundled for.
 */
export async function adminSession(): Promise<boolean> {
  const jar = await cookies();
  return verifySession(jar.get(ADMIN_COOKIE)?.value);
}
