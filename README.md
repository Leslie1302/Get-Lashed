# Get Lashed — lashes, nails & pedi-mani

Marketing and booking site for a nail and lash technician in Kweiman, Accra.
Next.js 16 (App Router), TypeScript strict, Tailwind v4, deployed to Netlify.

**Bookings and opening hours live in our own Postgres** (Neon over HTTP).
Portfolio images and their category metadata live in Cloudinary — Cloudinary
tags are the only store the gallery has.

## Pages

| Path | What it does |
| --- | --- |
| `/` | Home. Online-booking and WhatsApp CTAs carry equal weight. |
| `/services` | Services and prices, from `src/lib/constants.ts` |
| `/portfolio` | Cloudinary gallery, category filter, `<dialog>` lightbox |
| `/book` | Service → date → slot → details, held in the database as *pending* |
| `/about` | About, hours, map |
| `/try-on` | AR try-on. **Beta, off by default** — set `NEXT_PUBLIC_ENABLE_AR=true` |
| `/admin` | Session-gated: confirm/decline requests, diary, opening hours, portfolio upload |

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
| `DATABASE_URL` | Neon Postgres — bookings and opening hours |
| `BOOKINGS_FEED_TOKEN` | Optional `.ics` feed of confirmed bookings for her phone |
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

**The schedule is our own database, not Google Calendar.** Bookings and her
opening hours live in Postgres (`bookings`, `opening_hours`, `date_overrides`).
There is no Google account, no service account, no OAuth and no third-party API
in the booking path — an outage or an expired credential at Google cannot take
her diary offline, and client names and phone numbers never leave our own
database. She sets her hours in `/admin`.

`/api/bookings-feed/[token]` is the one calendar-shaped thing left, and it runs
the other way: we *publish* a read-only `.ics` file so her phone can mirror
confirmed bookings. It is optional and reads nothing.

**Double-booking is prevented by the database, not by application code.** A
partial unique index does it in one statement:

```sql
CREATE UNIQUE INDEX bookings_live_slot ON bookings (starts_at)
  WHERE status IN ('pending', 'confirmed')
```

Check-then-insert is a race no matter how careful the code is; here the second
concurrent insert simply fails with 23505, which surfaces as "that slot was
just taken". Cancelling or declining a booking moves it out of those two
statuses, which frees the slot automatically — no cleanup job.

**Slot logic is re-derived server-side.** `POST /api/book` recomputes duration
and end time from `serviceId` and re-runs the availability check. The client's
earlier check is advisory only.

**`/api/book` is an unauthenticated write to the live diary.** The rate limit,
honeypot and submit-timing check in that route are load-bearing. Without them
one script makes the owner's real schedule unusable.

**Portfolio images go to Cloudinary, never `/public`.** The filesystem is
read-only at runtime on any serverless host. Cloudinary tags are the category metadata store, so the
gallery needs no tables of its own. Don't add a JSON manifest as a substitute.

**Admin uses a real server-side session.** `/admin` exposes client names, phone
numbers and email addresses; under Ghana's Data Protection Act (Act 843) that's
our liability. scrypt-hashed password in env, timing-safe compare, HMAC-signed
httpOnly/secure/sameSite=strict cookie, verified in `src/proxy.ts` on every
`/admin/*` and `/api/admin/*` request. A client-side redirect is not protection.

**MediaPipe is `@mediapipe/tasks-vision` only.** `@mediapipe/hands`,
`face_mesh` and `camera_utils` are deprecated legacy solutions. Camera plumbing
is `getUserMedia` plus `requestVideoFrameCallback`, no helper package.

**All times are `Africa/Accra`.** Ghana is UTC+0 with no DST, so a
`YYYY-MM-DDTHH:MM:00Z` string is both the wall clock she reads and the instant
stored. Every slot is derived from that, never from server-local time.

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
  invisible locally and total in production. `npm run check:csp` fails the build if
  it comes back.
- **`NEXT_PUBLIC_*` is baked in at build time, and `.env.local` is not
  deployed.** Setting `NEXT_PUBLIC_ENABLE_AR` on your own machine does nothing
  for the deployed site — it has to be set in Netlify, and changing it needs a
  **redeploy**, not just a save. If `/try-on` 404s in
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

1. **Database** — create a free project at [neon.tech](https://neon.tech), copy
   the pooled connection string into `DATABASE_URL` (Netlify and `.env.local`),
   then create the tables once: `npm run db:setup`.
2. **Cloudinary** — create the account, note the cloud name, API key, secret.
3. **Admin secrets** — `npm run admin:hash -- "a real password"`, keep both
   lines it prints.
4. **Netlify** — import the repo (build command and publish directory come
   from `netlify.toml`), then add every var from `.env.example` under Site
   configuration → Environment variables. Leave `NEXT_PUBLIC_ENABLE_AR` unset
   for the first deploy.
5. **Domain** — point DNS at Netlify, then set `NEXT_PUBLIC_SITE_URL` to the
   real origin and redeploy so canonicals and the sitemap stop pointing at
   `*.netlify.app`.
6. **Smoke test on the real deploy** — make a booking end to end, confirm it
   in `/admin`, and check the slot then greys out on `/book`; set her real
   opening hours; upload one photo and check it appears on `/portfolio`;
   confirm `/admin` redirects when signed out.
7. **AR last** — only after testing `/try-on` on a real midrange Android in
   ordinary indoor light. Set `NEXT_PUBLIC_ENABLE_AR=true`, redeploy, re-test
   the page (the CSP is the usual culprit).

## Deliberately deferred

| Deferred | Add when |
| --- | --- |
| Deposits / Mobile Money | No-shows start costing real money. Most likely first addition. |
| SMS reminders | WhatsApp confirmations prove insufficient. Hubtel or Arkesel over Twilio for Ghana. |
| Self-service cancel / reschedule | WhatsApp cancellations become a burden. The booking ref is already a natural key for it. |
| Multi-staff scheduling | A second technician joins. Real re-architecture — the one-booking-per-slot unique index does not survive it. |
| Analytics | Traffic worth measuring exists. Netlify Analytics, or Plausible. |
| i18n | Expanding beyond an English-speaking market |
