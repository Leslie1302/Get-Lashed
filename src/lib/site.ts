/**
 * Canonical origin, no trailing slash.
 *
 * Both hosts hand us their own URL, so previews get a correct canonical without
 * configuration: Netlify sets URL (and DEPLOY_PRIME_URL on branch and preview
 * deploys), Vercel sets VERCEL_PROJECT_PRODUCTION_URL. Set NEXT_PUBLIC_SITE_URL
 * once the real domain is live so canonicals and the sitemap point at it rather
 * than a netlify.app host.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  // Netlify. DEPLOY_PRIME_URL is the deploy being built; URL is production.
  const netlify = process.env.DEPLOY_PRIME_URL || process.env.URL;
  if (netlify) return netlify.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
