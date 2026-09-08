// Verify the Google Calendar credentials without starting the site:
//   npm run check:calendar
//
// Deliberately standalone — it exercises the credentials themselves, not the
// app's wrapper around them, so a pass here means the setup is genuinely
// correct. Every failure mode below is one someone actually hits; the point is
// to name which one instead of the site saying "booking isn't switched on".
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

const ok = (m) => console.log(`  ✓ ${m}`);
const info = (m) => console.log(`    ${m}`);

function fail(problem, ...fix) {
  console.error(`\n  ✗ ${problem}\n`);
  for (const line of fix) console.error(`    ${line}`);
  console.error("");
  process.exit(1);
}

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const calendarId = process.env.GOOGLE_CALENDAR_ID;

if (!raw) {
  fail(
    "GOOGLE_SERVICE_ACCOUNT_JSON is not set.",
    "Add it to .env.local. It is the entire service-account JSON key file,",
    "on ONE line, wrapped in single quotes:",
    "",
    `  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'`,
    "",
    "See SETUP.md section 3 for how to create the key."
  );
}
if (!calendarId) {
  fail(
    "GOOGLE_CALENDAR_ID is not set.",
    "In Google Calendar: the studio's calendar -> Settings and sharing ->",
    "'Integrate calendar' -> Calendar ID. It usually looks like an email",
    "address. Do not use 'primary' — a service account's own primary calendar",
    "is not the studio's calendar."
  );
}

let creds;
try {
  creds = JSON.parse(raw);
} catch (error) {
  fail(
    `GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (${error.message}).`,
    "The most common cause is the value not being wrapped in single quotes,",
    "so the shell mangles it. Keep it on one line inside '...'."
  );
}
if (!creds.client_email || !creds.private_key) {
  fail(
    "That JSON is missing client_email or private_key.",
    "It should be the key file downloaded from the service account, not the",
    "OAuth client secret file."
  );
}
ok(`service account: ${creds.client_email}`);

const key = creds.private_key.replace(/\\n/g, "\n");
if (!key.includes("BEGIN PRIVATE KEY")) {
  fail(
    "private_key does not look like a PEM key.",
    "Escaped newlines (\\n) are fine and handled automatically, but the value",
    "must still start with -----BEGIN PRIVATE KEY-----."
  );
}

const b64 = (v) => Buffer.from(v).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const payload = `${b64(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64(
  JSON.stringify({
    iss: creds.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 600,
  })
)}`;

let signature;
try {
  signature = b64(createSign("RSA-SHA256").update(payload).sign(key));
} catch (error) {
  fail(`Could not sign with that private key (${error.message}).`, "The key is malformed or truncated. Download a fresh key.");
}

const tokenRes = await fetch(TOKEN_URL, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${payload}.${signature}`,
  }),
});
const tokenBody = await tokenRes.json();

if (!tokenRes.ok) {
  const reason = tokenBody.error ?? "unknown";
  if (reason === "invalid_grant") {
    fail(
      "Google rejected the signed request (invalid_grant).",
      "Either this machine's clock is wrong by more than a few minutes, or the",
      "key has been deleted in the Google Cloud console."
    );
  }
  fail(
    `Token request failed: ${reason} — ${tokenBody.error_description ?? ""}`,
    "If this says the API is disabled, enable the Google Calendar API on the",
    "project that owns this service account."
  );
}
ok("authenticated with Google");

const qs = new URLSearchParams({
  timeMin: new Date().toISOString(),
  timeZone: "Africa/Accra",
  singleEvents: "true",
  orderBy: "startTime",
  maxResults: "5",
});
const res = await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${qs}`,
  { headers: { authorization: `Bearer ${tokenBody.access_token}` } }
);

if (res.status === 404) {
  fail(
    `No calendar found with the ID "${calendarId}".`,
    "Copy it again from Settings and sharing -> Integrate calendar -> Calendar ID."
  );
}
if (res.status === 403) {
  fail(
    "Authenticated, but not allowed to read that calendar.",
    "This is the step people miss: the calendar has to be SHARED with the",
    "service account. In Google Calendar:",
    "",
    "  the studio's calendar -> Settings and sharing",
    "  -> Share with specific people or groups -> Add people",
    `  -> ${creds.client_email}`,
    "  -> permission: Make changes to events",
    "",
    "Adding the service account as an owner of the Cloud project does nothing;",
    "calendar access is granted in Calendar, not in Cloud IAM."
  );
}
if (!res.ok) {
  fail(`Calendar request failed: ${res.status} ${await res.text()}`);
}

const data = await res.json();
ok(`calendar reachable: ${data.summary ?? calendarId}`);
info(`timezone: ${data.timeZone ?? "unset"} (bookings are always sent as Africa/Accra)`);

const items = (data.items ?? []).filter((e) => e.status !== "cancelled");
if (items.length === 0) {
  info("no upcoming events — an empty diary, which is fine");
} else {
  info(`next ${items.length} event${items.length === 1 ? "" : "s"}:`);
  for (const e of items) {
    const when = e.start?.dateTime ?? e.start?.date ?? "?";
    info(`  ${when}  ${e.summary ?? "(no title)"}`);
  }
}

// Reading is not enough: the site inserts events, and read-only sharing passes
// every check above and then fails on the first real booking.
const probeId = `probe${Math.floor(Date.now() / 1000).toString(32)}`;
const start = new Date(Date.now() + 400 * 86_400_000);
const insert = await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenBody.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: probeId,
      summary: "Get Lashed — setup check (safe to delete)",
      start: { dateTime: start.toISOString(), timeZone: "Africa/Accra" },
      end: { dateTime: new Date(start.getTime() + 1800_000).toISOString(), timeZone: "Africa/Accra" },
    }),
  }
);

if (insert.status === 403) {
  fail(
    "Can read the calendar, but not write to it.",
    "The service account is shared with 'See all event details'. Change it to",
    "'Make changes to events' — bookings are inserted, not just read."
  );
}
if (!insert.ok) fail(`Test booking failed: ${insert.status} ${await insert.text()}`);

await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${probeId}`,
  { method: "DELETE", headers: { authorization: `Bearer ${tokenBody.access_token}` } }
);
ok("created and removed a test booking — write access confirmed");

console.log("\n  Calendar is ready. Online booking will work.\n");
