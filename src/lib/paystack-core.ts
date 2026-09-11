/**
 * The pure half of the Paystack integration, split out for the same reason as
 * availability-core: no "server-only" import, so a plain node script can test
 * it. This is a money path — the one place that decides whether an appointment
 * counts as paid — and it should not be first exercised by a real client.
 */

/** GHS is a two-decimal currency; Paystack takes the amount in pesewas. */
export const SUBUNIT = 100;
export const CURRENCY = "GHS";

export interface VerifiedTransaction {
  status: string;
  amount: number;
  currency: string;
  reference: string;
  metadata?: Record<string, string> | null;
}

/**
 * Every condition here is load-bearing. `status` must be success, or a pending
 * Mobile Money prompt confirms a booking that was never paid for. `currency`
 * must match, or 250 of a weaker currency passes as GH₵250. The amount is
 * compared in pesewas, because 0.1 + 0.2 in floating point is not 0.3 and a
 * cedi comparison would reject exact payments at random.
 */
export function isPaidInFull(transaction: VerifiedTransaction, expectedGHS: number): boolean {
  return (
    transaction.status === "success" &&
    transaction.currency === CURRENCY &&
    transaction.amount >= Math.round(expectedGHS * SUBUNIT)
  );
}
