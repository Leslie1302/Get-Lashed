import "server-only";
import { cache } from "react";
import { databaseConfigured } from "@/lib/db";
import { fallbackHours, weeklyHours, type DayHours } from "@/lib/bookings";

/**
 * The opening hours shown to visitors. She sets them in /admin, so the About
 * page, the footer and the search-engine data all have to read the same source
 * the booking form does — otherwise the site advertises hours she no longer
 * keeps.
 *
 * `cache` dedupes this within a single render, so a page using it in three
 * places still makes one query. Falls back to constants.ts if the database
 * isn't reachable, which keeps the page readable rather than blank.
 */
export const publicHours = cache(
  async (): Promise<Record<string, DayHours | null>> => {
    if (!databaseConfigured()) return fallbackHours();
    try {
      return await weeklyHours();
    } catch (error) {
      console.error("[hours]", error);
      return fallbackHours();
    }
  }
);
