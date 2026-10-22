import { encodeFunctionData, keccak256, stringToBytes, type Hex } from "viem";
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
});
