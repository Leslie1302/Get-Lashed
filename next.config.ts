import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP. Three entries are load-bearing and easy to break:
 *
 *  - 'unsafe-inline' in script-src. DO NOT REMOVE without replacing it with a
 *    nonce. Next.js ships the RSC payload in INLINE <script> tags —
 *    `(self.__next_f=self.__next_f||[]).push(...)` — plus the JSON-LD block.
 *    Block those and React never hydrates: every page still renders, and every
 *    button on the site silently does nothing. This shipped to production once
 *    exactly that way, and it only reproduces in a production build, because
 *    dev already allowed inline scripts. `npm run check:csp` guards it now.
 *
 *    The stricter alternative is a per-request nonce set in proxy.ts, which
 *    Next stamps onto its own scripts. It costs static rendering — every page
 *    becomes dynamic, since a nonce cannot be cached — so it isn't worth it
 *    while nothing on the site renders user-supplied HTML. Revisit if that
 *    ever changes.
 *
 *  - 'wasm-unsafe-eval' in script-src. MediaPipe compiles WebAssembly; without
 *    it /try-on dies silently while every other page looks fine. Re-test the
 *    try-on page after ANY change to this header.
 *  - 'unsafe-inline' in style-src. Tailwind is compiled, but next/font injects
 *    an inline <style> block and next/image sets inline styles.
 *
 * connect-src stays 'self': the AR runtime and models are served from
 * /public/mediapipe, so no CDN origin is needed. Putting a CDN back means
 * adding it here too.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  // next/font/google downloads the fonts at build time and serves them from
  // our own origin, so no fonts.googleapis.com / fonts.gstatic.com here.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "media-src 'self' blob:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-src https://www.google.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Pin the project root. Turbopack infers it by walking up for a lockfile,
  // and a stray package-lock.json in a parent directory (a home folder, say)
  // silently drags the root up there — which changes module resolution and
  // makes it watch far more of the filesystem than it should.
  turbopack: { root: __dirname },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // The try-on needs the camera; nothing here needs anything else.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/mediapipe/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
