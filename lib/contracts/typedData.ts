/**
 * EIP-712 attestation — the single TypeScript definition. Solidity's ATTESTATION_TYPEHASH is
 * checked against ATTESTATION_TYPE_STRING by tests/contracts/RilvaEscrow.test.ts.
 */
import { hashTypedData, recoverTypedDataAddress, isAddressEqual, type Address, type Hex, type TypedDataDomain } from "viem";
import { verifyEvidenceArtifact, type EvidenceArtifact } from "../climate/evidence";
import { isoToYyyymmdd, toUint32 } from "./spec";

export const EIP712_DOMAIN_NAME = "RilvaEscrow";
export const EIP712_DOMAIN_VERSION = "1";

export const ATTESTATION_TYPES = {
  Attestation: [
    { name: "campaignId", type: "uint256" },
    { name: "specHash", type: "bytes32" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "indexBps", type: "uint32" },
    { name: "observationStart", type: "uint32" },
    { name: "observationEnd", type: "uint32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const ATTESTATION_TYPE_STRING =
  "Attestation(uint256 campaignId,bytes32 specHash,bytes32 evidenceHash,uint32 indexBps,uint32 observationStart,uint32 observationEnd,uint64 expiresAt)";

export interface Attestation {
  campaignId: bigint;
  specHash: Hex;
  evidenceHash: Hex;
  indexBps: number;
  observationStart: number;
  observationEnd: number;
  expiresAt: bigint;
}

export interface RilvaDomain {
  name: typeof EIP712_DOMAIN_NAME;
  version: typeof EIP712_DOMAIN_VERSION;
  chainId: number;
  verifyingContract: Address;
}

export function rilvaDomain(chainId: number, verifyingContract: Address): RilvaDomain {
  return { name: EIP712_DOMAIN_NAME, version: EIP712_DOMAIN_VERSION, chainId, verifyingContract };
}

/**
 * Builds the attestation for a campaign from a Phase 1 evidence artifact. Refuses artifacts whose
 * digest or result does not verify, so a tampered file can never be turned into a signable payload.
 */
export function buildAttestation(params: { evidence: EvidenceArtifact; campaignId: bigint; expiresAt: bigint }): Attestation {
  const { evidence, campaignId, expiresAt } = params;
  const check = verifyEvidenceArtifact(evidence);
  if (!check.ok) throw new Error(`evidence artifact does not verify: ${check.problems.join("; ")}`);
  const core = evidence.core;
  return {
    campaignId,
    specHash: core.specHash,
    evidenceHash: evidence.evidenceDigest,
    indexBps: toUint32(core.result.indexBps, "indexBps"),
    observationStart: isoToYyyymmdd(core.periods.observed.start),
    observationEnd: isoToYyyymmdd(core.periods.observed.end),
    expiresAt,
  };
}

export function attestationTypedData(domain: RilvaDomain, attestation: Attestation) {
  return {
    domain: domain as TypedDataDomain,
    types: ATTESTATION_TYPES,
    primaryType: "Attestation" as const,
    message: attestation,
  };
}

/** The EIP-712 digest; equals RilvaEscrow.hashAttestation() on the same chain and contract. */
export function hashAttestation(domain: RilvaDomain, attestation: Attestation): Hex {
  return hashTypedData(attestationTypedData(domain, attestation));
}

/** Anything that can sign EIP-712 typed data: a viem LocalAccount or a wrapped wallet client. */
export interface TypedDataSigner {
  signTypedData: (args: ReturnType<typeof attestationTypedData>) => Promise<Hex>;
}

/** Signs with the attestor's own key/wallet. Rilva never holds attestor keys on a server. */
export function signAttestation(signer: TypedDataSigner, domain: RilvaDomain, attestation: Attestation): Promise<Hex> {
  return signer.signTypedData(attestationTypedData(domain, attestation));
}

export function recoverAttestationSigner(domain: RilvaDomain, attestation: Attestation, signature: Hex): Promise<Address> {
  return recoverTypedDataAddress({ ...attestationTypedData(domain, attestation), signature });
}

export async function verifyAttestation(domain: RilvaDomain, attestation: Attestation, signature: Hex, attestor: Address): Promise<boolean> {
  try {
    return isAddressEqual(await recoverAttestationSigner(domain, attestation, signature), attestor);
  } catch {
    return false;
  }
}
