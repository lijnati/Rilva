import { describe, expect, it } from "vitest";
import { chainAddressUrl, chainTxUrl, resolveRilvaChain } from "@/lib/contracts";

const TX = `0x${"ab".repeat(32)}` as const;
const ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

describe("resolveRilvaChain", () => {
  it("defaults to Base Sepolia (84532) with Basescan links and the public RPC", () => {
    const c = resolveRilvaChain({});
    expect(c.network).toBe("base-sepolia");
    expect(c.chain.id).toBe(84532);
    expect(c.rpcUrl).toBe("https://sepolia.base.org");
    expect(c.explorer).toBe("https://sepolia.basescan.org");
    expect(c.isLocal).toBe(false);
  });

  it("supports a clearly labelled local Hardhat chain (31337) with no explorer", () => {
    const c = resolveRilvaChain({ NEXT_PUBLIC_RILVA_CHAIN: "local" });
    expect(c.chain.id).toBe(31337);
    expect(c.rpcUrl).toBe("http://127.0.0.1:8545");
    expect(c.explorer).toBeNull();
    expect(c.isLocal).toBe(true);
    expect(c.label).toMatch(/local/i);
  });

  it("accepts an http(s) RPC override and rejects anything else", () => {
    expect(resolveRilvaChain({ NEXT_PUBLIC_RPC_URL: "https://example.org/rpc" }).rpcUrl).toBe("https://example.org/rpc");
    expect(() => resolveRilvaChain({ NEXT_PUBLIC_RPC_URL: "javascript:alert(1)" })).toThrow(/RPC/);
  });

  it("never resolves to mainnet and rejects unknown networks", () => {
    expect(() => resolveRilvaChain({ NEXT_PUBLIC_RILVA_CHAIN: "base" })).toThrow(/NEXT_PUBLIC_RILVA_CHAIN/);
    expect(() => resolveRilvaChain({ NEXT_PUBLIC_RILVA_CHAIN: "mainnet" })).toThrow();
  });

  it("builds explorer links only when the chain has an explorer", () => {
    const base = resolveRilvaChain({});
    const local = resolveRilvaChain({ NEXT_PUBLIC_RILVA_CHAIN: "local" });
    expect(chainTxUrl(base, TX)).toBe(`https://sepolia.basescan.org/tx/${TX}`);
    expect(chainAddressUrl(base, ADDR)).toBe(`https://sepolia.basescan.org/address/${ADDR}`);
    expect(chainTxUrl(local, TX)).toBeNull();
    expect(chainAddressUrl(local, ADDR)).toBeNull();
  });
});
