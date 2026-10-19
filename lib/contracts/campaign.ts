/**
 * Typed read helpers, write-call preparation, event parsing and error explanations for RilvaEscrow.
 * Write helpers return plain `{ address, abi, functionName, args, value }` objects usable with
 * viem's `writeContract`/`simulateContract` or wagmi's `useWriteContract` (Phase 3).
 */
import { parseEventLogs, type Address, type Hex, type Log, type PublicClient } from "viem";
import { RILVA_ESCROW_ABI } from "./abi";
import type { CampaignTerms } from "./spec";
import type { Attestation } from "./typedData";

export const CampaignStatus = { None: 0, Active: 1, Released: 2, Refunded: 3 } as const;
export type CampaignStatusValue = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const RefundReason = { NotTriggered: 0, Timeout: 1 } as const;
export type RefundReasonValue = (typeof RefundReason)[keyof typeof RefundReason];

export interface Campaign {
  funder: Address;
  beneficiary: Address;
  attestor: Address;
  amount: bigint;
  settlementDeadline: bigint;
  observationStart: number;
  observationEnd: number;
  thresholdBps: number;
  status: CampaignStatusValue;
  indexBps: number;
  specHash: Hex;
  evidenceHash: Hex;
}

// ── reads ────────────────────────────────────────────────────────────────────────────────────

export async function readCampaignCount(client: PublicClient, escrow: Address): Promise<bigint> {
  return client.readContract({ address: escrow, abi: RILVA_ESCROW_ABI, functionName: "campaignCount" });
}

export async function readCampaign(client: PublicClient, escrow: Address, campaignId: bigint): Promise<Campaign> {
  const c = await client.readContract({ address: escrow, abi: RILVA_ESCROW_ABI, functionName: "getCampaign", args: [campaignId] });
  return { ...c, status: c.status as CampaignStatusValue };
}

// ── write preparation ────────────────────────────────────────────────────────────────────────

export function prepareCreateCampaign(p: {
  escrow: Address;
  beneficiary: Address;
  attestor: Address;
  terms: CampaignTerms;
  settlementDeadline: bigint;
  value: bigint;
}) {
  return {
    address: p.escrow,
    abi: RILVA_ESCROW_ABI,
    functionName: "createCampaign" as const,
    args: [
      p.beneficiary,
      p.attestor,
      p.terms.observationStart,
      p.terms.observationEnd,
      p.terms.thresholdBps,
      p.settlementDeadline,
      p.terms.spec,
    ] as const,
    value: p.value,
  };
}

export function prepareSettle(p: { escrow: Address; attestation: Attestation; signature: Hex }) {
  return {
    address: p.escrow,
    abi: RILVA_ESCROW_ABI,
    functionName: "settle" as const,
    args: [p.attestation, p.signature] as const,
  };
}

export function prepareRefundAfterDeadline(p: { escrow: Address; campaignId: bigint }) {
  return {
    address: p.escrow,
    abi: RILVA_ESCROW_ABI,
    functionName: "refundAfterDeadline" as const,
    args: [p.campaignId] as const,
  };
}

// ── events ───────────────────────────────────────────────────────────────────────────────────

/** Decodes RilvaEscrow events from receipt logs (non-matching logs are ignored). */
export function parseRilvaEvents(logs: Log[]) {
  return parseEventLogs({ abi: RILVA_ESCROW_ABI, logs });
}

/** Campaign id created in a receipt, or null. */
export function campaignIdFromReceipt(logs: Log[]): bigint | null {
  const created = parseRilvaEvents(logs).find((e) => e.eventName === "CampaignCreated");
  return created && created.eventName === "CampaignCreated" ? created.args.campaignId : null;
}

// ── errors ───────────────────────────────────────────────────────────────────────────────────

const ERROR_TEXT: Record<string, string> = {
  ZeroValue: "A campaign must be funded with more than 0 ETH.",
  AmountTooLarge: "The amount is larger than the contract supports.",
  ZeroAddress: "Beneficiary and attestor must be real addresses.",
  RoleConflict: "Funder, beneficiary and attestor must be three different addresses.",
  InvalidThreshold: "The threshold must be between 0.01 % and 100 % of normal.",
  InvalidObservationPeriod: "The observation period is not a valid date range.",
  InvalidSettlementDeadline: "The settlement deadline must be between 10 minutes and 366 days from now.",
  InvalidSpec: "The climate specification is empty or too long.",
  CampaignNotFound: "No campaign exists with this id.",
  CampaignNotActive: "This campaign is already settled or refunded; it cannot be settled again.",
  SettlementWindowClosed: "The settlement deadline has passed; only a refund to the funder is possible.",
  SettlementWindowOpen: "The settlement deadline has not passed yet, so a timeout refund is not allowed.",
  AttestationExpired: "This attestation has expired; the attestor must sign a new one.",
  SpecMismatch: "The attestation is for a different climate specification than this campaign.",
  ObservationPeriodMismatch: "The attestation covers a different observation period than this campaign.",
  InvalidSigner: "The attestation was not signed by this campaign's attestor, or it was altered after signing.",
  TransferFailed: "The recipient rejected the ETH transfer; nothing was changed.",
  ECDSAInvalidSignature: "The signature is invalid.",
  ECDSAInvalidSignatureLength: "The signature has the wrong length.",
  ECDSAInvalidSignatureS: "The signature is malleated (high-s) and was rejected.",
  ReentrancyGuardReentrantCall: "Re-entrant call blocked.",
};

/** Plain-language explanation for a decoded custom error (e.g. viem's ContractFunctionRevertedError.data). */
export function decodeRilvaError(error: { name?: string; errorName?: string }): string {
  const name = error.errorName ?? error.name ?? "UnknownError";
  return ERROR_TEXT[name] ?? `The contract rejected the call (${name}).`;
}
