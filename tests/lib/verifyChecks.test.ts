/**
 * The public verification checklist (ARCHITECTURE.md §4.3) evaluated from on-chain facts and a browser
 * recomputation. Built on the real OND 2021 / 2023 evidence; tampering must turn the right check red.
 */
import { keccak256, stringToBytes, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { buildVerification, type VerificationInput } from "@/lib/app/verifyChecks";
import { canonicalSpec, getClimateEvidence, SCENARIOS, type ScenarioId } from "@/lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "@/lib/climate/node";
import { buildAttestation, campaignTermsFromSpec, CampaignStatus } from "@/lib/contracts";

const FUNDER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address;
const ATTESTOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
const BENEFICIARY = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address;
const STRANGER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address;

async function settledInput(id: ScenarioId): Promise<VerificationInput> {
  const manifest = await readManifestFromDisk();
  const r = await getClimateEvidence(SCENARIOS[id].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
  const spec = canonicalSpec(SCENARIOS[id].spec);
  const terms = campaignTermsFromSpec(SCENARIOS[id].spec);
  const attestation = buildAttestation({ evidence: r.artifact, campaignId: 1n, expiresAt: 2_000_000_000n });
  const triggered = r.artifact.core.result.triggered;
  const amount = 10n ** 16n;
  return {
    campaign: {
      funder: FUNDER,
      beneficiary: BENEFICIARY,
      attestor: ATTESTOR,
      amount,
      settlementDeadline: 2_000_000_000n,
      observationStart: terms.observationStart,
      observationEnd: terms.observationEnd,
      thresholdBps: terms.thresholdBps,
      status: triggered ? CampaignStatus.Released : CampaignStatus.Refunded,
      indexBps: attestation.indexBps,
      specHash: terms.specHash,
      evidenceHash: r.artifact.evidenceDigest,
    },
    spec,
    settled: { indexBps: attestation.indexBps, thresholdBps: terms.thresholdBps, triggered, recipient: triggered ? BENEFICIARY : FUNDER, amount, evidenceHash: r.artifact.evidenceDigest },
    refundReason: triggered ? null : "NotTriggered",
    submitted: attestation,
    recoveredSigner: ATTESTOR,
    recomputed: { ok: true, indexBps: r.artifact.core.result.indexBps, evidenceDigest: r.artifact.evidenceDigest, mode: "snapshot" },
  };
}

const statusOf = (v: ReturnType<typeof buildVerification>, id: string) => v.checks.find((c) => c.id === id)?.status;

describe("buildVerification", async () => {
  const a = await settledInput("yabelo-ond-2021");
  const b = await settledInput("yabelo-ond-2023");

  it("all seven checks pass for a genuine Released settlement (OND 2021)", () => {
    const v = buildVerification(a);
    expect(v.checks.map((c) => c.id)).toEqual(["spec-hash", "spec-terms", "index", "evidence-hash", "signer", "outcome", "funds"]);
    expect(v.checks.every((c) => c.status === "pass")).toBe(true);
    expect(v.summary).toBe("all-passed");
  });

  it("all checks pass for a genuine non-triggering refund (OND 2023)", () => {
    expect(buildVerification(b).summary).toBe("all-passed");
  });

  it("each check carries what kind of guarantee it is", () => {
    const kinds = Object.fromEntries(buildVerification(a).checks.map((c) => [c.id, c.kind]));
    expect(kinds).toEqual({
      "spec-hash": "authentic",
      "spec-terms": "authentic",
      index: "reproducible",
      "evidence-hash": "reproducible",
      signer: "attested",
      outcome: "contract",
      funds: "contract",
    });
  });

  it("a tampered spec string fails the spec hash check", () => {
    const v = buildVerification({ ...a, spec: a.spec!.replace("6000", "9000") });
    expect(statusOf(v, "spec-hash")).toBe("fail");
    expect(v.summary).toBe("failed");
  });

  it("a recomputed digest that differs from the on-chain evidence hash fails", () => {
    const v = buildVerification({ ...a, recomputed: { ok: true, indexBps: 3363, evidenceDigest: keccak256(stringToBytes("other")), mode: "live" } });
    expect(statusOf(v, "evidence-hash")).toBe("fail");
    expect(statusOf(v, "index")).toBe("pass");
  });

  it("a signer other than the attestor fails", () => {
    expect(statusOf(buildVerification({ ...a, recoveredSigner: STRANGER }), "signer")).toBe("fail");
  });

  it("funds sent to anyone but the rule's recipient fail", () => {
    expect(statusOf(buildVerification({ ...a, settled: { ...a.settled!, recipient: FUNDER } }), "funds")).toBe("fail");
  });

  it("a recomputation error is reported as an error, never as a pass", () => {
    const v = buildVerification({ ...a, recomputed: { ok: false, error: "Open-Meteo unreachable and no snapshot" } });
    expect(statusOf(v, "index")).toBe("error");
    expect(statusOf(v, "evidence-hash")).toBe("error");
    expect(v.summary).toBe("incomplete");
  });

  it("while the browser is still recomputing, checks are pending — not errors, not passes", () => {
    const v = buildVerification({ ...a, recomputed: null, submitted: null, recoveredSigner: null, pending: { recompute: true, signer: true } });
    expect(statusOf(v, "index")).toBe("pending");
    expect(statusOf(v, "evidence-hash")).toBe("pending");
    expect(statusOf(v, "signer")).toBe("pending");
    expect(v.summary).toBe("checking");
  });

  it("an Active campaign: settlement checks are not applicable yet", () => {
    const v = buildVerification({
      ...a,
      campaign: { ...a.campaign, status: CampaignStatus.Active, indexBps: 0, evidenceHash: `0x${"0".repeat(64)}` },
      settled: null,
      submitted: null,
      recoveredSigner: null,
      refundReason: null,
    });
    expect(statusOf(v, "spec-hash")).toBe("pass");
    expect(statusOf(v, "signer")).toBe("na");
    expect(statusOf(v, "funds")).toBe("na");
    expect(v.summary).toBe("not-settled");
  });

  it("a timeout refund: no attestation exists, funds must return to the funder", () => {
    const v = buildVerification({
      ...a,
      campaign: { ...a.campaign, status: CampaignStatus.Refunded, indexBps: 0, evidenceHash: `0x${"0".repeat(64)}` },
      settled: null,
      submitted: null,
      recoveredSigner: null,
      refundReason: "Timeout",
      refund: { recipient: FUNDER, amount: a.campaign.amount },
    });
    expect(statusOf(v, "signer")).toBe("na");
    expect(statusOf(v, "outcome")).toBe("pass");
    expect(statusOf(v, "funds")).toBe("pass");
    expect(v.summary).toBe("all-passed");
  });
});
