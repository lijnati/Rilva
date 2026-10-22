/**
 * Campaign view model: only the states the contract has (Active / Released / Refunded), and the actions
 * its rules allow at a given block time (CONTRACTS.md §4). Client-side readiness, not authorisation —
 * the contract re-checks everything.
 */
import type { Address } from "viem";
import { CampaignStatus, type Campaign } from "../contracts";

export type Role = "funder" | "attestor" | "beneficiary" | "visitor";

export interface CampaignView {
  status: "Active" | "Released" | "Refunded" | "NotFound";
  refundReason: "NotTriggered" | "Timeout" | null;
  /** settle() would pass the time check: now < settlementDeadline. */
  windowOpen: boolean;
  canSettle: boolean;
  /** refundAfterDeadline() would pass: now ≥ settlementDeadline. */
  canTimeoutRefund: boolean;
  recipient: Address | null;
  /** true = released, false = refunded on the rule, null = no attested outcome (active or timeout). */
  triggered: boolean | null;
}

export function campaignView(c: Campaign, nowSeconds: bigint, extra: { refundReason?: "NotTriggered" | "Timeout" | null } = {}): CampaignView {
  const windowOpen = nowSeconds < c.settlementDeadline;
  switch (c.status) {
    case CampaignStatus.Active:
      return { status: "Active", refundReason: null, windowOpen, canSettle: windowOpen, canTimeoutRefund: !windowOpen, recipient: null, triggered: null };
    case CampaignStatus.Released:
      return { status: "Released", refundReason: null, windowOpen, canSettle: false, canTimeoutRefund: false, recipient: c.beneficiary, triggered: true };
    case CampaignStatus.Refunded: {
      const reason = extra.refundReason ?? null;
      return {
        status: "Refunded",
        refundReason: reason,
        windowOpen,
        canSettle: false,
        canTimeoutRefund: false,
        recipient: c.funder,
        triggered: reason === "NotTriggered" ? false : null,
      };
    }
    default:
      return { status: "NotFound", refundReason: null, windowOpen: false, canSettle: false, canTimeoutRefund: false, recipient: null, triggered: null };
  }
}

export function rolesOf(c: Pick<Campaign, "funder" | "attestor" | "beneficiary">, address: Address | undefined): Role[] {
  if (!address) return ["visitor"];
  const a = address.toLowerCase();
  const roles: Role[] = [];
  if (c.funder.toLowerCase() === a) roles.push("funder");
  if (c.attestor.toLowerCase() === a) roles.push("attestor");
  if (c.beneficiary.toLowerCase() === a) roles.push("beneficiary");
  return roles.length ? roles : ["visitor"];
}
