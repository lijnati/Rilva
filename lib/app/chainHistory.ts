/**
 * Reading a campaign's history from RilvaEscrow without a database or an indexer. Public RPCs cap
 * eth_getLogs ranges (Base Sepolia's public endpoint allows 200 blocks), so instead of scanning, we
 * locate each event's block by binary search over contract state — campaignCount() and the campaign's
 * status only ever move forward — and then read logs for that single block. The settle() calldata is
 * decoded so anyone can recover exactly what the attestor signed.
 */
import { BaseError, ContractFunctionZeroDataError, decodeFunctionData, type Address, type Hex, type PublicClient } from "viem";
import { CampaignStatus, RILVA_ESCROW_ABI, type Attestation } from "../contracts";

/**
 * Smallest block in [lo, hi] at which a monotonic predicate (false…false, true…true) holds, or null
 * if it does not hold at hi. Uses ⌈log2(hi − lo + 1)⌉ + 1 predicate calls at most.
 */
export async function findFirstBlock(lo: bigint, hi: bigint, pred: (block: bigint) => Promise<boolean>): Promise<bigint | null> {
  if (lo > hi || !(await pred(hi))) return null;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (await pred(mid)) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

/** Before the contract was deployed, a call returns no data: that block simply precedes everything. */
function isNoCode(e: unknown): boolean {
  return e instanceof BaseError && !!e.walk((x) => x instanceof ContractFunctionZeroDataError);
}

export function decodeSettleCalldata(input: Hex): { attestation: Attestation; signature: Hex } {
  const decoded = decodeFunctionData({ abi: RILVA_ESCROW_ABI, data: input });
  if (decoded.functionName !== "settle") throw new Error(`transaction calls ${decoded.functionName}, not settle`);
  const [attestation, signature] = decoded.args;
  return { attestation: { ...attestation }, signature };
}

export interface CampaignHistory {
  created: { txHash: Hex; blockNumber: bigint; spec: string; funder: Address } | null;
  settled: {
    txHash: Hex;
    blockNumber: bigint;
    evidenceHash: Hex;
    indexBps: number;
    thresholdBps: number;
    triggered: boolean;
    recipient: Address;
    amount: bigint;
    digest: Hex;
  } | null;
  refunded: { txHash: Hex; blockNumber: bigint; amount: bigint; reason: "NotTriggered" | "Timeout"; funder: Address } | null;
}

/** All three events for one campaign id, read from at most two exactly-located blocks. */
export async function readCampaignHistory(client: PublicClient, escrow: Address, campaignId: bigint, deployBlock: bigint): Promise<CampaignHistory> {
  const history: CampaignHistory = { created: null, settled: null, refunded: null };
  const latest = await client.getBlockNumber();
  const at = <T>(read: (blockNumber: bigint) => Promise<T>, fallback: T) => async (blockNumber: bigint) => {
    try {
      return await read(blockNumber);
    } catch (e) {
      if (isNoCode(e)) return fallback;
      throw e;
    }
  };
  const countAt = at((blockNumber) => client.readContract({ address: escrow, abi: RILVA_ESCROW_ABI, functionName: "campaignCount", blockNumber }), 0n);
  const statusAt = at(
    async (blockNumber) => (await client.readContract({ address: escrow, abi: RILVA_ESCROW_ABI, functionName: "getCampaign", args: [campaignId], blockNumber })).status,
    CampaignStatus.None as number,
  );

  const createdBlock = await findFirstBlock(deployBlock, latest, async (b) => (await countAt(b)) >= campaignId);
  if (createdBlock === null) return history;
  const finalBlock = await findFirstBlock(createdBlock, latest, async (b) => (await statusAt(b)) !== CampaignStatus.Active);

  for (const block of new Set([createdBlock, ...(finalBlock === null ? [] : [finalBlock])])) {
    const logs = await client.getContractEvents({ address: escrow, abi: RILVA_ESCROW_ABI, args: { campaignId }, fromBlock: block, toBlock: block });
    for (const log of logs) {
      const base = { txHash: log.transactionHash as Hex, blockNumber: log.blockNumber as bigint };
      if (log.eventName === "CampaignCreated") {
        history.created = { ...base, spec: log.args.spec!, funder: log.args.funder! };
      } else if (log.eventName === "CampaignSettled") {
        const a = log.args;
        history.settled = {
          ...base,
          evidenceHash: a.evidenceHash!,
          indexBps: Number(a.indexBps),
          thresholdBps: Number(a.thresholdBps),
          triggered: a.triggered!,
          recipient: a.recipient!,
          amount: a.amount!,
          digest: a.digest!,
        };
      } else if (log.eventName === "CampaignRefunded") {
        history.refunded = { ...base, amount: log.args.amount!, reason: Number(log.args.reason) === 0 ? "NotTriggered" : "Timeout", funder: log.args.funder! };
      }
    }
  }
  return history;
}
