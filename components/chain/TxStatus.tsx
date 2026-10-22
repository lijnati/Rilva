"use client";

import type { Hex } from "viem";
import { TxLink } from "./AddressField";

export type TxState =
  | { step: "idle" }
  | { step: "simulating" }
  | { step: "wallet" }
  | { step: "pending"; hash: Hex }
  | { step: "confirmed"; hash: Hex; note?: string }
  | { step: "failed"; name: string; reason: string; hash?: Hex };

const LABEL: Record<TxState["step"], string> = {
  idle: "",
  simulating: "Checking the call against the contract (no gas, nothing sent)…",
  wallet: "Confirm in your wallet…",
  pending: "Submitted. Waiting for the block…",
  confirmed: "Confirmed on-chain.",
  failed: "Not sent.",
};

/** simulate → wallet → pending → confirmed / failed, announced politely to screen readers. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.step === "idle") return null;
  const tone = state.step === "failed" ? "bg-fail-soft" : state.step === "confirmed" ? "bg-ok-soft" : "bg-paper-deep";
  return (
    <div role="status" aria-live="polite" className={`rounded-[12px] px-4 py-3 text-[13px] leading-5 ${tone}`}>
      <p className="flex items-center gap-2 font-medium">
        {(state.step === "simulating" || state.step === "wallet" || state.step === "pending") && (
          <span className="inline-block size-3 animate-spin rounded-full border-2 border-ink-3 border-t-transparent" aria-hidden="true" />
        )}
        {state.step === "confirmed" && <span aria-hidden="true" className="text-ok">✓</span>}
        {state.step === "failed" && <span aria-hidden="true" className="text-fail">✕</span>}
        {state.step === "failed" ? `${LABEL.failed} ${state.name}` : LABEL[state.step]}
      </p>
      {state.step === "failed" && <p className="mt-1 text-ink-2">{state.reason}</p>}
      {state.step === "confirmed" && state.note && <p className="mt-1 text-ink-2">{state.note}</p>}
      {"hash" in state && state.hash && (
        <p className="mt-1">
          <TxLink hash={state.hash} />
        </p>
      )}
    </div>
  );
}
