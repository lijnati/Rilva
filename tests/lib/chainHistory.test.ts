import { encodeFunctionData, keccak256, stringToBytes, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeSettleCalldata, logRanges } from "@/lib/app/chainHistory";
import { RILVA_ESCROW_ABI, type Attestation } from "@/lib/contracts";

describe("logRanges", () => {
  it("splits an inclusive block range into bounded chunks, newest last", () => {
    expect(logRanges(0n, 25n, 10n)).toEqual([
      { fromBlock: 0n, toBlock: 9n },
      { fromBlock: 10n, toBlock: 19n },
      { fromBlock: 20n, toBlock: 25n },
    ]);
    expect(logRanges(5n, 5n, 10n)).toEqual([{ fromBlock: 5n, toBlock: 5n }]);
    expect(logRanges(6n, 5n, 10n)).toEqual([]);
    expect(() => logRanges(0n, 5n, 0n)).toThrow();
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
