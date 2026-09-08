import "server-only";
import { unstable_cache } from "next/cache";
import {
  CATEGORY_TAGS,
  mapResource,
  type CategoryTag,
  type CloudinaryResource,
  type PortfolioItem,
} from "@/lib/cloudinary-core";

export type { CategoryTag, PortfolioItem, CloudinaryResource };

export const PORTFOLIO_CACHE_TAG = "portfolio";

const credentialsReady = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

async function fetchImagesByTag(tag: CategoryTag): Promise<PortfolioItem[]> {
  if (!credentialsReady) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[cloudinary] CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET missing — portfolio empty"
      );
    }
    return [];
  }

  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  const auth = `Basic ${Buffer.from(
    `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
  ).toString("base64")}`;

  const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/image/tags/${tag}?context=true&tags=true&max_results=100`;

  const res = await fetch(url, {
    headers: { Authorization: auth },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    console.error(`[cloudinary] Admin API ${res.status} for tag "${tag}"`);
    return [];
  }

  const data = (await res.json()) as { resources?: CloudinaryResource[] };
  return (data.resources ?? []).map((r) => mapResource(r, cloud, tag));
}

/**
 * Every image across all tags, wrapped in a 5-minute cache. Cloudinary tags
 * are the metadata store — the page filter never queries a database. The API
 * secret only ever lives in this server-only module.
 */
export const getPortfolio = unstable_cache(
  async (): Promise<PortfolioItem[]> => {
    if (!credentialsReady) return [];
    const groups = await Promise.all(CATEGORY_TAGS.map(fetchImagesByTag));
    return groups.flat();
  },
  ["portfolio", "cloudinary"],
  // The tag lets the admin upload route bust this immediately; the 5-minute
  // revalidate covers photos added straight in the Cloudinary console.
  { revalidate: 300, tags: [PORTFOLIO_CACHE_TAG] }
);