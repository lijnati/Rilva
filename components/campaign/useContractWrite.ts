"use client";

import { useState } from "react";
import type { Abi, Address } from "viem";
import { useConnection, useWriteContract } from "wagmi";
import { useEscrowClient } from "@/components/chain/useRilva";
import type { TxState } from "@/components/chain/TxStatus";
import { CHAIN } from "@/lib/app/appConfig";
import { describeRevert } from "@/lib/app/revert";
import { pinChain } from "@/lib/app/walletRequest";

/**
 * simulate (eth_call, no gas) → wallet → receipt. A call that would revert never reaches the wallet;
 * success is only reported after the receipt says so.
 */
export function useContractWrite() {
  const { client } = useEscrowClient();
  const connection = useConnection();
  const write = useWriteContract();
  const [state, setState] = useState<TxState>({ step: "idle" });

  async function run(call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[]; value?: bigint }, note?: string): Promise<boolean> {
    if (!client || connection.status !== "connected") {
      setState({ step: "failed", name: "NoWallet", reason: "Connect a wallet first." });
      return false;
    }
    try {
      setState({ step: "simulating" });
      const sim = await client.simulateContract({ ...call, account: connection.address } as Parameters<typeof client.simulateContract>[0]);
      setState({ step: "wallet" });
      const hash = await write.mutateAsync(pinChain(sim.request, CHAIN.chain.id) as Parameters<typeof write.mutateAsync>[0]);
      setState({ step: "pending", hash });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setState({ step: "failed", name: "Reverted", reason: "Mined but reverted. Nothing changed.", hash });
        return false;
      }
      setState({ step: "confirmed", hash, note });
      return true;
    } catch (e) {
      const r = describeRevert(e);
      setState((s) => ({ step: "failed", name: r.name, reason: r.reason, hash: "hash" in s ? s.hash : undefined }));
      return false;
    }
  }

  return { state, run, reset: () => setState({ step: "idle" }) };
}
