/**
 * Phase 4 end-to-end journeys on a local Hardhat chain. Four identities — funder, attestor (an
 * off-chain key, as in a browser wallet), beneficiary and a stranger who submits — and only the app's
 * own call builders (validateCreateForm → prepareCreateCampaign, buildAttestation → signAttestation →
 * prepareSettle, prepareRefundAfterDeadline). Evidence is the real ERA5 snapshot evidence.
 * Local time travel is used only for the timeout journey; it never represents a public-network event.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress, keccak256, stringToBytes, type Hex } from "viem";
import { campaignView } from "../../lib/app/campaignView";
import { readCampaignHistory } from "../../lib/app/chainHistory";
import { validateCreateForm } from "../../lib/app/createForm";
import { getClimateEvidence, SCENARIOS, type ScenarioId } from "../../lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "../../lib/climate/node";
import {
  buildAttestation,
  CampaignStatus,
  campaignIdFromReceipt,
  prepareCreateCampaign,
  prepareRefundAfterDeadline,
  prepareSettle,
  readCampaign,
  rilvaDomain,
  signAttestation,
  type Attestation,
} from "../../lib/contracts";
import { activeLiabilities, attestorAccount, baseFixture, impostorAccount, networkHelpers, now, viem, type Fixture } from "./helpers";

const load = () => networkHelpers.loadFixture(baseFixture);
const manifest = await readManifestFromDisk();
const evidence = (id: ScenarioId) => getClimateEvidence(SCENARIOS[id].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });

const balance = (f: Fixture, address: Hex) => f.publicClient.getBalance({ address });

/** Funder creates and funds a campaign exactly as the create wizard does. */
async function create(f: Fixture, scenarioId: ScenarioId, deadlineSeconds = 7 * 86400) {
  const form = validateCreateForm(
    { scenarioId, beneficiary: f.A.beneficiary, attestor: attestorAccount.address, amountEth: "0.01", deadlineSeconds },
    { now: await now(), funder: f.A.funder, balance: await balance(f, f.A.funder) },
  );
  assert.ok(form.ok, "form should validate");
  const hash = await f.funder.writeContract({ ...prepareCreateCampaign({ escrow: f.A.escrow, ...form.value }), account: f.funder.account, chain: null });
  const receipt = await f.publicClient.waitForTransactionReceipt({ hash });
  assert.equal(receipt.status, "success");
  const id = campaignIdFromReceipt(receipt.logs);
  assert.ok(id !== null, "CampaignCreated must carry the authoritative id");
  return { id, value: form.value };
}

async function attest(f: Fixture, scenarioId: ScenarioId, id: bigint, signer = attestorAccount) {
  const r = await evidence(scenarioId);
  const attestation = buildAttestation({ evidence: r.artifact, campaignId: id, expiresAt: (await now()) + 3600n });
  const signature = await signAttestation(signer, rilvaDomain(f.chainId, f.A.escrow), attestation);
  return { attestation, signature, artifact: r.artifact };
}

/** Submitted by the stranger (`other`), so the funder's and beneficiary's balances move only by the payout. */
function submit(f: Fixture, attestation: Attestation, signature: Hex) {
  return f.other.writeContract({ ...prepareSettle({ escrow: f.A.escrow, attestation, signature }), account: f.other.account, chain: null });
}

describe("Phase 4 journeys (local Hardhat, real ERA5 evidence)", () => {
  it("Scenario 1 — OND 2021 drought trigger: Released, beneficiary paid exactly once", async () => {
    const f = await load();
    const { id, value } = await create(f, "yabelo-ond-2021");
    assert.equal(await balance(f, f.A.escrow), value.value);
    assert.equal(await activeLiabilities(f), value.value);

    const { attestation, signature, artifact } = await attest(f, "yabelo-ond-2021", id);
    assert.equal(attestation.indexBps, 3363);
    const [benBefore, funderBefore] = [await balance(f, f.A.beneficiary), await balance(f, f.A.funder)];
    await f.publicClient.waitForTransactionReceipt({ hash: await submit(f, attestation, signature) });

    const c = await readCampaign(f.publicClient, f.A.escrow, id);
    assert.equal(c.status, CampaignStatus.Released);
    assert.equal(c.evidenceHash, artifact.evidenceDigest);
    assert.equal(c.indexBps, artifact.core.result.indexBps);
    assert.equal((await balance(f, f.A.beneficiary)) - benBefore, value.value);
    assert.equal(await balance(f, f.A.funder), funderBefore);
    assert.equal(await balance(f, f.A.escrow), 0n);
    assert.equal(await activeLiabilities(f), 0n);

    const history = await readCampaignHistory(f.publicClient, f.A.escrow, id, 0n);
    assert.equal(history.settled?.evidenceHash, artifact.evidenceDigest);
    assert.equal(getAddress(history.settled!.recipient), f.A.beneficiary);

    // No second settlement, not even with a fresh signature over the same evidence.
    const again = await attest(f, "yabelo-ond-2021", id);
    await viem.assertions.revertWithCustomError(submit(f, again.attestation, again.signature), f.escrow, "CampaignNotActive");
    await viem.assertions.revertWithCustomError(
      f.other.writeContract({ ...prepareRefundAfterDeadline({ escrow: f.A.escrow, campaignId: id }), account: f.other.account, chain: null }),
      f.escrow,
      "CampaignNotActive",
    );
  });

  it("Scenario 2 — OND 2023 no trigger: Refunded (NotTriggered), funder repaid, beneficiary gets nothing", async () => {
    const f = await load();
    const { id, value } = await create(f, "yabelo-ond-2023");
    const { attestation, signature } = await attest(f, "yabelo-ond-2023", id);
    assert.equal(attestation.indexBps, 21322);
    const [benBefore, funderBefore] = [await balance(f, f.A.beneficiary), await balance(f, f.A.funder)];
    await f.publicClient.waitForTransactionReceipt({ hash: await submit(f, attestation, signature) });

    const c = await readCampaign(f.publicClient, f.A.escrow, id);
    assert.equal(c.status, CampaignStatus.Refunded);
    assert.equal((await balance(f, f.A.funder)) - funderBefore, value.value);
    assert.equal(await balance(f, f.A.beneficiary), benBefore);
    assert.equal(await balance(f, f.A.escrow), 0n);
    const history = await readCampaignHistory(f.publicClient, f.A.escrow, id, 0n);
    assert.equal(history.refunded?.reason, "NotTriggered");
    assert.equal(campaignView(c, await now(), { refundReason: history.refunded!.reason }).status, "Refunded");

    await viem.assertions.revertWithCustomError(submit(f, attestation, signature), f.escrow, "CampaignNotActive");
  });

  it("Scenario 3 — invalid evidence is rejected and the escrow stays intact", async () => {
    const f = await load();
    const { id, value } = await create(f, "yabelo-ond-2023");
    const genuine = await attest(f, "yabelo-ond-2023", id);

    // Unauthorised signer over genuine evidence.
    const stranger = await attest(f, "yabelo-ond-2023", id, impostorAccount);
    await viem.assertions.revertWithCustomError(submit(f, stranger.attestation, stranger.signature), f.escrow, "InvalidSigner");
    // Genuine signature, index altered to fake a trigger.
    await viem.assertions.revertWithCustomError(submit(f, { ...genuine.attestation, indexBps: 3000 }, genuine.signature), f.escrow, "InvalidSigner");
    // Genuine signature, evidence hash swapped.
    await viem.assertions.revertWithCustomError(
      submit(f, { ...genuine.attestation, evidenceHash: keccak256(stringToBytes("altered")) }, genuine.signature),
      f.escrow,
      "InvalidSigner",
    );
    // Evidence for another season, properly signed by the attestor.
    const wrongSeason = await attest(f, "yabelo-ond-2021", id);
    await viem.assertions.revertWithCustomError(submit(f, wrongSeason.attestation, wrongSeason.signature), f.escrow, "SpecMismatch");

    const c = await readCampaign(f.publicClient, f.A.escrow, id);
    assert.equal(c.status, CampaignStatus.Active);
    assert.equal(await balance(f, f.A.escrow), value.value);
    assert.equal(await activeLiabilities(f), value.value);
  });

  it("Scenario 4 — timeout: refund rejected before the deadline, accepted at it, paid to the funder", async () => {
    const f = await load();
    const { id, value } = await create(f, "yabelo-ond-2022", 3600);
    const refund = () => f.other.writeContract({ ...prepareRefundAfterDeadline({ escrow: f.A.escrow, campaignId: id }), account: f.other.account, chain: null });
    const c0 = await readCampaign(f.publicClient, f.A.escrow, id);
    assert.equal(campaignView(c0, await now()).canTimeoutRefund, false);

    await viem.assertions.revertWithCustomError(refund(), f.escrow, "SettlementWindowOpen");
    await networkHelpers.time.setNextBlockTimestamp(c0.settlementDeadline - 1n);
    await viem.assertions.revertWithCustomError(refund(), f.escrow, "SettlementWindowOpen");

    await networkHelpers.time.setNextBlockTimestamp(c0.settlementDeadline);
    const funderBefore = await balance(f, f.A.funder);
    await f.publicClient.waitForTransactionReceipt({ hash: await refund() });
    const c = await readCampaign(f.publicClient, f.A.escrow, id);
    assert.equal(c.status, CampaignStatus.Refunded);
    assert.equal((await balance(f, f.A.funder)) - funderBefore, value.value);
    assert.equal((await readCampaignHistory(f.publicClient, f.A.escrow, id, 0n)).refunded?.reason, "Timeout");

    // A settlement after the deadline is impossible as well.
    const late = await attest(f, "yabelo-ond-2022", id);
    await viem.assertions.revertWithCustomError(submit(f, late.attestation, late.signature), f.escrow, "CampaignNotActive");
  });
});
