// Every admin surface must check the session itself, not only in proxy.ts.
//
// proxy.ts is Next middleware, and whether the host runs it is the host's
// decision — Next 16 renamed middleware.ts to proxy.ts, and an adapter that
// hasn't followed the rename skips it silently. If that happens and a handler
// has no guard of its own, /api/admin/bookings hands client names and phone
// numbers to anyone who asks. Nothing about that failure is visible in a build
// log, so it gets caught here instead.
//
// This mainly exists to catch the NEXT admin route somebody adds.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Reachable before sign-in by definition.
const EXEMPT = new Set(["src/app/api/admin/login", "src/app/api/admin/logout", "src/app/admin/login"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (entry === "route.ts" || entry === "page.tsx") out.push(path);
  }
  return out;
}

const files = [...walk("src/app/api/admin"), ...walk("src/app/admin")];
const unguarded = files.filter((file) => {
  if ([...EXEMPT].some((dir) => file.startsWith(dir))) return false;
  return !readFileSync(file, "utf8").includes("adminSession(");
});

if (unguarded.length > 0) {
  console.error("Admin surfaces with no session check of their own:\n");
  for (const file of unguarded) console.error(`  ${file}`);
  console.error(
    "\nAdd:  if (!(await adminSession())) ...   — see src/lib/admin-guard.ts." +
      "\nRelying on proxy.ts alone means the host decides whether this is protected."
  );
  process.exit(1);
}

console.log(`Admin guard: ${files.length - EXEMPT.size} protected surface(s), all check the session.`);
