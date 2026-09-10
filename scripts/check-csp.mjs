// Does the production CSP actually allow the HTML we ship?
//   npm run build && npm run check:csp
//
// This exists because the opposite once shipped: a CSP without 'unsafe-inline'
// in script-src, which blocks the inline <script> tags Next uses to carry the
// RSC payload. Every page rendered, nothing hydrated, and every button on the
// site did nothing — invisible in dev, because dev allowed inline scripts.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_DIR = ".next/server/app";

if (!existsSync(APP_DIR)) {
  console.error("\n  ✗ No production build found. Run `npm run build` first.\n");
  process.exit(1);
}

// The CSP is built in next.config.ts; read the header the way a browser would,
// from the config source, so this checks the real value rather than a copy.
const config = readFileSync("next.config.ts", "utf8");
const scriptSrc = config.match(/`script-src ([^`]*)`/)?.[1] ?? config.match(/"script-src ([^"]*)"/)?.[1];
if (!scriptSrc) {
  console.error("\n  ✗ Could not find script-src in next.config.ts.\n");
  process.exit(1);
}

// Strip the dev-only template branch: we care about what production sends.
const production = scriptSrc.replace(/\$\{[^}]*\}/g, "");
const allowsInline = production.includes("'unsafe-inline'");
const usesNonce = production.includes("nonce-");

const pages = readdirSync(APP_DIR, { recursive: true }).filter((f) => String(f).endsWith(".html"));
const offenders = [];

for (const page of pages) {
  const html = readFileSync(join(APP_DIR, String(page)), "utf8");
  // Inline = a <script> with no src attribute.
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)];
  if (!inline.length) continue;
  const nonced = inline.every((m) => /\bnonce=/.test(m[1]));
  if (!allowsInline && !(usesNonce && nonced)) {
    offenders.push(`${page} (${inline.length} inline script${inline.length === 1 ? "" : "s"})`);
  }
}

if (offenders.length) {
  console.error(
    [
      "",
      "  ✗ The production CSP blocks inline scripts that the built pages contain.",
      "",
      `    script-src is: ${production.trim()}`,
      "",
      "    Pages that would break:",
      ...offenders.slice(0, 8).map((o) => `      ${o}`),
      offenders.length > 8 ? `      ...and ${offenders.length - 8} more` : "",
      "",
      "    Every one of those pages would render and then be completely dead:",
      "    React cannot hydrate, so no button, form or link handler runs.",
      "",
      "    Fix: add 'unsafe-inline' to script-src in next.config.ts, or set a",
      "    per-request nonce in proxy.ts and stamp it on Next's scripts.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

console.log(
  `  ✓ CSP allows the inline scripts in all ${pages.length} prerendered pages — hydration will work\n`
);
