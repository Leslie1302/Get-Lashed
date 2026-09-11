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

## 3. Online booking — the database

Bookings and her opening hours live in Postgres. There is no Google account
involved and nothing to copy by hand.

1. Vercel → your project → **Storage** → **Create Database** → **Neon Postgres**
   → connect it to this project. Vercel adds `DATABASE_URL` itself.
2. Create the tables once. Locally:

   ```bash
   npx vercel env pull .env.local
   npm run db:setup
   ```

That's it. `/admin` then shows a **When you're open** panel where she sets her
weekly hours and closes individual days. Those hours are what clients can book
against, and they also drive the About page, the footer and the opening hours
Google shows in search.

### How a booking actually flows

1. Client picks a service, a date and a free time, and leaves their details.
2. The slot is **held** and the booking saved as *pending*. Nobody else can
   take that time while she decides.
3. The client taps **Send the request on WhatsApp** — the message is already
   written, with the reference, service, time and their number.
4. She opens `/admin`, and either **Confirms** (the slot greys out for good) or
   taps **Can't make it** (the slot frees immediately). Either way she gets a
   ready-written reply to send the client.
5. A pending request she never answers stops holding its slot after 24 hours,
   so an ignored request cannot quietly kill a Saturday afternoon.

Nothing is lost if the client never taps send — the request is already saved
and shows in `/admin` regardless.

## 4. Her phone calendar — optional, and not Google

**Skip this entirely if you want.** Booking works without it; `/admin` is the
schedule either way.

This has nothing to do with Google Calendar. The app publishes her confirmed
bookings as a standard `.ics` file, and any phone calendar — iPhone, Android,
Outlook — can subscribe to that link so appointments and reminders show up
alongside the rest of her day. It is read-only and one-way: the app is the
schedule, her phone is a mirror. No Google account, no API, no sign-in.

1. Generate a token: `openssl rand -hex 24`
2. Put it in Vercel as `BOOKINGS_FEED_TOKEN`, redeploy.
3. On her phone: Calendar → Add account → **Subscribed calendar**, and paste
   `https://<your-domain>/api/bookings-feed/<that token>.ics`

**That URL is the password.** Anyone with it sees client names and phone
numbers, so don't post it anywhere. Change the token to revoke it.

## 5. Portfolio gallery — Cloudinary

1. Create a free [Cloudinary](https://cloudinary.com) account.
2. Dashboard → copy **Cloud name**, **API Key**, **API Secret** into
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

That's all — no upload preset to configure. Once those are set, `/admin` can
upload photos and they appear on `/portfolio` immediately. The category chosen
at upload becomes a Cloudinary tag, and those tags are the only "database" the
gallery has.

## 6. Deposits — Paystack

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

## 7. Photos

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

## 8. Admin password

```bash
npm run admin:hash -- "a real password"
```

Copy both printed lines into `.env.local`. The password itself is never stored.

---

## Order I'd do it in

1. **Business details and services** — no accounts needed, and the site stops
   telling visitors things that aren't true.
2. **The database** — two clicks in Vercel plus one command, and booking works.
3. **Cloudinary** — five minutes, and the portfolio is the most persuasive page
   on the site.
4. **Paystack in test mode** — prove the flow before real money touches it.
5. **Photos**, as they come.
6. **Paystack live key**, last.

Steps 1 and 2 alone are enough to put the site in front of customers.
