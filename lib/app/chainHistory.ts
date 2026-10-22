/**
 * Reading a campaign's history from RilvaEscrow without a database: bounded log queries from the
 * deployment block (public RPCs cap getLogs ranges) and decoding the settle() calldata so anyone can
 * recover exactly what the attestor signed.
 */
import { decodeFunctionData, type Address, type Hex, type PublicClient } from "viem";
import { RILVA_ESCROW_ABI, type Attestation } from "../contracts";

/** Max block span per eth_getLogs request (conservative for public RPCs; UNVERIFIED exact Base limit). */
export const LOG_SPAN = 9_000n;

export function logRanges(fromBlock: bigint, toBlock: bigint, span: bigint): Array<{ fromBlock: bigint; toBlock: bigint }> {
  if (span <= 0n) throw new Error("span must be positive");
  const out: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let start = fromBlock; start <= toBlock; start += span) {
    const end = start + span - 1n;
    out.push({ fromBlock: start, toBlock: end < toBlock ? end : toBlock });
  }
  return out;
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

/** All three events for one campaign id, using the indexed campaignId topic and chunked block ranges. */
export async function readCampaignHistory(client: PublicClient, escrow: Address, campaignId: bigint, deployBlock: bigint): Promise<CampaignHistory> {
  const latest = await client.getBlockNumber();
  const history: CampaignHistory = { created: null, settled: null, refunded: null };
  for (const range of logRanges(deployBlock, latest, LOG_SPAN)) {
    const logs = await client.getContractEvents({ address: escrow, abi: RILVA_ESCROW_ABI, args: { campaignId }, ...range });
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
