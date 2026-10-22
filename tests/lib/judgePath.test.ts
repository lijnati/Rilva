import { describe, expect, it } from "vitest";
import { pickDemoCampaigns } from "@/lib/app/judgePath";
import { CampaignStatus, type Campaign } from "@/lib/contracts";

const A = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const base: Omit<Campaign, "status" | "indexBps" | "settlementDeadline"> = {
  funder: A,
  beneficiary: A,
  attestor: A,
  amount: 1n,
  observationStart: 20211001,
  observationEnd: 20211231,
  thresholdBps: 6000,
  specHash: `0x${"11".repeat(32)}`,
  evidenceHash: `0x${"22".repeat(32)}`,
};
const mk = (id: bigint, status: number, indexBps: number, deadline = 1000n) => ({ id, c: { ...base, status, indexBps, settlementDeadline: deadline } as Campaign });

describe("pickDemoCampaigns", () => {
  it("picks the newest released, rule-not-met refund and open active campaign", () => {
    const picks = pickDemoCampaigns(
      [
        mk(1n, CampaignStatus.Released, 3363),
        mk(2n, CampaignStatus.Refunded, 21322),
        mk(3n, CampaignStatus.Active, 0, 5000n),
        mk(4n, CampaignStatus.Active, 0, 100n), // window closed
        mk(5n, CampaignStatus.Released, 4461),
      ],
      500n,
    );
    expect(picks).toEqual({ released: 5n, refunded: 2n, active: 3n });
  });

  it("a timeout refund (no attested index) is not shown as a rule-not-met refund", () => {
    expect(pickDemoCampaigns([mk(1n, CampaignStatus.Refunded, 0)], 0n).refunded).toBeNull();
  });

  it("returns nulls rather than inventing campaigns", () => {
    expect(pickDemoCampaigns([], 0n)).toEqual({ released: null, refunded: null, active: null });
  });
});
