import { describe, expect, it } from "vitest";
import { assertWalletChain, pinChain, WrongNetworkError } from "@/lib/app/walletRequest";

describe("pinChain", () => {
  it("adds the expected chain id so wagmi/viem assert the wallet's chain before sending", () => {
    const req = { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const, functionName: "settle", args: [1n] };
    expect(pinChain(req, 84532)).toEqual({ ...req, chainId: 84532 });
  });

  it("overrides any chain id already on the request", () => {
    expect(pinChain({ chainId: 1 }, 84532).chainId).toBe(84532);
  });
});

describe("assertWalletChain", () => {
  it("passes when the wallet is on the expected chain", () => {
    expect(() => assertWalletChain(84532, 84532)).not.toThrow();
  });

  it("throws WrongNetworkError for any other or unknown chain", () => {
    expect(() => assertWalletChain(8453, 84532)).toThrow(WrongNetworkError);
    expect(() => assertWalletChain(undefined, 84532)).toThrow(WrongNetworkError);
  });
});
