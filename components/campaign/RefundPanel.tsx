"use client";

import { useConnection } from "wagmi";
import { TxStatus } from "@/components/chain/TxStatus";
import { WalletControl } from "@/components/chain/WalletControl";
import { formatDuration, formatEth, formatUtc } from "@/lib/app/format";
import { prepareRefundAfterDeadline, type Campaign } from "@/lib/contracts";
import { CHAIN } from "@/lib/app/appConfig";
import { useContractWrite } from "./useContractWrite";

/** Timeout refund: permissionless, only after the deadline, always to the funder. */
export function RefundPanel({ id, c, escrow, canRefund, chainNow, onDone }: { id: bigint; c: Campaign; escrow: `0x${string}`; canRefund: boolean; chainNow: bigint; onDone: () => void }) {
  const connection = useConnection();
  const tx = useContractWrite();
  const wrongChain = connection.status === "connected" && connection.chainId !== CHAIN.chain.id;

  if (!canRefund) {
    const left = Number(c.settlementDeadline - chainNow);
    return (
      <div className="rounded-[14px] bg-paper-deep/70 p-4 text-[13px] leading-6 text-ink-2">
        <p className="font-semibold text-ink">Timeout refund · not yet available</p>
        <p>
          If nobody settles, anyone can return {formatEth(c.amount)} to the funder after {formatUtc(c.settlementDeadline)}
          {left > 0 && ` (in about ${formatDuration(left)})`}. The contract would reject it now with SettlementWindowOpen.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-[14px] bg-cream p-5">
      <p className="text-[15px] font-semibold">The deadline has passed without a settlement.</p>
      <p className="text-[13px] leading-6 text-ink-2">
        Anyone may trigger the refund. The full {formatEth(c.amount)} goes to the funder <code className="font-mono">{c.funder}</code> — never to the caller.
      </p>
      {connection.status !== "connected" || wrongChain ? (
        <WalletControl tone="paper" />
      ) : (
        <button
          type="button"
          className="btn btn-ink w-fit"
          disabled={tx.state.step === "simulating" || tx.state.step === "wallet" || tx.state.step === "pending"}
          onClick={async () => {
            if (await tx.run(prepareRefundAfterDeadline({ escrow, campaignId: id }), "Refunded to the funder (reason: Timeout).")) onDone();
          }}
        >
          Refund {formatEth(c.amount)} to the funder
        </button>
      )}
      <TxStatus state={tx.state} />
    </div>
  );
}
