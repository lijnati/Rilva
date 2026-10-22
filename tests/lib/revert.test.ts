import { BaseError, ChainMismatchError, ContractFunctionRevertedError, encodeErrorResult, keccak256, stringToBytes } from "viem";
import { baseSepolia } from "viem/chains";
import { describe, expect, it } from "vitest";
import { describeRevert } from "@/lib/app/revert";
import { RILVA_ESCROW_ABI } from "@/lib/contracts";

describe("describeRevert", () => {
  it("decodes a RilvaEscrow custom error nested in viem's error chain", () => {
    const data = encodeErrorResult({ abi: RILVA_ESCROW_ABI, errorName: "CampaignNotActive", args: [1n] });
    const reverted = new ContractFunctionRevertedError({ abi: RILVA_ESCROW_ABI, data, functionName: "settle" });
    const outer = new BaseError("Execution reverted", { cause: reverted });
    expect(describeRevert(outer)).toEqual({
      name: "CampaignNotActive",
      reason: "This campaign is already settled or refunded; it cannot be settled again.",
    });
  });

  it("decodes InvalidSigner with its recovered address argument", () => {
    const who = `0x${keccak256(stringToBytes("x")).slice(26)}` as const;
    const data = encodeErrorResult({ abi: RILVA_ESCROW_ABI, errorName: "InvalidSigner", args: [who] });
    const r = describeRevert(new ContractFunctionRevertedError({ abi: RILVA_ESCROW_ABI, data, functionName: "settle" }));
    expect(r.name).toBe("InvalidSigner");
  });

  it("a wallet rejection is reported as such, not as a contract error", () => {
    const e = Object.assign(new Error("User rejected the request."), { code: 4001 });
    expect(describeRevert(e)).toEqual({ name: "UserRejected", reason: "You rejected the request in your wallet. Nothing was sent." });
  });

  it("a wallet on the wrong network is reported as WrongNetwork, nothing sent", () => {
    const e = new BaseError("write failed", { cause: new ChainMismatchError({ chain: baseSepolia, currentChainId: 1 }) });
    const r = describeRevert(e);
    expect(r.name).toBe("WrongNetwork");
    expect(r.reason).toMatch(/Nothing was sent/);
  });

  it("unknown errors keep a short message", () => {
    expect(describeRevert(new Error("fetch failed")).name).toBe("Error");
  });
});
