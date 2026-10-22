import { describe, expect, it } from "vitest";
import { campaignView, rolesOf } from "@/lib/app/campaignView";
import { CampaignStatus, type Campaign } from "@/lib/contracts";

const FUNDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
const ATTESTOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const BENEFICIARY = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;
const ZERO32 = `0x${"0".repeat(64)}` as const;

const c = (over: Partial<Campaign> = {}): Campaign => ({
  funder: FUNDER,
  beneficiary: BENEFICIARY,
  attestor: ATTESTOR,
  amount: 10n ** 16n,
  settlementDeadline: 1000n,
  observationStart: 20211001,
  observationEnd: 20211231,
  thresholdBps: 6000,
  status: CampaignStatus.Active,
  indexBps: 0,
  specHash: `0x${"11".repeat(32)}`,
  evidenceHash: ZERO32,
  ...over,
});

describe("campaignView", () => {
  it("Active before the deadline: settle allowed, timeout refund not", () => {
    const v = campaignView(c(), 999n);
    expect(v).toMatchObject({ status: "Active", canSettle: true, canTimeoutRefund: false, windowOpen: true });
  });

  it("deadline boundary mirrors the contract (settle < deadline ≤ refund)", () => {
    expect(campaignView(c(), 1000n)).toMatchObject({ canSettle: false, canTimeoutRefund: true, windowOpen: false });
  });

  it("Released pays the beneficiary; terminal states allow no actions", () => {
    const v = campaignView(c({ status: CampaignStatus.Released, indexBps: 3363 }), 10n);
    expect(v).toMatchObject({ status: "Released", canSettle: false, canTimeoutRefund: false, recipient: BENEFICIARY, triggered: true });
  });

  it("Refunded after a non-triggering settlement vs a timeout", () => {
    const settled = campaignView(c({ status: CampaignStatus.Refunded, indexBps: 21322 }), 10n, { refundReason: "NotTriggered" });
    expect(settled).toMatchObject({ status: "Refunded", refundReason: "NotTriggered", recipient: FUNDER, triggered: false });
    const timeout = campaignView(c({ status: CampaignStatus.Refunded }), 2000n, { refundReason: "Timeout" });
    expect(timeout).toMatchObject({ refundReason: "Timeout", recipient: FUNDER, triggered: null });
  });

  it("status None means the campaign does not exist", () => {
    expect(campaignView(c({ status: CampaignStatus.None }), 0n).status).toBe("NotFound");
  });
});

describe("rolesOf", () => {
  it("matches addresses case-insensitively; a stranger is a visitor", () => {
    expect(rolesOf(c(), ATTESTOR.toLowerCase() as `0x${string}`)).toEqual(["attestor"]);
    expect(rolesOf(c(), FUNDER)).toEqual(["funder"]);
    expect(rolesOf(c(), "0x90F79bf6EB2c4f870365E785982E1f101E93b906")).toEqual(["visitor"]);
    expect(rolesOf(c(), undefined)).toEqual(["visitor"]);
  });
});
