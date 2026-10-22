/**
 * Portable signed attestation ("rilva.signed-attestation.v1"), so an attestor can hand a signature to
 * anyone who will submit settle(). Parsing is strict; the contract still re-verifies everything.
 */
import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import { CampaignStatus, type Attestation, type Campaign } from "../contracts";

const SCHEMA = "rilva.signed-attestation.v1";

export interface SignedAttestation {
  attestation: Attestation;
  signature: Hex;
  chainId: number;
  escrow: Address;
}

export function serializeSignedAttestation(s: SignedAttestation): string {
  const a = s.attestation;
  return JSON.stringify(
    {
      schema: SCHEMA,
      chainId: s.chainId,
      escrow: s.escrow,
      attestation: { ...a, campaignId: a.campaignId.toString(), expiresAt: a.expiresAt.toString() },
      signature: s.signature,
    },
    null,
    2,
  );
}

const bytes32 = (v: unknown, name: string): Hex => {
  if (typeof v !== "string" || !isHex(v) || v.length !== 66) throw new Error(`${name} must be a 32-byte 0x hex value`);
  return v;
};
const uint = (v: unknown, name: string, max: bigint): bigint => {
  if (typeof v !== "string" && typeof v !== "number") throw new Error(`${name} must be an unsigned integer`);
  const s = String(v);
  if (!/^\d{1,78}$/.test(s)) throw new Error(`${name} must be an unsigned integer`);
  const n = BigInt(s);
  if (n > max) throw new Error(`${name} is out of range`);
  return n;
};
const U32 = (1n << 32n) - 1n;

export function parseSignedAttestation(text: string): SignedAttestation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON.");
  }
  const o = raw as Record<string, unknown>;
  if (o?.schema !== SCHEMA) throw new Error(`Unknown schema; expected ${SCHEMA}.`);
  const a = (o.attestation ?? {}) as Record<string, unknown>;
  if (typeof o.signature !== "string" || !isHex(o.signature) || o.signature.length !== 132) throw new Error("signature must be 65 bytes of 0x hex");
  if (typeof o.escrow !== "string" || !isAddress(o.escrow, { strict: false })) throw new Error("escrow must be an address");
  return {
    chainId: Number(uint(o.chainId, "chainId", 1n << 53n)),
    escrow: getAddress(o.escrow),
    signature: o.signature,
    attestation: {
      campaignId: uint(a.campaignId, "campaignId", (1n << 256n) - 1n),
      specHash: bytes32(a.specHash, "specHash"),
      evidenceHash: bytes32(a.evidenceHash, "evidenceHash"),
      indexBps: Number(uint(a.indexBps, "indexBps", U32)),
      observationStart: Number(uint(a.observationStart, "observationStart", U32)),
      observationEnd: Number(uint(a.observationEnd, "observationEnd", U32)),
      expiresAt: uint(a.expiresAt, "expiresAt", (1n << 64n) - 1n),
    },
  };
}

export type SettleBlock = "wrong-target" | "wrong-campaign" | "not-active" | "spec-mismatch" | "period-mismatch" | "expired" | "window-closed";
export type SettleReadiness = { ok: true } | { ok: false; code: SettleBlock; reason: string };

/**
 * Whether a signed attestation can still settle this campaign, judged by chain time exactly as
 * RilvaEscrow.settle() would. Lets the UI refuse a stale, foreign or already-used attestation with a
 * clear reason instead of offering a submit button that can only revert. The contract stays authoritative.
 */
export function settleReadiness(
  s: SignedAttestation,
  c: Pick<Campaign, "status" | "specHash" | "observationStart" | "observationEnd" | "settlementDeadline">,
  ctx: { campaignId: bigint; chainId: number; escrow: Address; chainNow: bigint },
): SettleReadiness {
  const a = s.attestation;
  if (s.chainId !== ctx.chainId || s.escrow.toLowerCase() !== ctx.escrow.toLowerCase())
    return { ok: false, code: "wrong-target", reason: "This attestation was signed for a different chain or contract." };
  if (a.campaignId !== ctx.campaignId) return { ok: false, code: "wrong-campaign", reason: `This attestation is for campaign #${a.campaignId}, not #${ctx.campaignId}.` };
  if (c.status !== CampaignStatus.Active) return { ok: false, code: "not-active", reason: "This campaign is already settled or refunded; it cannot be settled again." };
  if (a.specHash.toLowerCase() !== c.specHash.toLowerCase()) return { ok: false, code: "spec-mismatch", reason: "The attestation is for a different climate specification than this campaign." };
  if (a.observationStart !== c.observationStart || a.observationEnd !== c.observationEnd)
    return { ok: false, code: "period-mismatch", reason: "The attestation covers a different observation period than this campaign." };
  if (ctx.chainNow >= c.settlementDeadline) return { ok: false, code: "window-closed", reason: "The settlement deadline has passed; only a timeout refund to the funder is possible." };
  if (ctx.chainNow > a.expiresAt) return { ok: false, code: "expired", reason: "This attestation has expired. The attestor must recompute and sign again." };
  return { ok: true };
}
