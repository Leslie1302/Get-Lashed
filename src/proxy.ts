import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE } from "@/lib/constants";
import { verifySession } from "@/lib/session";

/**
 * Every /admin and /api/admin request is checked here, before the page or
 * route handler runs. A client-side redirect is decoration, not protection —
 * /admin lists client names and phone numbers.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The login page and the login/logout endpoints must stay reachable.
  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout"
  ) {
    return NextResponse.next();
  }

  if (await verifySession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
