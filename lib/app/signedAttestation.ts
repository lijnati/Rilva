/**
 * Portable signed attestation ("rilva.signed-attestation.v1"), so an attestor can hand a signature to
 * anyone who will submit settle(). Parsing is strict; the contract still re-verifies everything.
 */
import { getAddress, isAddress, isHex, type Address, type Hex } from "viem";
import type { Attestation } from "../contracts";

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
