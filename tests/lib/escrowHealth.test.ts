import { describe, expect, it } from "vitest";
import { checkEscrowDeployment, type EscrowProbe } from "@/lib/app/escrowHealth";

const ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;
const OTHER = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const;
const CODE = "0x6080604052" as const;

function probe(over: Partial<{ chainId: number; code: `0x${string}` | undefined; domain: unknown; fail: string }> = {}): EscrowProbe {
  const domain = over.domain ?? ["0x0f", "RilvaEscrow", "1", 84532n, ADDR, `0x${"00".repeat(32)}`, []];
  return {
    getChainId: async () => {
      if (over.fail === "chainId") throw new Error("fetch failed");
      return over.chainId ?? 84532;
    },
    getCode: async () => ("code" in over ? over.code : CODE),
    readContract: async () => {
      if (over.fail === "domain") throw new Error("execution reverted");
      return domain;
    },
  } as EscrowProbe;
}

describe("checkEscrowDeployment", () => {
  it("passes when chain id, bytecode and the EIP-712 domain all match", async () => {
    expect(await checkEscrowDeployment(probe(), { address: ADDR, chainId: 84532 })).toEqual({ ok: true });
  });

  it("reports a missing address without touching the RPC", async () => {
    const r = await checkEscrowDeployment(probe({ fail: "chainId" }), { address: null, chainId: 84532 });
    expect(r).toMatchObject({ ok: false, problem: "no-address" });
  });

  it("reports an RPC on the wrong chain", async () => {
    const r = await checkEscrowDeployment(probe({ chainId: 8453 }), { address: ADDR, chainId: 84532 });
    expect(r).toMatchObject({ ok: false, problem: "wrong-chain" });
    if (!r.ok) expect(r.detail).toMatch(/8453.*84532/);
  });

  it("reports an address with no contract code (EOA or wrong network)", async () => {
    for (const code of [undefined, "0x"] as const) {
      expect(await checkEscrowDeployment(probe({ code }), { address: ADDR, chainId: 84532 })).toMatchObject({ ok: false, problem: "no-code" });
    }
  });

  it("reports a contract that is not RilvaEscrow v1 for this chain and address", async () => {
    const cases = [
      ["0x0f", "OtherEscrow", "1", 84532n, ADDR],
      ["0x0f", "RilvaEscrow", "2", 84532n, ADDR],
      ["0x0f", "RilvaEscrow", "1", 31337n, ADDR],
      ["0x0f", "RilvaEscrow", "1", 84532n, OTHER],
    ];
    for (const domain of cases) {
      expect(await checkEscrowDeployment(probe({ domain }), { address: ADDR, chainId: 84532 })).toMatchObject({ ok: false, problem: "wrong-contract" });
    }
    expect(await checkEscrowDeployment(probe({ fail: "domain" }), { address: ADDR, chainId: 84532 })).toMatchObject({ ok: false, problem: "wrong-contract" });
  });

  it("reports an unreachable RPC as rpc-error, not as a bad contract", async () => {
    expect(await checkEscrowDeployment(probe({ fail: "chainId" }), { address: ADDR, chainId: 84532 })).toMatchObject({ ok: false, problem: "rpc-error" });
  });

  it("compares the verifying contract case-insensitively", async () => {
    const domain = ["0x0f", "RilvaEscrow", "1", 84532n, ADDR.toLowerCase()];
    expect(await checkEscrowDeployment(probe({ domain }), { address: ADDR, chainId: 84532 })).toEqual({ ok: true });
  });
});
