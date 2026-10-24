"use client";

import { useState } from "react";
import { keccak256, stringToBytes, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useEscrowClient } from "@/components/chain/useRilva";
import { CHAIN } from "@/lib/app/appConfig";
import { decodeSettleCalldata, type CampaignHistory } from "@/lib/app/chainHistory";
import { describeRevert } from "@/lib/app/revert";
import type { SignedAttestation } from "@/lib/app/signedAttestation";
import { attestationTypedData, prepareRefundAfterDeadline, prepareSettle, RILVA_ESCROW_ABI, rilvaDomain, type Attestation, type Campaign } from "@/lib/contracts";
import { cn } from "@/lib/utils";

type Result = { status: "running" } | { status: "rejected"; name: string; reason: string; expected: boolean } | { status: "accepted" } | { status: "error"; message: string };

interface Scenario {
  id: string;
  title: string;
  attempt: string;
  expect: string;
  available: boolean;
  unavailable: string;
  run: () => Promise<{ call: Parameters<typeof prepareSettle>[0] | null; refund?: boolean }>;
}

const TESTS = [
  ["Unauthorized signer", "rejects a signature from anyone but the designated attestor"],
  ["Modified rainfall index", "rejects a valid signature replayed with a modified index (non-trigger → fake trigger)"],
  ["Modified evidence hash", "rejects a modified evidence hash"],
  ["Duplicate settlement", "rejects replaying an accepted attestation"],
  ["Premature timeout refund", "rejects a timeout refund before the deadline and at deadline − 1"],
];

export function BreakItPanel({
  id,
  c,
  active,
  windowOpen,
  history,
  signed,
  chainNow,
}: {
  chainNow: bigint;
  id: bigint;
  c: Campaign;
  active: boolean;
  windowOpen: boolean;
  history: CampaignHistory;
  signed: SignedAttestation | null;
}) {
  const { client, escrow } = useEscrowClient();
  const [tab, setTab] = useState<"live" | "tests">("live");
  const [results, setResults] = useState<Record<string, Result>>({});
  const domain = escrow ? rilvaDomain(CHAIN.chain.id, escrow) : null;

  // A structurally valid attestation for this campaign (correct spec and period), so the contract reaches the signer check.
  const base: Attestation = signed?.attestation ?? {
    campaignId: id,
    specHash: c.specHash,
    evidenceHash: keccak256(stringToBytes("rilva:break-it:placeholder-evidence")),
    indexBps: 0,
    observationStart: c.observationStart,
    observationEnd: c.observationEnd,
    expiresAt: chainNow + 3600n,
  };

  const scenarios: Scenario[] = [
    {
      id: "unauthorized",
      title: "Sign with a stranger's key",
      attempt: "A throwaway key generated in this tab (never stored or sent) signs a well-formed attestation.",
      expect: "InvalidSigner",
      available: active && windowOpen,
      unavailable: "Needs an active campaign with an open settlement window.",
      run: async () => {
        const stranger = privateKeyToAccount(generatePrivateKey());
        const signature = await stranger.signTypedData(attestationTypedData(domain!, base));
        return { call: { escrow: escrow!, attestation: base, signature } };
      },
    },
    {
      id: "index",
      title: "Change the rainfall index",
      attempt: `Keep the attestor's real signature, but change indexBps from ${signed?.attestation.indexBps ?? "…"} to ${signed ? (signed.attestation.indexBps <= c.thresholdBps ? c.thresholdBps + 5000 : 1000) : "…"} to flip the outcome.`,
      expect: "InvalidSigner",
      available: active && windowOpen && !!signed,
      unavailable: "Needs the attestor's signature from step 3 (or a pasted signed attestation) on an active campaign.",
      run: async () => ({
        call: {
          escrow: escrow!,
          attestation: { ...signed!.attestation, indexBps: signed!.attestation.indexBps <= c.thresholdBps ? c.thresholdBps + 5000 : 1000 },
          signature: signed!.signature,
        },
      }),
    },
    {
      id: "evidence",
      title: "Swap the evidence hash",
      attempt: "Keep the attestor's real signature, but point it at different evidence bytes.",
      expect: "InvalidSigner",
      available: active && windowOpen && !!signed,
      unavailable: "Needs the attestor's signature from step 3 (or a pasted signed attestation) on an active campaign.",
      run: async () => ({
        call: { escrow: escrow!, attestation: { ...signed!.attestation, evidenceHash: keccak256(stringToBytes("different evidence")) }, signature: signed!.signature },
      }),
    },
    {
      id: "duplicate",
      title: "Settle the same campaign twice",
      attempt: "Resubmit the exact attestation and signature that already settled this campaign.",
      expect: "CampaignNotActive",
      available: !!history.settled,
      unavailable: "Needs a campaign that has already been settled by an attestation.",
      run: async () => {
        const tx = await client!.getTransaction({ hash: history.settled!.txHash });
        const { attestation, signature } = decodeSettleCalldata(tx.input as Hex, id);
        return { call: { escrow: escrow!, attestation, signature } };
      },
    },
    {
      id: "refund",
      title: "Refund before the deadline",
      attempt: "Ask for the timeout refund while the settlement window is still open.",
      expect: "SettlementWindowOpen",
      available: active && windowOpen,
      unavailable: "Needs an active campaign before its deadline.",
      run: async () => ({ call: null, refund: true }),
    },
  ];

  async function run(s: Scenario) {
    if (!client || !escrow) return;
    setResults((r) => ({ ...r, [s.id]: { status: "running" } }));
    try {
      const { call, refund } = await s.run();
      const request = refund ? prepareRefundAfterDeadline({ escrow, campaignId: id }) : prepareSettle(call!);
      await client.simulateContract({ ...request, abi: RILVA_ESCROW_ABI, account: c.funder } as Parameters<typeof client.simulateContract>[0]);
      setResults((r) => ({ ...r, [s.id]: { status: "accepted" } }));
    } catch (e) {
      const d = describeRevert(e);
      const known = d.name !== "Error" && !d.reason.toLowerCase().includes("fetch");
      setResults((r) => ({
        ...r,
        [s.id]: known ? { status: "rejected", name: d.name, reason: d.reason, expected: d.name === s.expect } : { status: "error", message: d.reason },
      }));
    }
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="break-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="break-title" className="h3">Try to break it</h2>
          <p className="mt-1 max-w-[60ch] text-[13px] leading-6 text-ink-2">Five ways someone might try to move these funds. Each is checked by the contract itself.</p>
        </div>
        <div role="tablist" aria-label="Evidence type" className="seg">
          <button role="tab" type="button" aria-selected={tab === "live"} className="seg-tab" onClick={() => setTab("live")}>Live simulation</button>
          <button role="tab" type="button" aria-selected={tab === "tests"} className="seg-tab" onClick={() => setTab("tests")}>Contract tests</button>
        </div>
      </div>

      {tab === "live" ? (
        <>
          <p className="mt-4 rounded-[12px] bg-ice px-4 py-2.5 text-[12.5px]">
            <strong>Simulated against the deployed contract (eth_call) — no transaction sent, no gas, nothing changes.</strong> {CHAIN.label}.
          </p>
          <ul className="mt-4 grid gap-3">
            {scenarios.map((s) => {
              const r = results[s.id];
              return (
                <li key={s.id} className="rounded-[14px] p-4 ring-1 ring-rule">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold">{s.title}</p>
                      <p className="text-[12.5px] leading-5 text-ink-2">{s.available ? s.attempt : s.unavailable}</p>
                    </div>
                    <button type="button" className="btn btn-sm btn-outline flex-none" disabled={!s.available || r?.status === "running"} onClick={() => run(s)}>
                      {r?.status === "running" ? "Simulating…" : "Try it"}
                    </button>
                  </div>
                  <div aria-live="polite">
                    {r && r.status !== "running" && (
                      <div
                        className={cn(
                          "mt-3 rounded-[10px] px-3.5 py-2.5 text-[12.5px] leading-5",
                          r.status === "rejected" && r.expected ? "bg-ok-soft" : r.status === "rejected" ? "bg-warn-soft" : "bg-fail-soft",
                        )}
                      >
                        {r.status === "rejected" && (
                          <>
                            <p className="font-semibold">
                              <span aria-hidden="true">{r.expected ? "✓ " : "! "}</span>Rejected: {r.name}
                              {!r.expected && ` (expected ${s.expect})`}
                            </p>
                            <p className="text-ink-2">{r.reason}</p>
                          </>
                        )}
                        {r.status === "accepted" && <p className="font-semibold">✕ Unexpected: the contract would accept this call. Please report it.</p>}
                        {r.status === "error" && <p>Could not run the simulation: {r.message}</p>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-4 grid gap-3">
          <p className="rounded-[12px] bg-paper-deep px-4 py-2.5 text-[12.5px]">
            <strong>Local contract-test reproduction.</strong> The same attacks run in the Hardhat suite (<code className="font-mono">tests/contracts/RilvaEscrow.test.ts</code>), which asserts
            the exact custom error for each. Run <code className="font-mono">pnpm contracts:test</code> to reproduce.
          </p>
          <ul className="grid gap-2 text-[13px]">
            {TESTS.map(([t, name]) => (
              <li key={t} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule pb-2">
                <span className="font-medium">{t}</span>
                <code className="font-mono text-[11.5px] text-ink-2">it(&quot;{name}&quot;)</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
