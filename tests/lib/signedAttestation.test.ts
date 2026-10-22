import { keccak256, stringToBytes, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { parseSignedAttestation, serializeSignedAttestation, settleReadiness } from "@/lib/app/signedAttestation";
import { CampaignStatus, type Attestation, type CampaignStatusValue } from "@/lib/contracts";

const attestation: Attestation = {
  campaignId: 3n,
  specHash: keccak256(stringToBytes("s")),
  evidenceHash: keccak256(stringToBytes("e")),
  indexBps: 4461,
  observationStart: 20221001,
  observationEnd: 20221231,
  expiresAt: 1_800_000_000n,
};
const signature = `0x${"12".repeat(65)}` as Hex;

describe("signed attestation export / import", () => {
  it("round-trips exactly, with bigints as decimal strings", () => {
    const json = serializeSignedAttestation({ attestation, signature, chainId: 84532, escrow: "0x5FbDB2315678afecb367f032d93F642f64180aa3" });
    expect(json).toContain('"campaignId": "3"');
    const back = parseSignedAttestation(json);
    expect(back.attestation).toEqual(attestation);
    expect(back.signature).toBe(signature);
    expect(back.chainId).toBe(84532);
  });

  it("rejects malformed input with a readable reason", () => {
    expect(() => parseSignedAttestation("not json")).toThrow(/JSON/);
    const good = JSON.parse(serializeSignedAttestation({ attestation, signature, chainId: 84532, escrow: "0x5FbDB2315678afecb367f032d93F642f64180aa3" }));
    expect(() => parseSignedAttestation(JSON.stringify({ ...good, signature: "0x12" }))).toThrow(/signature/);
    expect(() => parseSignedAttestation(JSON.stringify({ ...good, attestation: { ...good.attestation, indexBps: -1 } }))).toThrow(/indexBps/);
    expect(() => parseSignedAttestation(JSON.stringify({ ...good, attestation: { ...good.attestation, specHash: "0x12" } }))).toThrow(/specHash/);
    expect(() => parseSignedAttestation(JSON.stringify({ ...good, schema: "x" }))).toThrow(/schema/);
  });
});

describe("settleReadiness (checked before the submit button is offered)", () => {
  const escrow = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
  const signed = { attestation, signature, chainId: 84532, escrow };
  const campaign = {
    status: CampaignStatus.Active as CampaignStatusValue,
    specHash: attestation.specHash,
    observationStart: attestation.observationStart,
    observationEnd: attestation.observationEnd,
    settlementDeadline: 1_800_000_500n,
  };
  const ctx = { campaignId: 3n, chainId: 84532, escrow, chainNow: 1_799_999_000n };

  it("is ready when every binding matches and nothing has expired", () => {
    expect(settleReadiness(signed, campaign, ctx)).toEqual({ ok: true });
  });

  it("accepts the expiry second itself (the contract rejects only now > expiresAt)", () => {
    expect(settleReadiness(signed, campaign, { ...ctx, chainNow: attestation.expiresAt })).toEqual({ ok: true });
  });

  it.each([
    ["wrong-target", signed, campaign, { ...ctx, chainId: 31337 }],
    ["wrong-target", { ...signed, escrow: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const }, campaign, ctx],
    ["wrong-campaign", signed, campaign, { ...ctx, campaignId: 4n }],
    ["not-active", signed, { ...campaign, status: CampaignStatus.Released }, ctx],
    ["spec-mismatch", signed, { ...campaign, specHash: keccak256(stringToBytes("other")) }, ctx],
    ["period-mismatch", signed, { ...campaign, observationEnd: 20221230 }, ctx],
    ["expired", signed, campaign, { ...ctx, chainNow: attestation.expiresAt + 1n }],
    ["window-closed", signed, { ...campaign, settlementDeadline: ctx.chainNow }, ctx],
  ] as const)("blocks %s with a plain reason", (code, s, c, x) => {
    const r = settleReadiness(s, c, x);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe(code);
      expect(r.reason.length).toBeGreaterThan(10);
    }
  });
});
