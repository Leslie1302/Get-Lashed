# Get Lashed — what's still needed

Everything below is data or credentials only you can supply. The site runs
today without any of it: each integration degrades to a clear message and the
WhatsApp fallback rather than breaking.

**Never paste a secret key into a chat.** Keys go straight into `.env.local`
locally and into Vercel's environment variables in production.

---

## 1. Business details — `src/lib/constants.ts`

Every field marked `PLACEHOLDER` in that file is invented. They're wrong on
purpose: an obviously fake phone number gets fixed, a plausible one gets
shipped by accident.

| Field | What's needed |
| --- | --- |
| `tagline` | One line, in the studio's own words |
| `phone` | The number clients actually call |
| `whatsappNumber` | International format, digits only — `233241234567`, no `+` or spaces |
| `email` | Where booking enquiries should land |
| `address` | The street address clients are given |
| `coordinates` | `{ lat, lng }` — the map pin and directions link both follow from it |
| `socialLinks` | Delete any the studio doesn't have; empty ones become dead links |

**Getting the coordinates:** find the studio in Google Maps, right-click the
exact spot, and the first item in the menu is the lat/lng pair — click to copy.

## 2. Services, prices, hours — same file

`SERVICES` is entirely made up: eight invented treatments with invented prices
and durations. This is the highest-risk placeholder on the site, because those
numbers feed the price list, the booking form, how long each appointment
blocks, the deposit balance, and the structured data Google shows in search
results.

Send the real menu as: **service name, price in GH₵, how long it takes.**

`SCHEDULE` needs the real opening hours, the buffer between appointments, the
minimum notice for a booking, and how far ahead people may book.

## 3. Online booking — Google Calendar

1. [Google Cloud Console](https://console.cloud.google.com) → new project →
   enable the **Google Calendar API**.
2. Create a **service account**, then add a **JSON key** and download it.
3. Open Google Calendar → the studio's calendar → **Settings and sharing** →
   *Share with specific people* → add the service account's `client_email`
   with permission **Make changes to events**.
4. From that same settings page copy the **Calendar ID**.
5. Put the whole JSON on one line as `GOOGLE_SERVICE_ACCOUNT_JSON`, and the
   calendar ID as `GOOGLE_CALENDAR_ID`.

A service account is used rather than signing in with Google because a refresh
token from an unverified consent screen expires after seven days — booking
would work all week and die the following Monday.

## 4. Portfolio gallery — Cloudinary

1. Create a free [Cloudinary](https://cloudinary.com) account.
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret** into
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

That's all — no upload preset to configure. Once those are set, `/admin` can
upload photos and they appear on `/portfolio` immediately. The category chosen
at upload becomes a Cloudinary tag, and those tags are the only "database" the
gallery has.

## 5. Deposits — Paystack

1. Create a [Paystack](https://paystack.com) account for the business.
2. Settings → API Keys & Webhooks → copy the **test secret key**
   (`sk_test_…`) into `PAYSTACK_SECRET_KEY`.
3. On the same page set the **webhook URL** to
   `https://<your-domain>/api/paystack/webhook`.
4. In `src/lib/constants.ts`, set `DEPOSIT_GHS` to the deposit amount.
   **It is `0` right now, which switches deposits off entirely** — bookings
   confirm with no payment. It's deliberately unset rather than guessed,
   because a made-up figure would charge real clients real money.
5. Which payment methods appear — Mobile Money, card, bank — is controlled in
   the Paystack dashboard, not in the code, so it can change without a deploy.
6. Test the whole flow in test mode, then swap to the `sk_live_…` key.

Enable Mobile Money in Paystack before launch. For a salon in Accra it will
almost certainly carry most of the payments.

## 6. Photos

- **Portfolio** — her actual finished work. Uploaded through `/admin` once
  Cloudinary is connected; no developer needed after that.
- **Hero** — one strong portrait-shaped photo. Put it in `public/` and set
  `HERO_IMAGE` in `constants.ts` to its path. It's hidden on mobile, so it
  never costs a phone visitor anything.
- **Logo** — for the header, favicon and link previews. The header is a text
  wordmark until then.
- **Try-on swatches** — the six in `public/designs/` are generated
  placeholders. See "Adding a nail design" in the README for the spec; they
  are patterns, not photographs of nails.

## 7. Admin password

```bash
npm run admin:hash -- "a real password"
```

Copy both printed lines into `.env.local`. The password itself is never stored.

---

## Order I'd do it in

1. **Business details, services and hours** — no accounts needed, and the site
   stops telling visitors things that aren't true.
2. **Cloudinary** — five minutes, and the portfolio is the most persuasive page
   on the site.
3. **Google Calendar** — the longest setup, and what makes the site useful
   rather than a brochure.
4. **Paystack in test mode** — prove the flow before real money touches it.
5. **Photos**, as they come.
6. **Paystack live key**, last.

Steps 1 and 2 alone are enough to put the site in front of customers.
