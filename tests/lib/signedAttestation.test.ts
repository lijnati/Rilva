import { keccak256, stringToBytes, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { parseSignedAttestation, serializeSignedAttestation } from "@/lib/app/signedAttestation";
import type { Attestation } from "@/lib/contracts";

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
