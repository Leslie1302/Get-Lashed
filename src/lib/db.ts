import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Neon over HTTP. The one dependency here earns its place: the ordinary `pg`
 * driver opens a TCP connection per invocation, and on serverless that
 * exhausts the connection limit under any real traffic. This driver is
 * stateless HTTP, so there is nothing to pool and nothing to leak.
 *
 * No ORM. Three tables and a dozen queries do not need one.
 */
export function databaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  return neon(url);
}

/**
 * Postgres 42P01 — the table isn't there. That is a different problem from an
 * unreachable database and has a different fix (`npm run db:setup`), so the
 * two must not collapse into one "couldn't reach the database" message: it
 * sends you looking at the connection string when the connection was fine.
 */
export function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("42P01") || /relation ".+" does not exist/.test(message);
}

/**
 * Raised when two people book the same slot at the same moment. The database
 * decides the winner via a unique index rather than the application checking
 * and then inserting, which is a race no amount of care in JavaScript fixes.
 */
export function isSlotTakenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("bookings_live_slot") || message.includes("23505");
}
