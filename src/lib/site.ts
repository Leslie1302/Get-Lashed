/**
 * Canonical origin, no trailing slash. Vercel sets VERCEL_PROJECT_PRODUCTION_URL
 * automatically, so this is right on preview deploys too — but set
 * NEXT_PUBLIC_SITE_URL once the real domain is live so canonicals and the
 * sitemap point at it rather than the vercel.app host.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
