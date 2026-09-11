// The price list is what Paystack charges. Run: npm run check:menu
//
// Not a style check — every assertion below is a way a real client is debited
// the wrong amount, or cannot book at all.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/lib/constants.ts", "utf8");

// Pull the SERVICES array out of the TS source and evaluate it as data. The
// literal is plain JSON-ish JavaScript; the shared EXTRA_DESIGN object is
// declared just above it, so both are evaluated together.
const from = src.indexOf("const EXTRA_DESIGN");
const to = src.indexOf("/** Every choice a client may pick");
const block = src
  .slice(from, to)
  .replace(/export const SERVICES: Service\[\]/, "const SERVICES")
  .replace(/const EXTRA_DESIGN: ServiceOptions/, "const EXTRA_DESIGN");
const SERVICES = new Function(`${block}; return SERVICES;`)();

const choicesOf = (s) =>
  !s.options
    ? []
    : s.options.required
      ? s.options.choices
      : [
          { id: "none", label: s.options.declineLabel ?? "No thank you", addGHS: 0 },
          ...s.options.choices,
        ];

assert.equal(SERVICES.length, 17, "menu size changed — update this number deliberately");

const ids = new Set();
for (const s of SERVICES) {
  assert.ok(!ids.has(s.id), `duplicate service id: ${s.id}`);
  ids.add(s.id);

  // A zero or negative price would charge nothing and confirm the booking.
  assert.ok(s.priceGHS > 0, `${s.id}: price must be positive`);
  assert.ok(Number.isFinite(s.durationMins) && s.durationMins > 0, `${s.id}: bad duration`);
  assert.ok(["nails", "pedicure", "lashes"].includes(s.category), `${s.id}: bad category`);

  if (!s.options) continue;

  const choices = choicesOf(s);
  assert.ok(choices.length >= 2, `${s.id}: an option with one choice is not a choice`);

  const seen = new Set();
  for (const c of choices) {
    assert.ok(!seen.has(c.id), `${s.id}: duplicate choice id ${c.id}`);
    seen.add(c.id);
    // A negative add would let a client discount themselves.
    assert.ok(c.addGHS >= 0, `${s.id}/${c.id}: addGHS must not be negative`);
    assert.ok(c.label?.length > 0, `${s.id}/${c.id}: needs a label`);
  }

  // Required means no free ride: there must be no implicit decline.
  if (s.options.required) {
    assert.ok(!seen.has("none"), `${s.id}: required options must not offer "none"`);
  } else {
    assert.equal(choices[0].addGHS, 0, `${s.id}: declining must cost nothing`);
  }

  // Every label that quotes a cedi figure must quote the ACTUAL total, or the
  // client reads one price and Paystack charges another.
  for (const c of s.options.choices) {
    // A label may mention more than one figure ("Custom (GH₵450 set) —
    // GH₵225"), so at least one of them must be a number the client will
    // actually be charged: the total, or the extra on its own.
    const quoted = [...c.label.matchAll(/GH₵(\d+)/g)].map((m) => Number(m[1]));
    if (quoted.length === 0) continue;
    const total = s.priceGHS + c.addGHS;
    assert.ok(
      quoted.includes(total) || quoted.includes(c.addGHS),
      `${s.id}/${c.id}: label quotes ${quoted.join("/")} but the total is GH₵${total}`
    );
  }
}

// The studio's rule: a refill is half the price of the set being refilled.
const refill = SERVICES.find((s) => s.id === "lash-refill");
const sets = { classic: 180, "hybrid-light": 200, "hybrid-full": 250, volume: 350, "custom-450": 450, "custom-550": 550 };
for (const c of refill.options.choices) {
  const full = sets[c.id];
  assert.ok(full, `lash-refill: no set price known for ${c.id}`);
  assert.equal(
    refill.priceGHS + c.addGHS,
    full / 2,
    `lash-refill/${c.id}: should be half of GH₵${full}`
  );
}

// The try-on's "Book this look" deep-links by service id. A typo there is
// invisible: /book just ignores an unknown ?service= and shows an empty form,
// so the look someone picked silently fails to carry over.
const designs = readFileSync("src/lib/designs.ts", "utf8");
const referenced = [
  ...[...designs.matchAll(/serviceId: "([^"]+)"/g)].map((m) => m[1]),
  // nailServiceId() builds these from the length ids in ar-geometry.
  "biab-natural",
  ...["short", "medium", "long"].map((l) => `${l}-acrylic-french`),
];
for (const id of referenced) {
  assert.ok(ids.has(id), `try-on links to "${id}", which is not a service`);
}

console.log(`Menu: ${SERVICES.length} services, every price positive, every quoted figure matches its total, refills are exactly half, ${referenced.length} try-on links resolve.`);
