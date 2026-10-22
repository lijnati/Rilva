/**
 * Phase 3 integration: the UI's own pure helpers drive a real RilvaEscrow on Hardhat's simulated chain.
 * create form → prepareCreateCampaign → (Phase 1 evidence) buildAttestation → EIP-712 sign → settle →
 * readCampaignHistory / decodeSettleCalldata → buildVerification. Only classifications are asserted;
 * every argument is derived, never hardcoded.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, type Address, type Hex } from "viem";
import { campaignView } from "../../lib/app/campaignView";
import { decodeSettleCalldata, readCampaignHistory } from "../../lib/app/chainHistory";
import { validateCreateForm } from "../../lib/app/createForm";
import { buildVerification } from "../../lib/app/verifyChecks";
import { getClimateEvidence, SCENARIOS, type ScenarioId } from "../../lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "../../lib/climate/node";
import {
  buildAttestation,
  campaignIdFromReceipt,
  prepareCreateCampaign,
  prepareSettle,
  readCampaign,
  recoverAttestationSigner,
  rilvaDomain,
  signAttestation,
} from "../../lib/contracts";
import { attestorAccount, baseFixture, networkHelpers, now } from "./helpers";

const load = () => networkHelpers.loadFixture(baseFixture);
const manifest = await readManifestFromDisk();

async function fullFlow(scenarioId: ScenarioId) {
  const f = await load();
  const funder = getAddress(f.funder.account.address);
  const form = validateCreateForm(
    { scenarioId, beneficiary: f.A.beneficiary, attestor: attestorAccount.address, amountEth: "0.01", deadlineSeconds: 7 * 86400 },
    { now: await now(), funder, balance: await f.publicClient.getBalance({ address: funder }) },
  );
  assert.ok(form.ok, "form should validate");

  const createHash = await f.funder.writeContract({ ...prepareCreateCampaign({ escrow: f.A.escrow, ...form.value }), account: f.funder.account, chain: null });
  const createReceipt = await f.publicClient.waitForTransactionReceipt({ hash: createHash });
  const id = campaignIdFromReceipt(createReceipt.logs);
  assert.ok(id !== null);

  const r = await getClimateEvidence(SCENARIOS[scenarioId].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
  const attestation = buildAttestation({ evidence: r.artifact, campaignId: id, expiresAt: (await now()) + 3600n });
  const domain = rilvaDomain(f.chainId, f.A.escrow);
  const signature = await signAttestation(attestorAccount, domain, attestation);

  const settleHash = await f.relayer.writeContract({ ...prepareSettle({ escrow: f.A.escrow, attestation, signature }), account: f.relayer.account, chain: null });
  await f.publicClient.waitForTransactionReceipt({ hash: settleHash });

  const campaign = await readCampaign(f.publicClient, f.A.escrow, id);
  const history = await readCampaignHistory(f.publicClient, f.A.escrow, id, 0n);
  const tx = await f.publicClient.getTransaction({ hash: history.settled!.txHash });
  const submitted = decodeSettleCalldata(tx.input as Hex);
  const recoveredSigner = await recoverAttestationSigner(domain, submitted.attestation, submitted.signature);

  return { f, id, campaign, history, submitted, recoveredSigner, artifact: r.artifact, form: form.value };
}

describe("Phase 3 app flow on RilvaEscrow (real ERA5 evidence)", () => {
  for (const [scenario, status] of [
    ["yabelo-ond-2021", "Released"],
    ["yabelo-ond-2023", "Refunded"],
  ] as const) {
    it(`${scenario}: create → attest → settle → every verification check passes (${status})`, async () => {
      const x = await fullFlow(scenario);
      assert.equal(x.history.created?.spec, x.form.terms.spec, "event spec is the exact string the form submitted");
      assert.equal(campaignView(x.campaign, await now(), { refundReason: x.history.refunded?.reason ?? null }).status, status);
      assert.deepEqual(x.submitted.attestation.indexBps, x.artifact.core.result.indexBps);

      const v = buildVerification({
        campaign: x.campaign,
        spec: x.history.created!.spec,
        settled: x.history.settled,
        refundReason: x.history.refunded?.reason ?? null,
        submitted: x.submitted.attestation,
        recoveredSigner: x.recoveredSigner as Address,
        recomputed: { ok: true, indexBps: x.artifact.core.result.indexBps, evidenceDigest: x.artifact.evidenceDigest, mode: "snapshot" },
      });
      assert.equal(v.summary, "all-passed", JSON.stringify(v.checks.filter((c) => c.status !== "pass")));
      assert.equal(v.checks.length, 7);
    });
  }

  it("verification goes red when the recomputed evidence differs from what was attested", async () => {
    const x = await fullFlow("yabelo-ond-2021");
    const other = await getClimateEvidence(SCENARIOS["yabelo-ond-2022"].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
    const v = buildVerification({
      campaign: x.campaign,
      spec: x.history.created!.spec,
      settled: x.history.settled,
      refundReason: null,
      submitted: x.submitted.attestation,
      recoveredSigner: x.recoveredSigner as Address,
      recomputed: { ok: true, indexBps: other.artifact.core.result.indexBps, evidenceDigest: other.artifact.evidenceDigest, mode: "snapshot" },
    });
    assert.equal(v.summary, "failed");
    assert.equal(v.checks.find((c) => c.id === "index")?.status, "fail");
    assert.equal(v.checks.find((c) => c.id === "evidence-hash")?.status, "fail");
  });
});
