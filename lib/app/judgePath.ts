/**
 * The no-wallet judge path: pick real, on-chain demo campaigns to link from the landing page.
 * Never invents ids — if a kind of campaign does not exist on the configured contract, it is null.
 */
import { CampaignStatus, type Campaign } from "../contracts";

export interface DemoPicks {
  /** Newest campaign the contract released to its beneficiary. */
  released: bigint | null;
  /** Newest campaign refunded because the attested index did not meet the rule (not a timeout). */
  refunded: bigint | null;
  /** Open active campaign with the most settlement time left (for "Try to break it"; ties → newest). */
  active: bigint | null;
}

export function pickDemoCampaigns(rows: Array<{ id: bigint; c: Campaign }>, chainNow: bigint): DemoPicks {
  const newest = (pred: (c: Campaign) => boolean) =>
    rows.filter((r) => pred(r.c)).reduce<bigint | null>((best, r) => (best === null || r.id > best ? r.id : best), null);
  return {
    released: newest((c) => c.status === CampaignStatus.Released),
    // settle() writes indexBps; a timeout refund leaves it at 0, so a non-zero index means "rule not met".
    refunded: newest((c) => c.status === CampaignStatus.Refunded && c.indexBps > c.thresholdBps),
    active: rows
      .filter((r) => r.c.status === CampaignStatus.Active && chainNow < r.c.settlementDeadline)
      .reduce<{ id: bigint; d: bigint } | null>(
        (best, r) => (best === null || r.c.settlementDeadline > best.d || (r.c.settlementDeadline === best.d && r.id > best.id) ? { id: r.id, d: r.c.settlementDeadline } : best),
        null,
      )?.id ?? null,
  };
}
