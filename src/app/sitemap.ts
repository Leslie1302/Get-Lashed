import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  // /admin and /try-on are deliberately absent: one is private, the other Beta.
  return ["", "/services", "/portfolio", "/book", "/about"].map((path) => ({
    url: `${siteUrl()}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/portfolio" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.8,
  }));
}
