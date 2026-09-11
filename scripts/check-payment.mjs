// Does "paid" actually mean paid? Run: npm run check:payment
//
// isPaidInFull is the single gate between a Paystack callback and a held slot.
// Every case below is a way a real client, or a real attacker, gets a booking
// they did not pay for.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Read the TS source and evaluate the one function, so the test runs with no
// build step and no transpiler. The function is plain JS inside its types.
const src = readFileSync("src/lib/paystack-core.ts", "utf8");
const body = src.slice(src.indexOf("export function isPaidInFull"));
const isPaidInFull = new Function(
  "transaction",
  "expectedGHS",
  `const SUBUNIT = 100, CURRENCY = "GHS";
   return (${body.slice(body.indexOf("return (") + 8, body.lastIndexOf(");"))});`
);

const paid = { status: "success", amount: 25000, currency: "GHS", reference: "x" };

assert.equal(isPaidInFull(paid, 250), true, "exact payment must pass");
assert.equal(isPaidInFull({ ...paid, amount: 30000 }, 250), true, "overpayment is still paid");

assert.equal(isPaidInFull({ ...paid, amount: 24999 }, 250), false, "one pesewa short is not paid");
assert.equal(isPaidInFull({ ...paid, amount: 100 }, 250), false, "GH₵1 does not buy a GH₵250 slot");
assert.equal(isPaidInFull({ ...paid, currency: "NGN" }, 250), false, "another currency is not GHS");
assert.equal(isPaidInFull({ ...paid, status: "pending" }, 250), false, "pending is not paid");
assert.equal(isPaidInFull({ ...paid, status: "abandoned" }, 250), false, "abandoned is not paid");
assert.equal(isPaidInFull({ ...paid, status: "failed" }, 250), false, "failed is not paid");

// Prices with pesewas must not fall foul of floating point.
assert.equal(isPaidInFull({ ...paid, amount: 18050 }, 180.5), true, "180.50 exact must pass");
assert.equal(isPaidInFull({ ...paid, amount: 18049 }, 180.5), false, "180.49 must not pass");

console.log("Payment gate: 10 cases pass — underpayment, wrong currency and unfinished payments all rejected.");
