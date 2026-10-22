/**
 * Campaign history must be readable through public RPCs that cap eth_getLogs ranges (Base Sepolia's
 * public endpoint: "eth_getLogs is limited to a 200 range", observed 2026-10-22). readCampaignHistory
 * locates event blocks from contract state and never asks for a wide log range.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicClient } from "viem";
import { readCampaignHistory } from "../../lib/app/chainHistory";
import { attestationFor, baseFixture, createCampaign, networkHelpers, now, OND2021_TERMS, sign } from "./helpers";

const MAX_LOG_RANGE = 200n;

/**
 * Mines blocks one by one. hardhat_mine's bulk-mined interval answers historical eth_call with empty
 * state (observed with Hardhat 3.19), which no real chain does, so it cannot stand in for real history.
 */
async function mineEach(n: number) {
  for (let i = 0; i < n; i++) await networkHelpers.mine(1);
}

function spyLogs(client: PublicClient) {
  const ranges: Array<[bigint, bigint]> = [];
  const wrapped = {
    ...client,
    getContractEvents: (args: Parameters<PublicClient["getContractEvents"]>[0]) => {
      ranges.push([BigInt(args!.fromBlock as bigint), BigInt(args!.toBlock as bigint)]);
      return client.getContractEvents(args);
    },
  } as PublicClient;
  return { wrapped, ranges };
}

describe("readCampaignHistory over a long chain", () => {
  it("finds creation and settlement events hundreds of blocks apart with ≤ 200-block log queries", async () => {
    const f = await networkHelpers.loadFixture(baseFixture);
    await mineEach(450);
    const { id } = await createCampaign(f);
    await createCampaign(f); // a neighbour, to prove the campaignId filter
    await mineEach(900);
    const a = attestationFor(id, OND2021_TERMS, 1000, (await now()) + 86_400n);
    await f.escrow.write.settle([a, await sign(f, a)]);
    await mineEach(300);

    const { wrapped, ranges } = spyLogs(f.publicClient as unknown as PublicClient);
    const h = await readCampaignHistory(wrapped, f.A.escrow, id, 0n);
    assert.ok(h.created, "created event found");
    assert.ok(h.settled, "settled event found");
    assert.equal(h.refunded, null);
    assert.equal(h.created.spec, OND2021_TERMS.spec);
    assert.ok(h.settled.blockNumber > h.created.blockNumber + 4n * MAX_LOG_RANGE);
    assert.ok(ranges.length > 0);
    for (const [from, to] of ranges) assert.ok(to - from + 1n <= MAX_LOG_RANGE, `log range ${from}..${to} too wide`);
  });

  it("returns an empty history for an id that was never created", async () => {
    const f = await networkHelpers.loadFixture(baseFixture);
    await createCampaign(f);
    const h = await readCampaignHistory(f.publicClient as unknown as PublicClient, f.A.escrow, 99n, 0n);
    assert.deepEqual(h, { created: null, settled: null, refunded: null });
  });

  it("tolerates a deploy block configured before the contract existed", async () => {
    const f = await networkHelpers.loadFixture(baseFixture);
    const { id } = await createCampaign(f);
    const h = await readCampaignHistory(f.publicClient as unknown as PublicClient, f.A.escrow, id, 0n);
    assert.ok(h.created);
    assert.equal(h.settled, null);
  });
});
