/**
 * Real historical integration: Phase 1 evidence (committed ERA5 snapshots) → EIP-712 attestation →
 * RilvaEscrow settlement. No percentages are hardcoded here: every on-chain argument is derived
 * from the evidence artifact and the canonical spec. Only the expected classification is asserted.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { keccak256, stringToBytes } from "viem";
import { getClimateEvidence, verifyEvidenceArtifact } from "../../lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "../../lib/climate/node";
import { SCENARIOS, type ScenarioId } from "../../lib/climate/scenarios";
import {
  buildAttestation,
  campaignTermsFromSpec,
  CampaignStatus,
  parseRilvaEvents,
  recoverAttestationSigner,
  rilvaDomain,
  RILVA_ESCROW_ABI,
} from "../../lib/contracts";
import { AMOUNT, attestorAccount, baseFixture, createCampaign, DAY, networkHelpers, now, sign, viem } from "./helpers";

const load = () => networkHelpers.loadFixture(baseFixture);
const manifest = await readManifestFromDisk(); // throws (test failure) if snapshots are missing — never substituted

async function evidenceFor(id: ScenarioId) {
  return getClimateEvidence(SCENARIOS[id].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
}

const expected: Array<[ScenarioId, "Released" | "Refunded"]> = [
  ["yabelo-ond-2021", "Released"],
  ["yabelo-ond-2022", "Released"],
  ["yabelo-ond-2023", "Refunded"],
];

describe("Phase 1 evidence → RilvaEscrow (real ERA5 snapshots)", () => {
  for (const [scenario, outcome] of expected) {
    it(`${scenario} settles as ${outcome}`, async () => {
      const f = await load();
      const r = await evidenceFor(scenario);
      assert.equal(r.provenance.mode, "snapshot");
      assert.equal(r.integrity.snapshotHashesVerified && r.integrity.digestRecomputed, true);

      const terms = campaignTermsFromSpec(SCENARIOS[scenario].spec);
      assert.equal(terms.specHash, r.artifact.core.specHash);
      const { id } = await createCampaign(f, { terms });

      const attestation = buildAttestation({ evidence: r.artifact, campaignId: id, expiresAt: (await now()) + DAY });
      const signature = await sign(f, attestation);
      const domain = rilvaDomain(f.chainId, f.escrow.address);
      assert.equal(await recoverAttestationSigner(domain, attestation, signature), attestorAccount.address);

      const beneficiaryBefore = await f.publicClient.getBalance({ address: f.beneficiary.account.address });
      const hash = await f.escrow.write.settle([attestation, signature], { account: f.relayer.account });
      const receipt = await f.publicClient.waitForTransactionReceipt({ hash });
      const events = parseRilvaEvents(receipt.logs);
      const settled = events.find((e) => e.eventName === "CampaignSettled");
      assert.ok(settled && settled.eventName === "CampaignSettled");
      assert.equal(settled.args.evidenceHash, r.artifact.evidenceDigest);
      assert.equal(settled.args.indexBps, r.artifact.core.result.indexBps);
      // The contract's own decision must agree with the off-chain SRPN-v1 decision.
      assert.equal(settled.args.triggered, r.artifact.core.result.triggered);

      const c = await f.escrow.read.getCampaign([id]);
      assert.equal(c.status, CampaignStatus[outcome]);
      assert.equal(c.evidenceHash, r.artifact.evidenceDigest);
      const beneficiaryAfter = await f.publicClient.getBalance({ address: f.beneficiary.account.address });
      assert.equal(beneficiaryAfter - beneficiaryBefore, outcome === "Released" ? AMOUNT : 0n);
    });
  }

  it("an altered evidence artifact is rejected by public verification and cannot be relayed on-chain", async () => {
    const f = await load();
    const r = await evidenceFor("yabelo-ond-2023");
    const terms = campaignTermsFromSpec(SCENARIOS["yabelo-ond-2023"].spec);
    const { id } = await createCampaign(f, { terms });
    const genuine = buildAttestation({ evidence: r.artifact, campaignId: id, expiresAt: (await now()) + DAY });
    const signature = await sign(f, genuine);

    // Off-chain: editing the index in the artifact is detected by the Phase 1 verifier.
    const altered = structuredClone(r.artifact);
    altered.core.result.indexBps = 3000;
    altered.core.result.triggered = true;
    const check = verifyEvidenceArtifact(altered);
    assert.equal(check.ok, false);
    assert.throws(() => buildAttestation({ evidence: altered, campaignId: id, expiresAt: genuine.expiresAt }), /does not verify/);

    // On-chain: a relayer reusing the genuine signature with the altered index/digest is rejected.
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...genuine, indexBps: 3000 }, signature]),
      f.escrow,
      "InvalidSigner",
    );
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...genuine, evidenceHash: keccak256(stringToBytes("altered")) }, signature]),
      f.escrow,
      "InvalidSigner",
    );
    // The genuine attestation still settles correctly afterwards.
    await f.escrow.write.settle([genuine, signature]);
    assert.equal((await f.escrow.read.getCampaign([id])).status, CampaignStatus.Refunded);
  });

  it("evidence for a different season cannot settle a campaign (spec and period binding)", async () => {
    const f = await load();
    const { id } = await createCampaign(f, { terms: campaignTermsFromSpec(SCENARIOS["yabelo-ond-2021"].spec) });
    const wrongSeason = await evidenceFor("yabelo-ond-2022");
    const a = buildAttestation({ evidence: wrongSeason.artifact, campaignId: id, expiresAt: (await now()) + DAY });
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, await sign(f, a)]), f.escrow, "SpecMismatch");
  });

  it("the exported ABI is identical to the compiled artifact (no drift)", async () => {
    const artifact = JSON.parse(await readFile("artifacts/contracts/RilvaEscrow.sol/RilvaEscrow.json", "utf8")) as { abi: unknown };
    assert.deepEqual(JSON.parse(JSON.stringify(RILVA_ESCROW_ABI)), artifact.abi);
  });
});
