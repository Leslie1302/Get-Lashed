# Glow Studio Accra — nails & lashes

Marketing and booking site for a nail and lash technician in Accra. Next.js 16
(App Router), TypeScript strict, Tailwind v4, deployed to Vercel.

**No database.** Bookings live in Google Calendar; portfolio images and their
category metadata live in Cloudinary.

## Pages

| Path | What it does |
| --- | --- |
| `/` | Home. Online-booking and WhatsApp CTAs carry equal weight. |
| `/services` | Services and prices, from `src/lib/constants.ts` |
| `/portfolio` | Cloudinary gallery, category filter, `<dialog>` lightbox |
| `/book` | Service → date → slot → details, straight into Google Calendar |
| `/about` | About, hours, map |
| `/try-on` | AR try-on. **Beta, off by default** — set `NEXT_PUBLIC_ENABLE_AR=true` |
| `/admin` | Session-gated: upcoming bookings and portfolio upload |

## Running it

```bash
npm install                  # also copies the AR runtime into public/mediapipe
cp .env.example .env.local   # fill in what you have; all of it is optional
npm run dev                  # http://localhost:3000
```

Every integration degrades on its own. With an empty `.env.local` the whole
site runs: the portfolio shows an empty state, `/book` lists no times and
points at WhatsApp, `/admin` says it isn't configured. Nothing crashes.

```bash
npm run build                # production build
npm run lint                 # eslint, including the React Compiler rules
npm run check:availability   # slot maths self-check, no network needed
npm run admin:hash -- "pw"   # print ADMIN_PASSWORD_HASH + ADMIN_SESSION_SECRET
```

## Business config lives in one file

`src/lib/constants.ts` holds the business details, services, prices (GHS),
durations, opening hours, slot interval, buffer, lead time, max advance and
blackout dates. Nothing else hardcodes a price or an opening hour.

**The values in there now are placeholders.** Replace them with the real ones
before this goes anywhere near a customer.

## Environment

See `.env.example` for the full list and setup steps. In short:

| Var | Purpose |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID` | Calendar access for bookings |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Portfolio images |
| `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | `/admin` login |
| `NEXT_PUBLIC_ENABLE_AR` | `"true"` turns on `/try-on` |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin once the domain is live |

## Adding a nail design

Everything on `/try-on` comes from `src/lib/designs.ts`. A finish is either a
flat colour or an image swatch:

```ts
{ id: "coral",  name: "Coral",  color: "#e8674f" },
{ id: "marble", name: "Marble", image: "/designs/white-marble.jpg" },
{ id: "french", name: "French", color: "#e9ceb5", tip: "#fdf6f2" },
```

Drop the image in `public/designs/`, add the line, done — no other file
changes. `npm run check:ar` fails on a missing file, a duplicate id, a bad hex
or an entry with neither colour nor image.

**The swatch spec.** A swatch is the *pattern only*, filling a square edge to
edge — a fabric sample, not a photograph. A photo of a finished nail will not
work: it carries the nail's own outline, the finger, the background and its
lighting, and all of that gets warped onto a differently shaped nail.

- Square, 256×256. A nail renders around 40 px, so more is wasted bytes.
- JPEG unless the design genuinely needs transparency. Most don't — the nail
  shape comes from the clip path, not the image.
- Bold patterns. Fine detail vanishes at nail size; leopard needs two or three
  spots across the whole square, not twenty.
- Keep plain colours as hex. A solid red doesn't need a 20 KB file.
- Orientation: the top edge of the image is the cuticle, the bottom is the free
  edge. Ombrés and tip designs need to run that way round.

The six shipped swatches are placeholders, generated procedurally — replace
them with the studio's real finishes. Judge each one on camera rather than by
its button: colours sit over skin tone with a highlight on top, and mid-tones
in particular can look washed out live.

## Tuning the nail fit

There are no nail landmarks — MediaPipe gives 21 joint positions and nothing
else — so the nail is inferred from the fingertip and DIP joint using the
constants at the top of `src/lib/ar-geometry.ts`. If the overlay looks wrong on
a real hand, the symptom maps to one knob:

| Symptom | Knob |
| --- | --- |
| Nails float past the fingertip | `NAIL_TIP` (lower it) |
| Nails run too far back towards the knuckle | `NAIL_BASE` |
| All nails too wide or too narrow | the second column of `FINGER_SHAPE` |
| One finger wrong, the rest fine | that finger's row in `FINGER_SHAPE` |
| Width swings oddly as the hand opens and closes | `WIDTH_TOLERANCE` (lower it) |
| Shape too pointed or too blunt at the tip | `TIP_CURVE` in `TryOn.tsx` |
| Overlay shimmers when the hand is still | `MAX_SMOOTHING` |
| Overlay lags behind a moving hand | `SPEED_SENSITIVITY` (lower it) |

`npm run check:ar` guards the proportions, so a change that makes a nail wider
than it is long, or puts it off the end of the finger, fails there rather than
on camera.

## Design decisions that are not up for grabs

Each of these exists because the obvious alternative fails in a specific way.

**Calendar auth is a service account, never OAuth2.** A refresh token issued
against a consent screen in Testing status expires after 7 days, so an
OAuth-based booking flow dies quietly the week after launch. The service
account authenticates with a key pair and the calendar is shared with its
`client_email`. There is no refresh flow in this codebase and none should be
added. `src/lib/google-calendar.ts` signs its own JWT with `node:crypto` — the
`googleapis` package is 50 MB of surface area for two REST calls.

**Double-booking is prevented by a deterministic event ID, not a lock.**
`events.list` then `events.insert` is a check-then-act race. Instead the ID is
derived from the slot start: `"bk" + Math.floor(startMs / 1000).toString(32)`
(base32hex — Calendar IDs allow only `a`–`v` and `0`–`9`). A duplicate insert
returns 409 from Google, which surfaces as "that slot was just taken".
Cancelled event IDs can't be reused, so `freeEventId()` adds an `r1`/`r2`
suffix — but only after confirming the existing event's status is `cancelled`,
never past a live booking.

**Slot logic is re-derived server-side.** `POST /api/book` recomputes duration
and end time from `serviceId` and re-runs the availability check. The client's
earlier check is advisory only.

**`/api/book` is an unauthenticated write to a live calendar.** The rate limit,
honeypot and submit-timing check in that route are load-bearing. Without them
one script makes the owner's real schedule unusable.

**Portfolio images go to Cloudinary, never `/public`.** Vercel's filesystem is
read-only at runtime. Cloudinary tags are the category metadata store — that is
why there's no database. Don't add a JSON manifest as a substitute.

**Admin uses a real server-side session.** `/admin` exposes client names, phone
numbers and email addresses; under Ghana's Data Protection Act (Act 843) that's
our liability. scrypt-hashed password in env, timing-safe compare, HMAC-signed
httpOnly/secure/sameSite=strict cookie, verified in `src/proxy.ts` on every
`/admin/*` and `/api/admin/*` request. A client-side redirect is not protection.

**MediaPipe is `@mediapipe/tasks-vision` only.** `@mediapipe/hands`,
`face_mesh` and `camera_utils` are deprecated legacy solutions. Camera plumbing
is `getUserMedia` plus `requestVideoFrameCallback`, no helper package.

**All times are `Africa/Accra`.** Ghana is UTC+0 with no DST, but `timeZone` is
still passed explicitly to every Calendar call. Server-local time is never
trusted.

**WhatsApp is a first-class booking channel.** For a salon in Accra it will
likely out-convert the form, so it has equal visual weight on the home page and
is the fallback everywhere the booking API can fail.

**No UI, state, animation or form library.** React state for forms, `<dialog>`
for modals, Canvas 2D for AR.

## Traps

- **CSP breaks hydration, and only in production.** Next ships the RSC payload
  in inline `<script>` tags. A `script-src` without `'unsafe-inline'` (or a
  nonce) blocks them, React never hydrates, and every page renders perfectly
  while every button does nothing. Dev allows inline scripts, so this is
  invisible locally and total on Vercel. `npm run check:csp` fails the build if
  it comes back.
- **`NEXT_PUBLIC_*` is baked in at build time, and `.env.local` is not
  deployed.** Setting `NEXT_PUBLIC_ENABLE_AR` on your own machine does nothing
  for the deployed site — it has to be a Vercel environment variable, and
  changing it needs a **redeploy**, not just a save. If `/try-on` 404s in
  production, that's why.
- **CSP breaks MediaPipe.** WASM needs `script-src 'self' 'wasm-unsafe-eval'`.
  It's in `next.config.ts`. Re-test `/try-on` after touching that header.
- **MediaPipe breaks SSR.** It touches `window`. It's imported *inside* the
  Start-camera handler, never at module scope, which is what keeps the build
  working and the 10 MB off the initial page load. Don't hoist that import.
  (`next/dynamic` with `ssr: false` is not allowed in a Server Component in
  Next 16, so the import site is the only thing protecting this.)
- **The AR payload is ~10 MB.** WASM runtime plus a landmark model, self-hosted
  from `/public/mediapipe` by `scripts/copy-ar-assets.mjs` on postinstall. It
  loads only on an explicit tap, with a data-cost note.
- **Nail landmarks don't exist.** MediaPipe gives 21 hand landmarks, none of
  them nail-bed corners. The quad is synthesised from the fingertip and DIP
  joint, with width scaled from the nearest adjacent fingertip. Raw per-frame
  quads shimmer, so an EMA filter is applied — that smoothing is required, not
  optional.
- **`middleware.ts` is deprecated in Next 16.** It's `src/proxy.ts`, exporting
  `proxy`. Same semantics.

## Deploy runbook

1. **Google Cloud** — new project, enable the Calendar API, create a service
   account, download a JSON key. In Google Calendar, share the studio calendar
   with the service account's `client_email` as *Make changes to events*, and
   copy the calendar ID from Settings → Integrate calendar.
2. **Cloudinary** — create the account, note the cloud name, API key, secret.
3. **Admin secrets** — `npm run admin:hash -- "a real password"`, keep both
   lines it prints.
4. **Vercel** — import the repo, add every var from `.env.example` (paste the
   service-account JSON on one line). Leave `NEXT_PUBLIC_ENABLE_AR` unset for
   the first deploy.
5. **Domain** — point DNS at Vercel, then set `NEXT_PUBLIC_SITE_URL` to the
   real origin and redeploy so canonicals and the sitemap stop pointing at
   `*.vercel.app`.
6. **Smoke test on the real deploy** — make a booking end to end and confirm it
   lands in the calendar; sign in to `/admin`; upload one photo and check it
   appears on `/portfolio`; confirm `/admin` redirects when signed out.
7. **AR last** — only after testing `/try-on` on a real midrange Android in
   ordinary indoor light. Set `NEXT_PUBLIC_ENABLE_AR=true`, redeploy, re-test
   the page (the CSP is the usual culprit).

## Deliberately deferred

| Deferred | Add when |
| --- | --- |
| Database | Booking history, client records or repeat-visit tracking is needed |
| Deposits / Mobile Money | No-shows start costing real money. Most likely first addition. |
| SMS reminders | Calendar reminders prove insufficient. Hubtel or Arkesel over Twilio for Ghana. |
| Self-service cancel / reschedule | WhatsApp cancellations become a burden |
| Multi-staff scheduling | A second technician joins. Genuine re-architecture — the deterministic-event-ID scheme does not survive it. |
| Analytics | Traffic worth measuring exists. Vercel Analytics, one line. |
| i18n | Expanding beyond an English-speaking market |
