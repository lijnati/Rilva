/**
 * RilvaEscrow behaviour and security tests (Hardhat 3, node:test, viem).
 * Written before the contract (test-first). See CONTRACTS.md §7 for the invariants referenced here.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { concat, hashTypedData, keccak256, numberToHex, parseEther, size, slice, stringToBytes, toHex, type Hex } from "viem";
import {
  ATTESTATION_TYPE_STRING,
  ATTESTATION_TYPES,
  CampaignStatus,
  RefundReason,
  rilvaDomain,
} from "../../lib/contracts";
import {
  activeLiabilities,
  AMOUNT,
  attestationFor,
  attestorAccount,
  baseFixture,
  createCampaign,
  DAY,
  deployEscrow,
  impostorAccount,
  networkHelpers,
  now,
  OND2021_TERMS,
  sign,
  viem,
  type Fixture,
} from "./helpers";

const load = () => networkHelpers.loadFixture(baseFixture);
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

async function expectRevertNamed(p: Promise<unknown>, names: string[]) {
  try {
    await p;
  } catch (e) {
    const text = String((e as Error).message) + JSON.stringify(e, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    assert.ok(
      names.some((n) => text.includes(n)),
      `expected revert with one of ${names.join(", ")}, got: ${(e as Error).message.slice(0, 300)}`,
    );
    return;
  }
  assert.fail(`expected revert with one of ${names.join(", ")}, but call succeeded`);
}

async function settleAs(f: Fixture, id: bigint, indexBps: number, opts: { expiresIn?: bigint } = {}) {
  const a = attestationFor(id, OND2021_TERMS, indexBps, (await now()) + (opts.expiresIn ?? DAY));
  const sig = await sign(f, a);
  const hash = await f.escrow.write.settle([a, sig], { account: f.relayer.account });
  await f.publicClient.waitForTransactionReceipt({ hash });
  return { a, sig, hash };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("RilvaEscrow — campaign creation", () => {
  it("creates and funds a campaign in one transaction with the exact stored terms", async () => {
    const f = await load();
    const deadline = (await now()) + 7n * DAY;
    const { id, hash } = await createCampaign(f, { deadline });
    assert.equal(id, 1n);
    const c = await f.escrow.read.getCampaign([id]);
    assert.equal(c.funder, f.A.funder);
    assert.equal(c.beneficiary, f.A.beneficiary);
    assert.equal(c.attestor, attestorAccount.address);
    assert.equal(c.amount, AMOUNT);
    assert.equal(c.specHash, OND2021_TERMS.specHash);
    assert.equal(c.specHash, keccak256(stringToBytes(OND2021_TERMS.spec)));
    assert.equal(c.observationStart, 20211001);
    assert.equal(c.observationEnd, 20211231);
    assert.equal(c.thresholdBps, 6000);
    assert.equal(c.settlementDeadline, deadline);
    assert.equal(c.status, CampaignStatus.Active);
    assert.equal(c.indexBps, 0);
    assert.equal(c.evidenceHash, `0x${"00".repeat(32)}`);
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), AMOUNT);

    await viem.assertions.emitWithArgs(Promise.resolve(hash), f.escrow, "CampaignCreated", [
      1n,
      f.A.funder,
      f.A.beneficiary,
      attestorAccount.address,
      AMOUNT,
      OND2021_TERMS.specHash,
      20211001,
      20211231,
      6000,
      deadline,
      OND2021_TERMS.spec,
    ]);
  });

  it("assigns sequential unique ids", async () => {
    const f = await load();
    const a = await createCampaign(f);
    const b = await createCampaign(f);
    const c = await createCampaign(f, { from: f.other, beneficiary: f.A.relayer });
    assert.deepEqual([a.id, b.id, c.id], [1n, 2n, 3n]);
    assert.equal(await f.escrow.read.campaignCount(), 3n);
  });

  it("rejects zero funding", async () => {
    const f = await load();
    await viem.assertions.revertWithCustomError(createCampaign(f, { value: 0n }), f.escrow, "ZeroValue");
  });

  it("rejects an amount that does not fit uint96", async () => {
    const f = await load();
    const tooMuch = 2n ** 96n;
    await networkHelpers.setBalance(f.A.funder, tooMuch * 2n);
    await viem.assertions.revertWithCustomError(createCampaign(f, { value: tooMuch }), f.escrow, "AmountTooLarge");
  });

  it("rejects zero beneficiary and zero attestor", async () => {
    const f = await load();
    const zero = "0x0000000000000000000000000000000000000000";
    await viem.assertions.revertWithCustomError(createCampaign(f, { beneficiary: zero }), f.escrow, "ZeroAddress");
    await viem.assertions.revertWithCustomError(createCampaign(f, { attestor: zero }), f.escrow, "ZeroAddress");
  });

  it("rejects every role conflict", async () => {
    const f = await load();
    const funder = f.A.funder;
    const beneficiary = f.A.beneficiary;
    await viem.assertions.revertWithCustomError(createCampaign(f, { attestor: funder }), f.escrow, "RoleConflict");
    await viem.assertions.revertWithCustomError(createCampaign(f, { attestor: beneficiary }), f.escrow, "RoleConflict");
    await viem.assertions.revertWithCustomError(createCampaign(f, { beneficiary: funder }), f.escrow, "RoleConflict");
    await viem.assertions.revertWithCustomError(createCampaign(f, { beneficiary: funder, attestor: funder }), f.escrow, "RoleConflict");
  });

  for (const [label, start, end] of [
    ["29 Feb in a non-leap year", 20210229, 20211231],
    ["29 Feb 2100 (not a leap year)", 21000229, 21000301],
    ["month 13", 20211301, 20211231],
    ["month 0", 20210001, 20211231],
    ["day 0", 20211000, 20211231],
    ["day 32", 20211001, 20211232],
    ["30 Feb", 20200201, 20200230],
    ["31 Apr", 20210401, 20210431],
    ["year before 1940", 19391001, 19391231],
    ["year after 2100", 21011001, 21011231],
    ["start after end", 20211231, 20211001],
    ["malformed (7 digits)", 2021101, 20211231],
  ] as const) {
    it(`rejects an invalid observation period: ${label}`, async () => {
      const f = await load();
      const terms = { ...OND2021_TERMS, observationStart: start, observationEnd: end };
      await viem.assertions.revertWithCustomError(createCampaign(f, { terms }), f.escrow, "InvalidObservationPeriod");
    });
  }

  it("accepts a leap day in a leap year and a single-day period", async () => {
    const f = await load();
    await createCampaign(f, { terms: { ...OND2021_TERMS, observationStart: 20200229, observationEnd: 20200229 } });
    await createCampaign(f, { terms: { ...OND2021_TERMS, observationStart: 20000229, observationEnd: 20000301 } });
  });

  it("allows historical observation periods (retrospective replay) independent of block time", async () => {
    const f = await load();
    const { id } = await createCampaign(f, { terms: { ...OND2021_TERMS, observationStart: 19910101, observationEnd: 19911231 } });
    assert.equal((await f.escrow.read.getCampaign([id])).observationStart, 19910101);
  });

  it("enforces the settlement-deadline window exactly (≥ 10 min, ≤ 366 days)", async () => {
    const f = await load();
    const t = (await now()) + 100n;
    await networkHelpers.time.setNextBlockTimestamp(t);
    await viem.assertions.revertWithCustomError(createCampaign(f, { deadline: t + 599n }), f.escrow, "InvalidSettlementDeadline");
    await networkHelpers.time.setNextBlockTimestamp(t + 1n);
    await createCampaign(f, { deadline: t + 1n + 600n });
    await networkHelpers.time.setNextBlockTimestamp(t + 2n);
    await createCampaign(f, { deadline: t + 2n + 366n * DAY });
    await networkHelpers.time.setNextBlockTimestamp(t + 3n);
    await viem.assertions.revertWithCustomError(createCampaign(f, { deadline: t + 3n + 366n * DAY + 1n }), f.escrow, "InvalidSettlementDeadline");
  });

  it("bounds the threshold to 1..10000 bps", async () => {
    const f = await load();
    await viem.assertions.revertWithCustomError(createCampaign(f, { terms: { ...OND2021_TERMS, thresholdBps: 0 } }), f.escrow, "InvalidThreshold");
    await viem.assertions.revertWithCustomError(createCampaign(f, { terms: { ...OND2021_TERMS, thresholdBps: 10001 } }), f.escrow, "InvalidThreshold");
    await createCampaign(f, { terms: { ...OND2021_TERMS, thresholdBps: 1 } });
    await createCampaign(f, { terms: { ...OND2021_TERMS, thresholdBps: 10000 } });
  });

  it("rejects an empty or oversized climate specification", async () => {
    const f = await load();
    await viem.assertions.revertWithCustomError(createCampaign(f, { terms: { ...OND2021_TERMS, spec: "" } }), f.escrow, "InvalidSpec");
    await viem.assertions.revertWithCustomError(createCampaign(f, { terms: { ...OND2021_TERMS, spec: "x".repeat(4097) } }), f.escrow, "InvalidSpec");
    const { id } = await createCampaign(f, { terms: { ...OND2021_TERMS, spec: "x".repeat(4096) } });
    assert.equal((await f.escrow.read.getCampaign([id])).specHash, keccak256(stringToBytes("x".repeat(4096))));
  });

  it("exposes no way to change terms: the only state-changing functions are create, settle and timeout refund", async () => {
    const f = await load();
    const mutating = f.escrow.abi
      .filter((x) => x.type === "function" && (x.stateMutability === "nonpayable" || x.stateMutability === "payable"))
      .map((x) => (x as { name: string }).name)
      .sort();
    assert.deepEqual(mutating, ["createCampaign", "refundAfterDeadline", "settle"]);
    assert.equal((f.escrow.abi as readonly { type: string }[]).some((x) => x.type === "receive" || x.type === "fallback"), false);
  });

  it("rejects plain ETH transfers (no receive/fallback)", async () => {
    const f = await load();
    await assert.rejects(f.funder.sendTransaction({ to: f.escrow.address, value: 1n }));
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("RilvaEscrow — authorized settlement", () => {
  it("releases exactly the escrowed amount to the beneficiary when indexBps ≤ threshold", async () => {
    const f = await load();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 3363, (await now()) + DAY);
    const sig = await sign(f, a);
    const digest = await f.escrow.read.hashAttestation([a]);
    const tx = f.escrow.write.settle([a, sig], { account: f.relayer.account });
    await viem.assertions.balancesHaveChanged(tx, [
      { address: f.A.beneficiary, amount: AMOUNT },
      { address: f.escrow.address, amount: -AMOUNT },
      { address: f.A.funder, amount: 0n },
    ]);
    const c = await f.escrow.read.getCampaign([id]);
    assert.equal(c.status, CampaignStatus.Released);
    assert.equal(c.indexBps, 3363);
    assert.equal(c.evidenceHash, a.evidenceHash);
    const logs = await f.escrow.getEvents.CampaignSettled({ campaignId: id });
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0]!.args, {
      campaignId: id,
      evidenceHash: a.evidenceHash,
      indexBps: 3363,
      thresholdBps: 6000,
      triggered: true,
      recipient: f.A.beneficiary,
      amount: AMOUNT,
      digest,
    });
  });

  it("refunds exactly the escrowed amount to the funder when indexBps > threshold", async () => {
    const f = await load();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 21322, (await now()) + DAY);
    const sig = await sign(f, a);
    const tx = f.escrow.write.settle([a, sig], { account: f.relayer.account });
    await viem.assertions.balancesHaveChanged(tx, [
      { address: f.A.funder, amount: AMOUNT },
      { address: f.A.beneficiary, amount: 0n },
      { address: f.escrow.address, amount: -AMOUNT },
    ]);
    const c = await f.escrow.read.getCampaign([id]);
    assert.equal(c.status, CampaignStatus.Refunded);
    assert.equal(c.indexBps, 21322);
    const settled = await f.escrow.getEvents.CampaignSettled({ campaignId: id });
    assert.equal(settled[0]!.args.triggered, false);
    assert.equal(settled[0]!.args.recipient, f.A.funder);
    const refunded = await f.escrow.getEvents.CampaignRefunded({ campaignId: id });
    assert.deepEqual(refunded[0]!.args, { campaignId: id, funder: f.A.funder, amount: AMOUNT, reason: RefundReason.NotTriggered });
  });

  it("treats indexBps == threshold as triggered and threshold + 1 as not triggered", async () => {
    const f = await load();
    const a = await createCampaign(f);
    const b = await createCampaign(f);
    await settleAs(f, a.id, 6000);
    await settleAs(f, b.id, 6001);
    assert.equal((await f.escrow.read.getCampaign([a.id])).status, CampaignStatus.Released);
    assert.equal((await f.escrow.read.getCampaign([b.id])).status, CampaignStatus.Refunded);
  });

  it("lets anyone submit a valid attestation but never redirects funds to the caller", async () => {
    const f = await load();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 1000, (await now()) + DAY);
    const sig = await sign(f, a);
    const before = await f.publicClient.getBalance({ address: f.A.other });
    const hash = await f.escrow.write.settle([a, sig], { account: f.other.account });
    const receipt = await f.publicClient.waitForTransactionReceipt({ hash });
    const after = await f.publicClient.getBalance({ address: f.A.other });
    assert.equal(after, before - receipt.gasUsed * receipt.effectiveGasPrice);
    assert.equal((await f.escrow.read.getCampaign([id])).status, CampaignStatus.Released);
  });

  it("accepts an attestation exactly at its expiry second", async () => {
    const f = await load();
    const { id } = await createCampaign(f);
    const t = (await now()) + 50n;
    const a = attestationFor(id, OND2021_TERMS, 1000, t);
    const sig = await sign(f, a);
    await networkHelpers.time.setNextBlockTimestamp(t);
    await f.escrow.write.settle([a, sig], { account: f.relayer.account });
    assert.equal((await f.escrow.read.getCampaign([id])).status, CampaignStatus.Released);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("RilvaEscrow — signature attacks", () => {
  async function ready() {
    const f = await load();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 21322, (await now()) + DAY);
    const sig = await sign(f, a);
    return { f, id, a, sig };
  }

  it("rejects a signature from anyone but the designated attestor", async () => {
    const { f, a } = await ready();
    const forged = await sign(f, a, impostorAccount);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, forged], { account: f.relayer.account }), f.escrow, "InvalidSigner");
  });

  it("rejects a valid signature replayed with a modified index (non-trigger → fake trigger)", async () => {
    const { f, a, sig } = await ready();
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...a, indexBps: 3363 }, sig], { account: f.relayer.account }),
      f.escrow,
      "InvalidSigner",
    );
  });

  it("rejects a modified evidence hash", async () => {
    const { f, a, sig } = await ready();
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...a, evidenceHash: keccak256(stringToBytes("other evidence")) }, sig], { account: f.relayer.account }),
      f.escrow,
      "InvalidSigner",
    );
  });

  it("rejects a modified expiry", async () => {
    const { f, a, sig } = await ready();
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...a, expiresAt: a.expiresAt + 1n }, sig], { account: f.relayer.account }),
      f.escrow,
      "InvalidSigner",
    );
  });

  it("rejects modified observation dates", async () => {
    const { f, a, sig } = await ready();
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...a, observationStart: 20221001 }, sig], { account: f.relayer.account }),
      f.escrow,
      "ObservationPeriodMismatch",
    );
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...a, observationEnd: 20211230 }, sig], { account: f.relayer.account }),
      f.escrow,
      "ObservationPeriodMismatch",
    );
  });

  it("rejects a modified climate specification hash, even if properly signed", async () => {
    const { f, a } = await ready();
    const other = { ...a, specHash: keccak256(stringToBytes("another spec")) };
    const sig = await sign(f, other);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([other, sig], { account: f.relayer.account }), f.escrow, "SpecMismatch");
  });

  it("rejects a signature issued for another campaign", async () => {
    const f = await load();
    const one = await createCampaign(f);
    const two = await createCampaign(f);
    const forTwo = attestationFor(two.id, OND2021_TERMS, 1000, (await now()) + DAY);
    const sig = await sign(f, forTwo);
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([{ ...forTwo, campaignId: one.id }, sig], { account: f.relayer.account }),
      f.escrow,
      "InvalidSigner",
    );
  });

  it("rejects a signature issued for another RilvaEscrow deployment", async () => {
    const f = await load();
    const other = await deployEscrow();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 1000, (await now()) + DAY);
    const sigForOther = await sign(f, a, attestorAccount, f.chainId, other.address);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, sigForOther], { account: f.relayer.account }), f.escrow, "InvalidSigner");
  });

  it("rejects a signature issued for another chain id (Base Sepolia domain on the local chain)", async () => {
    const f = await load();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 1000, (await now()) + DAY);
    assert.notEqual(f.chainId, 84532);
    const sigOtherChain = await sign(f, a, attestorAccount, 84532);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, sigOtherChain], { account: f.relayer.account }), f.escrow, "InvalidSigner");
  });

  it("rejects an expired attestation", async () => {
    const f = await load();
    const { id } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 1000, (await now()) + 10n);
    const sig = await sign(f, a);
    await networkHelpers.time.setNextBlockTimestamp(a.expiresAt + 1n);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, sig], { account: f.relayer.account }), f.escrow, "AttestationExpired");
  });

  it("rejects malformed signatures", async () => {
    const { f, a, sig } = await ready();
    await viem.assertions.revertWithCustomErrorWithArgs(
      f.escrow.write.settle([a, slice(sig, 0, 64)], { account: f.relayer.account }),
      f.escrow,
      "ECDSAInvalidSignatureLength",
      [64n],
    );
    await viem.assertions.revertWithCustomErrorWithArgs(f.escrow.write.settle([a, "0x"], { account: f.relayer.account }), f.escrow, "ECDSAInvalidSignatureLength", [0n]);
    // r = s = 0 → ecrecover returns address(0) → OZ reverts.
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([a, concat([numberToHex(0n, { size: 32 }), numberToHex(0n, { size: 32 }), "0x1b"])], { account: f.relayer.account }),
      f.escrow,
      "ECDSAInvalidSignature",
    );
    // Arbitrary bytes recover to an unrelated (or no) address.
    const junk = toHex(new Uint8Array(65).fill(0x42));
    await expectRevertNamed(f.escrow.write.settle([a, junk], { account: f.relayer.account }), ["InvalidSigner", "ECDSAInvalidSignature"]);
  });

  it("rejects a high-s (malleated) signature even though it recovers to the attestor", async () => {
    const { f, a, sig } = await ready();
    assert.equal(size(sig), 65);
    const r = slice(sig, 0, 32);
    const s = BigInt(slice(sig, 32, 64));
    const v = Number(BigInt(slice(sig, 64, 65)));
    const malleated = concat([r, numberToHex(SECP256K1_N - s, { size: 32 }), numberToHex(v === 27 ? 28 : 27, { size: 1 })]);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, malleated], { account: f.relayer.account }), f.escrow, "ECDSAInvalidSignatureS");
  });

  it("rejects replaying an accepted attestation", async () => {
    const { f, a, sig } = await ready();
    await f.escrow.write.settle([a, sig], { account: f.relayer.account });
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, sig], { account: f.relayer.account }), f.escrow, "CampaignNotActive");
  });

  it("rejects settlement of a campaign that does not exist", async () => {
    const f = await load();
    const a = attestationFor(42n, OND2021_TERMS, 1000, (await now()) + DAY);
    const sig = await sign(f, a);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, sig], { account: f.relayer.account }), f.escrow, "CampaignNotFound");
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([0n]), f.escrow, "CampaignNotFound");
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("RilvaEscrow — escrow lifecycle", () => {
  it("prevents double payout and double refund", async () => {
    const f = await load();
    const released = await createCampaign(f);
    await settleAs(f, released.id, 1000);
    const again = attestationFor(released.id, OND2021_TERMS, 1000, (await now()) + DAY, keccak256(stringToBytes("second")));
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([again, await sign(f, again)]), f.escrow, "CampaignNotActive");

    const refunded = await createCampaign(f);
    await settleAs(f, refunded.id, 9000);
    await networkHelpers.time.increaseTo(refunded.deadline + 1n);
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([refunded.id]), f.escrow, "CampaignNotActive");
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([released.id]), f.escrow, "CampaignNotActive");
  });

  it("rejects a timeout refund before the deadline and at deadline − 1", async () => {
    const f = await load();
    const { id, deadline } = await createCampaign(f);
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([id]), f.escrow, "SettlementWindowOpen");
    await networkHelpers.time.setNextBlockTimestamp(deadline - 1n);
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([id]), f.escrow, "SettlementWindowOpen");
  });

  it("allows the timeout refund exactly at the deadline, paying the funder not the caller", async () => {
    const f = await load();
    const { id, deadline } = await createCampaign(f);
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    const tx = f.escrow.write.refundAfterDeadline([id], { account: f.other.account });
    await viem.assertions.balancesHaveChanged(tx, [
      { address: f.A.funder, amount: AMOUNT },
      { address: f.escrow.address, amount: -AMOUNT },
    ]);
    assert.equal((await f.escrow.read.getCampaign([id])).status, CampaignStatus.Refunded);
    const ev = await f.escrow.getEvents.CampaignRefunded({ campaignId: id });
    assert.equal(ev[0]!.args.reason, RefundReason.Timeout);
  });

  it("accepts settlement at deadline − 1 and rejects it at the deadline", async () => {
    const f = await load();
    const early = await createCampaign(f);
    const late = await createCampaign(f, { deadline: early.deadline });
    const expiresAt = early.deadline + DAY;
    const a1 = attestationFor(early.id, OND2021_TERMS, 1000, expiresAt);
    const a2 = attestationFor(late.id, OND2021_TERMS, 1000, expiresAt);
    const [s1, s2] = [await sign(f, a1), await sign(f, a2)];
    await networkHelpers.time.setNextBlockTimestamp(early.deadline - 1n);
    await f.escrow.write.settle([a1, s1]);
    await networkHelpers.time.setNextBlockTimestamp(early.deadline);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a2, s2]), f.escrow, "SettlementWindowClosed");
  });

  it("reverts atomically if the beneficiary rejects ETH; the funder can still recover after the deadline", async () => {
    const f = await load();
    const rejecting = await viem.deployContract("RejectingReceiver");
    const { id, deadline } = await createCampaign(f, { beneficiary: rejecting.address });
    const a = attestationFor(id, OND2021_TERMS, 1000, (await now()) + DAY);
    await viem.assertions.revertWithCustomErrorWithArgs(f.escrow.write.settle([a, await sign(f, a)]), f.escrow, "TransferFailed", [
      rejecting.address,
      AMOUNT,
    ]);
    const c = await f.escrow.read.getCampaign([id]);
    assert.equal(c.status, CampaignStatus.Active);
    assert.equal(c.indexBps, 0);
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), AMOUNT);
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    const tx = f.escrow.write.refundAfterDeadline([id]);
    await viem.assertions.balancesHaveChanged(tx, [{ address: f.A.funder, amount: AMOUNT }]);
  });

  it("reverts atomically if the funder rejects ETH (documented liveness limit for contract funders)", async () => {
    const f = await load();
    const rejecting = await viem.deployContract("RejectingReceiver");
    const deadline = (await now()) + 7n * DAY;
    await rejecting.write.createCampaignOn(
      [
        f.escrow.address,
        f.A.beneficiary,
        attestorAccount.address,
        OND2021_TERMS.observationStart,
        OND2021_TERMS.observationEnd,
        OND2021_TERMS.thresholdBps,
        deadline,
        OND2021_TERMS.spec,
      ],
      { value: AMOUNT },
    );
    const a = attestationFor(1n, OND2021_TERMS, 21322, (await now()) + DAY);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, await sign(f, a)]), f.escrow, "TransferFailed");
    assert.equal((await f.escrow.read.getCampaign([1n])).status, CampaignStatus.Active);
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([1n]), f.escrow, "TransferFailed");
    assert.equal((await f.escrow.read.getCampaign([1n])).status, CampaignStatus.Active);
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), AMOUNT);
  });

  it("blocks a reentrant beneficiary from touching another campaign", async () => {
    const f = await load();
    const attacker = await viem.deployContract("ReentrantReceiver", [f.escrow.address]);
    const victim = await createCampaign(f, { deadline: (await now()) + 700n });
    const bait = await createCampaign(f, { beneficiary: attacker.address, deadline: (await now()) + 7n * DAY });
    await attacker.write.setTarget([victim.id]);
    await networkHelpers.time.increaseTo(victim.deadline + 1n);
    // Victim is now refundable by timeout; the attacker tries to trigger that refund from inside its payout.
    const a = attestationFor(bait.id, OND2021_TERMS, 1000, (await now()) + DAY);
    await f.escrow.write.settle([a, await sign(f, a)]);
    assert.equal(await attacker.read.reentryAttempted(), true);
    assert.equal(await attacker.read.reentrySucceeded(), false);
    assert.equal((await f.escrow.read.getCampaign([bait.id])).status, CampaignStatus.Released);
    assert.equal((await f.escrow.read.getCampaign([victim.id])).status, CampaignStatus.Active);
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), AMOUNT);
    assert.equal(await f.publicClient.getBalance({ address: attacker.address }), AMOUNT);
  });

  it("keeps campaigns isolated: settling one never moves another's funds", async () => {
    const f = await load();
    const one = await createCampaign(f, { value: parseEther("0.3") });
    const two = await createCampaign(f, { value: parseEther("0.7") });
    await settleAs(f, one.id, 1000);
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), parseEther("0.7"));
    const c2 = await f.escrow.read.getCampaign([two.id]);
    assert.equal(c2.status, CampaignStatus.Active);
    assert.equal(c2.amount, parseEther("0.7"));
  });

  it("keeps balance == Σ active liabilities across a randomized lifecycle (seeded)", async () => {
    const f = await load();
    let seed = 0x5eedn;
    const rand = (n: number) => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
      return Number((seed >> 33n) % BigInt(n));
    };
    const model = new Map<bigint, { status: number; deadline: bigint }>();
    for (let step = 0; step < 40; step++) {
      const action = rand(4);
      const actives = [...model.entries()].filter(([, m]) => m.status === CampaignStatus.Active);
      if (action === 0 || actives.length === 0) {
        const { id, deadline } = await createCampaign(f, {
          value: BigInt(1 + rand(1000)) * 10n ** 13n,
          deadline: (await now()) + 900n + BigInt(rand(5)) * 3600n, // margin: local block time follows the wall clock
        });
        model.set(id, { status: CampaignStatus.Active, deadline });
      } else if (action === 1 || action === 2) {
        const [id, m] = actives[rand(actives.length)]!;
        if ((await now()) + 1n >= m.deadline) {
          await viem.assertions.revertWithCustomError(settleAs(f, id, 5000), f.escrow, "SettlementWindowClosed");
        } else {
          const idx = action === 1 ? 6000 - rand(6000) : 6001 + rand(20000);
          await settleAs(f, id, idx);
          m.status = idx <= 6000 ? CampaignStatus.Released : CampaignStatus.Refunded;
        }
      } else {
        const [id, m] = actives[rand(actives.length)]!;
        await networkHelpers.time.increaseTo(((await now()) > m.deadline ? await now() : m.deadline) + 1n);
        await f.escrow.write.refundAfterDeadline([id]);
        m.status = CampaignStatus.Refunded;
      }
      // Invariants I1 + I6 after every step.
      assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), await activeLiabilities(f), `I1 broken at step ${step}`);
      for (const [id, m] of model) assert.equal((await f.escrow.read.getCampaign([id])).status, m.status, `status drift for ${id}`);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("RilvaEscrow — EIP-712 cross-language compatibility", () => {
  it("uses the documented domain (EIP-5267)", async () => {
    const f = await load();
    const [, name, version, chainId, verifyingContract] = await f.escrow.read.eip712Domain();
    assert.deepEqual({ name, version, chainId, verifyingContract }, { name: "RilvaEscrow", version: "1", chainId: BigInt(f.chainId), verifyingContract: f.A.escrow });
  });

  it("has a Solidity typehash equal to keccak256 of the shared TypeScript type string", async () => {
    const f = await load();
    assert.equal(await f.escrow.read.ATTESTATION_TYPEHASH(), keccak256(stringToBytes(ATTESTATION_TYPE_STRING)));
  });

  it("computes the same digest as viem's hashTypedData for many attestations", async () => {
    const f = await load();
    for (const [id, idx, exp] of [
      [1n, 0, 1n],
      [2n, 3363, 1_900_000_000n],
      [2n ** 255n, 4294967295, 2n ** 64n - 1n],
    ] as const) {
      const a = attestationFor(id, OND2021_TERMS, idx, exp, keccak256(toHex(`${id}`)) as Hex);
      const ts = hashTypedData({ domain: rilvaDomain(f.chainId, f.escrow.address), types: ATTESTATION_TYPES, primaryType: "Attestation", message: a });
      assert.equal(await f.escrow.read.hashAttestation([a]), ts);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("RilvaEscrow — adversarial hardening (release review)", () => {
  it("keeps a timeout-refunded campaign terminal: settle and a second refund are rejected", async () => {
    const f = await load();
    const { id, deadline } = await createCampaign(f);
    const a = attestationFor(id, OND2021_TERMS, 1000, deadline + DAY);
    const sig = await sign(f, a); // signed while Active, submitted after the timeout refund
    await networkHelpers.time.setNextBlockTimestamp(deadline);
    await f.escrow.write.refundAfterDeadline([id]);
    const c = await f.escrow.read.getCampaign([id]);
    assert.equal(c.status, CampaignStatus.Refunded);
    assert.equal(c.indexBps, 0);
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, sig]), f.escrow, "CampaignNotActive");
    await viem.assertions.revertWithCustomError(f.escrow.write.refundAfterDeadline([id]), f.escrow, "CampaignNotActive");
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), 0n);
  });

  it("takes the right branch at the index extremes (0 and 2^32 − 1)", async () => {
    const f = await load();
    const low = await createCampaign(f);
    const high = await createCampaign(f);
    await settleAs(f, low.id, 0);
    await settleAs(f, high.id, 2 ** 32 - 1);
    const l = await f.escrow.read.getCampaign([low.id]);
    const h = await f.escrow.read.getCampaign([high.id]);
    assert.equal(l.status, CampaignStatus.Released);
    assert.equal(l.indexBps, 0);
    assert.equal(h.status, CampaignStatus.Refunded);
    assert.equal(h.indexBps, 2 ** 32 - 1);
  });

  it("blocks a reentrant beneficiary from refunding its own campaign during the payout", async () => {
    const f = await load();
    const attacker = await viem.deployContract("ReentrantReceiver", [f.escrow.address]);
    const bait = await createCampaign(f, { beneficiary: attacker.address });
    await attacker.write.setTarget([bait.id]);
    const a = attestationFor(bait.id, OND2021_TERMS, 1000, (await now()) + DAY);
    await f.escrow.write.settle([a, await sign(f, a)]);
    assert.equal(await attacker.read.reentryAttempted(), true);
    assert.equal(await attacker.read.reentrySucceeded(), false);
    assert.equal((await f.escrow.read.getCampaign([bait.id])).status, CampaignStatus.Released);
    assert.equal(await f.publicClient.getBalance({ address: attacker.address }), AMOUNT); // paid exactly once
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), 0n);
  });

  it("rejects every single-field mutation of a signed attestation with its exact error (seeded fuzz)", async () => {
    const f = await load();
    const target = await createCampaign(f);
    const sibling = await createCampaign(f); // same terms, same attestor: only campaignId tells them apart
    const a = attestationFor(target.id, OND2021_TERMS, 9000, (await now()) + DAY);
    const sig = await sign(f, a);
    let seed = 0xf022n;
    const rand = (n: number) => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
      return Number((seed >> 33n) % BigInt(n));
    };
    const randHash = () => keccak256(stringToBytes(`mutation-${rand(2 ** 30)}`));
    const mutations: Array<[string, () => typeof a, "InvalidSigner" | "SpecMismatch" | "ObservationPeriodMismatch"]> = [
      ["campaignId", () => ({ ...a, campaignId: sibling.id }), "InvalidSigner"],
      ["specHash", () => ({ ...a, specHash: randHash() }), "SpecMismatch"],
      ["evidenceHash", () => ({ ...a, evidenceHash: randHash() }), "InvalidSigner"],
      ["indexBps", () => ({ ...a, indexBps: (a.indexBps + 1 + rand(2 ** 31)) % 2 ** 32 }), "InvalidSigner"],
      ["observationStart", () => ({ ...a, observationStart: a.observationStart - 1 - rand(300) }), "ObservationPeriodMismatch"],
      ["observationEnd", () => ({ ...a, observationEnd: a.observationEnd + 1 + rand(300) }), "ObservationPeriodMismatch"],
      ["expiresAt", () => ({ ...a, expiresAt: a.expiresAt + 1n + BigInt(rand(10_000)) }), "InvalidSigner"],
    ];
    for (const [field, mutate, error] of mutations) {
      for (let round = 0; round < 6; round++) {
        const m = mutate();
        await viem.assertions.revertWithCustomError(f.escrow.write.settle([m, sig], { account: f.relayer.account }), f.escrow, error);
        assert.notDeepEqual(m, a, `${field} mutation must change the payload`);
      }
    }
    // A signature for the same payload under another domain (chain or contract) never recovers to the attestor.
    await viem.assertions.revertWithCustomError(f.escrow.write.settle([a, await sign(f, a, attestorAccount, 84532)]), f.escrow, "InvalidSigner");
    await viem.assertions.revertWithCustomError(
      f.escrow.write.settle([a, await sign(f, a, attestorAccount, f.chainId, f.A.other)]),
      f.escrow,
      "InvalidSigner",
    );
    // Nothing moved, and the untouched attestation still settles once.
    assert.equal(await f.publicClient.getBalance({ address: f.escrow.address }), 2n * AMOUNT);
    assert.equal((await f.escrow.read.getCampaign([target.id])).status, CampaignStatus.Active);
    await f.escrow.write.settle([a, sig], { account: f.relayer.account });
    assert.equal((await f.escrow.read.getCampaign([target.id])).status, CampaignStatus.Refunded);
    assert.equal((await f.escrow.read.getCampaign([sibling.id])).status, CampaignStatus.Active);
  });
});
