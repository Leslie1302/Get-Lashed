import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP. Two entries here are load-bearing and easy to break:
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
  `script-src 'self' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
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
