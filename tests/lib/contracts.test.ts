import { keccak256, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { getClimateEvidence, SCENARIOS } from "@/lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "@/lib/climate/node";
import {
  ATTESTATION_TYPE_STRING,
  ATTESTATION_TYPES,
  BASE_SEPOLIA_CHAIN_ID,
  buildAttestation,
  campaignTermsFromSpec,
  CampaignStatus,
  decodeRilvaError,
  explorerAddressUrl,
  explorerTxUrl,
  hashAttestation,
  isoToYyyymmdd,
  readEscrowConfig,
  recoverAttestationSigner,
  rilvaDomain,
  signAttestation,
  toUint32,
  verifyAttestation,
  yyyymmddToIso,
} from "@/lib/contracts";

// Deterministic test-only key derived from a public string — worthless, never funded.
const TEST_KEY = keccak256(stringToBytes("rilva-lib-test-attestor"));
const ESCROW = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

describe("dates for the contract (YYYYMMDD)", () => {
  it("converts ISO dates both ways", () => {
    expect(isoToYyyymmdd("2021-10-01")).toBe(20211001);
    expect(isoToYyyymmdd("2020-02-29")).toBe(20200229);
    expect(yyyymmddToIso(20211231)).toBe("2021-12-31");
  });

  it("rejects invalid dates instead of guessing", () => {
    expect(() => isoToYyyymmdd("2021-02-29")).toThrow(/INVALID_DATE/);
    expect(() => yyyymmddToIso(20211301)).toThrow(/INVALID_DATE/);
    expect(() => yyyymmddToIso(2021101)).toThrow(/INVALID_DATE/);
  });
});

describe("toUint32", () => {
  it("accepts integers in range and rejects everything else", () => {
    expect(toUint32(0, "x")).toBe(0);
    expect(toUint32(4294967295, "x")).toBe(4294967295);
    expect(() => toUint32(4294967296, "x")).toThrow(/uint32/);
    expect(() => toUint32(-1, "x")).toThrow(/uint32/);
    expect(() => toUint32(1.5, "x")).toThrow(/uint32/);
  });
});

describe("campaignTermsFromSpec (reuses the Phase 1 canonical spec)", () => {
  it("derives the exact on-chain terms from the OND 2021 spec", async () => {
    const spec = SCENARIOS["yabelo-ond-2021"].spec;
    const terms = campaignTermsFromSpec(spec);
    const { specHash, canonicalSpec } = await import("@/lib/climate");
    expect(terms.spec).toBe(canonicalSpec(spec));
    expect(terms.specHash).toBe(specHash(spec));
    expect(terms.observationStart).toBe(20211001);
    expect(terms.observationEnd).toBe(20211231);
    expect(terms.thresholdBps).toBe(spec.thresholdBps);
  });
});

describe("EIP-712 typed data", () => {
  it("has a single type definition whose encoded string matches the Solidity typehash string", () => {
    const encoded = `Attestation(${ATTESTATION_TYPES.Attestation.map((f) => `${f.type} ${f.name}`).join(",")})`;
    expect(encoded).toBe(ATTESTATION_TYPE_STRING);
  });

  it("builds the attestation from real Phase 1 evidence without hardcoded values", async () => {
    const manifest = await readManifestFromDisk();
    const r = await getClimateEvidence(SCENARIOS["yabelo-ond-2021"].spec, {
      mode: "snapshot",
      manifest,
      readSnapshotFile: readSnapshotFileFromDisk,
    });
    const a = buildAttestation({ evidence: r.artifact, campaignId: 7n, expiresAt: 2_000_000_000n });
    expect(a).toEqual({
      campaignId: 7n,
      specHash: r.artifact.core.specHash,
      evidenceHash: r.artifact.evidenceDigest,
      indexBps: r.artifact.core.result.indexBps,
      observationStart: 20211001,
      observationEnd: 20211231,
      expiresAt: 2_000_000_000n,
    });
  });

  it("refuses to build an attestation from an artifact whose digest does not verify", async () => {
    const manifest = await readManifestFromDisk();
    const r = await getClimateEvidence(SCENARIOS["yabelo-ond-2023"].spec, {
      mode: "snapshot",
      manifest,
      readSnapshotFile: readSnapshotFileFromDisk,
    });
    const tampered = structuredClone(r.artifact);
    tampered.core.result.indexBps = 3000;
    expect(() => buildAttestation({ evidence: tampered, campaignId: 1n, expiresAt: 2_000_000_000n })).toThrow(/does not verify/);
  });

  it("signs, recovers and verifies off-chain; any field change breaks it", async () => {
    const account = privateKeyToAccount(TEST_KEY);
    const a = {
      campaignId: 1n,
      specHash: `0x${"11".repeat(32)}` as const,
      evidenceHash: `0x${"22".repeat(32)}` as const,
      indexBps: 3363,
      observationStart: 20211001,
      observationEnd: 20211231,
      expiresAt: 2_000_000_000n,
    };
    const domain = rilvaDomain(BASE_SEPOLIA_CHAIN_ID, ESCROW);
    const sig = await signAttestation(account, domain, a);
    expect(await recoverAttestationSigner(domain, a, sig)).toBe(account.address);
    expect(await verifyAttestation(domain, a, sig, account.address)).toBe(true);
    expect(await verifyAttestation(domain, { ...a, indexBps: 3364 }, sig, account.address)).toBe(false);
    expect(await verifyAttestation(rilvaDomain(31337, ESCROW), a, sig, account.address)).toBe(false);
    expect(hashAttestation(domain, a)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(domain).toEqual({ name: "RilvaEscrow", version: "1", chainId: 84532, verifyingContract: ESCROW });
  });
});

describe("config and explorer links", () => {
  it("parses public deployment config and rejects malformed values", () => {
    expect(readEscrowConfig({})).toEqual({ address: null, deployBlock: null });
    expect(readEscrowConfig({ NEXT_PUBLIC_RILVA_ESCROW_ADDRESS: ESCROW, NEXT_PUBLIC_RILVA_DEPLOY_BLOCK: "123" })).toEqual({
      address: ESCROW,
      deployBlock: 123n,
    });
    expect(() => readEscrowConfig({ NEXT_PUBLIC_RILVA_ESCROW_ADDRESS: "0x123" })).toThrow(/address/);
    expect(() => readEscrowConfig({ NEXT_PUBLIC_RILVA_ESCROW_ADDRESS: ESCROW, NEXT_PUBLIC_RILVA_DEPLOY_BLOCK: "-1" })).toThrow(/block/);
  });

  it("builds Base Sepolia explorer links", () => {
    expect(explorerTxUrl(`0x${"ab".repeat(32)}`)).toBe(`https://sepolia.basescan.org/tx/0x${"ab".repeat(32)}`);
    expect(explorerAddressUrl(ESCROW)).toBe(`https://sepolia.basescan.org/address/${ESCROW}`);
  });
});

describe("status and error helpers", () => {
  it("exposes the on-chain status enum", () => {
    expect(CampaignStatus).toEqual({ None: 0, Active: 1, Released: 2, Refunded: 3 });
  });

  it("explains known custom errors in plain language", () => {
    expect(decodeRilvaError({ name: "InvalidSigner" })).toMatch(/not signed by this campaign's attestor/);
    expect(decodeRilvaError({ name: "CampaignNotActive" })).toMatch(/already settled/);
    expect(decodeRilvaError({ name: "SomethingElse" })).toMatch(/SomethingElse/);
  });
});
