// Create the tables and seed the opening hours. Idempotent — safe to re-run:
//   npm run db:setup
//
// No migration framework. Three tables that change rarely do not need one; if
// the schema starts moving weekly, that is the moment to add one, not now.
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    [
      "",
      "  ✗ DATABASE_URL is not set.",
      "",
      "    Create a free project at neon.tech, copy the POOLED connection",
      "    string, and set it as DATABASE_URL — in .env.local to run this",
      "    locally, and in Netlify for the deployed site.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS opening_hours (
    weekday SMALLINT PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
    opens TEXT,
    closes TEXT
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS date_overrides (
    on_date DATE PRIMARY KEY,
    opens TEXT,
    closes TEXT,
    note TEXT
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,
    ref TEXT UNIQUE NOT NULL,
    service_id TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    client_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ
  )`;

// The whole double-booking defence, in one line. A partial unique index means
// two live bookings can never share a start time — the second insert fails
// inside Postgres, atomically, however close together the two requests are.
// Declined and cancelled rows are excluded so a freed slot can be rebooked.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS bookings_live_slot
    ON bookings (starts_at)
    WHERE status IN ('pending', 'confirmed')`;

await sql`
  CREATE INDEX IF NOT EXISTS bookings_upcoming
    ON bookings (starts_at)
    WHERE status <> 'declined'`;

// Seed a default week only if the table is empty, so re-running never
// overwrites hours the owner has since set in the admin page.
const [{ count }] = await sql`SELECT count(*)::int AS count FROM opening_hours`;
if (count === 0) {
  await sql`
    INSERT INTO opening_hours (weekday, opens, closes) VALUES
      (0, '09:00', '18:00'),
      (1, '09:00', '18:00'),
      (2, '09:00', '18:00'),
      (3, '09:00', '18:00'),
      (4, '09:00', '20:00'),
      (5, '09:00', '20:00'),
      (6, NULL, NULL)`;
  console.log("  seeded a default week (Mon–Thu 9–6, Fri–Sat 9–8, Sun closed)");
  console.log("  she can change all of it in /admin");
} else {
  console.log(`  opening hours already set for ${count} days — left alone`);
}

const [{ bookings }] = await sql`SELECT count(*)::int AS bookings FROM bookings`;
console.log(`\n  ✓ Database ready. ${bookings} booking${bookings === 1 ? "" : "s"} stored.\n`);
