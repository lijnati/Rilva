import { concat, encodeAbiParameters, encodeFunctionData, keccak256, parseAbiParameters, stringToBytes, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeSettleCalldata, findFirstBlock } from "@/lib/app/chainHistory";
import { RILVA_ESCROW_ABI, type Attestation } from "@/lib/contracts";

describe("findFirstBlock", () => {
  const firstTrueAt = (t: bigint) => {
    const calls: bigint[] = [];
    return { calls, pred: async (b: bigint) => (calls.push(b), b >= t) };
  };

  it("finds the first block where a monotonic predicate holds, in O(log n) calls", async () => {
    for (const t of [0n, 1n, 4_999n, 123_456n, 199_999n, 200_000n]) {
      const p = firstTrueAt(t);
      expect(await findFirstBlock(0n, 200_000n, p.pred)).toBe(t);
      expect(p.calls.length).toBeLessThanOrEqual(19);
    }
  });

  it("returns null when the predicate never holds, and for an empty range", async () => {
    expect(await findFirstBlock(10n, 20n, firstTrueAt(21n).pred)).toBeNull();
    expect(await findFirstBlock(21n, 20n, firstTrueAt(0n).pred)).toBeNull();
  });

  it("works for a single-block range", async () => {
    expect(await findFirstBlock(7n, 7n, firstTrueAt(7n).pred)).toBe(7n);
  });
});

describe("decodeSettleCalldata", () => {
  const attestation: Attestation = {
    campaignId: 7n,
    specHash: keccak256(stringToBytes("spec")),
    evidenceHash: keccak256(stringToBytes("evidence")),
    indexBps: 3363,
    observationStart: 20211001,
    observationEnd: 20211231,
    expiresAt: 1_800_000_000n,
  };
  const signature = `0x${"ab".repeat(65)}` as Hex;

  it("recovers the exact attestation and signature submitted to settle()", () => {
    const data = encodeFunctionData({ abi: RILVA_ESCROW_ABI, functionName: "settle", args: [attestation, signature] });
    expect(decodeSettleCalldata(data)).toEqual({ attestation, signature });
  });

  it("rejects calldata for any other function", () => {
    const data = encodeFunctionData({ abi: RILVA_ESCROW_ABI, functionName: "refundAfterDeadline", args: [7n] });
    expect(() => decodeSettleCalldata(data)).toThrow(/settle/);
  });

  // Smart-account and relayer wallets submit settle() as an inner call, e.g. execute(target, value, data).
  const wrap = (inner: Hex) => concat(["0xb61d27f6", encodeAbiParameters(parseAbiParameters("address, uint256, bytes"), [ESCROW, 0n, inner])]);
  const ESCROW = "0x8c277493004aC7Ef14d75bd0dD31ec4dbCd0DB0E" as const;

  it("finds settle() nested inside a smart-account call", () => {
    const inner = encodeFunctionData({ abi: RILVA_ESCROW_ABI, functionName: "settle", args: [attestation, signature] });
    expect(decodeSettleCalldata(wrap(inner), 7n)).toEqual({ attestation, signature });
  });

  it("picks the nested settle() for the requested campaign", () => {
    const other = { ...attestation, campaignId: 8n, indexBps: 21322 };
    const batch = concat([
      wrap(encodeFunctionData({ abi: RILVA_ESCROW_ABI, functionName: "settle", args: [other, signature] })),
      encodeFunctionData({ abi: RILVA_ESCROW_ABI, functionName: "settle", args: [attestation, signature] }),
    ]);
    expect(decodeSettleCalldata(batch, 7n).attestation.indexBps).toBe(3363);
    expect(decodeSettleCalldata(batch, 8n).attestation.indexBps).toBe(21322);
  });

  it("throws when no settle() for that campaign is anywhere in the calldata", () => {
    const inner = encodeFunctionData({ abi: RILVA_ESCROW_ABI, functionName: "settle", args: [attestation, signature] });
    expect(() => decodeSettleCalldata(wrap(inner), 9n)).toThrow(/settle/);
  });
});
