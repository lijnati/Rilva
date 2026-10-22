"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useConnection, useSignTypedData } from "wagmi";
import { HashField } from "@/components/chain/HashField";
import { TxStatus } from "@/components/chain/TxStatus";
import { WalletControl } from "@/components/chain/WalletControl";
import { CHAIN } from "@/lib/app/appConfig";
import { loadBrowserEvidence } from "@/lib/app/browserEvidence";
import { formatUtc, seasonLabel } from "@/lib/app/format";
import { describeRevert } from "@/lib/app/revert";
import { assertWalletChain } from "@/lib/app/walletRequest";
import { parseSignedAttestation, serializeSignedAttestation, type SignedAttestation } from "@/lib/app/signedAttestation";
import { formatBpsAsPercent, formatDmmAsMm, type ClimateSpec } from "@/lib/climate";
import type { ClimateEvidenceResult } from "@/lib/climate";
import { attestationTypedData, buildAttestation, prepareSettle, rilvaDomain, verifyAttestation, type Attestation, type Campaign } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { useContractWrite } from "./useContractWrite";

type Evidence = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; r: ClimateEvidenceResult } | { kind: "error"; message: string };

function Step({ n, title, children, active }: { n: number; title: string; children: React.ReactNode; active: boolean }) {
  return (
    <section className={cn("grid gap-3 border-t border-rule pt-5 first:border-0 first:pt-0", !active && "opacity-60")} aria-label={title}>
      <h3 className="flex items-center gap-2.5 text-[15px] font-semibold">
        <span className="num">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AttestPanel({
  id,
  c,
  spec,
  escrow,
  chainNow,
  signed,
  onSigned,
  onSettled,
}: {
  id: bigint;
  c: Campaign;
  spec: ClimateSpec;
  escrow: `0x${string}`;
  chainNow: bigint;
  signed: SignedAttestation | null;
  onSigned: (s: SignedAttestation) => void;
  onSettled: () => void;
}) {
  const connection = useConnection();
  const sign = useSignTypedData();
  const tx = useContractWrite();
  const [evidence, setEvidence] = useState<Evidence>({ kind: "idle" });
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const domain = rilvaDomain(CHAIN.chain.id, escrow);
  const connected = connection.status === "connected";
  const isAttestor = connected && connection.address.toLowerCase() === c.attestor.toLowerCase();
  const wrongChain = connected && connection.chainId !== CHAIN.chain.id;
  const busy = tx.state.step === "simulating" || tx.state.step === "wallet" || tx.state.step === "pending";

  async function recompute() {
    setEvidence({ kind: "loading" });
    setAttestation(null);
    try {
      const r = await loadBrowserEvidence(spec, { mode: "live-with-snapshot-fallback", timeoutMs: 15_000, retries: 1 });
      if (r.artifact.core.specHash.toLowerCase() !== c.specHash.toLowerCase()) throw new Error("the recomputed spec hash does not match this campaign");
      const att = buildAttestation({ evidence: r.artifact, campaignId: id, expiresAt: chainNow + 3600n });
      if (att.observationStart !== c.observationStart || att.observationEnd !== c.observationEnd) throw new Error("the evidence period does not match this campaign");
      setEvidence({ kind: "ok", r });
      setAttestation(att);
    } catch (e) {
      setEvidence({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async function doSign() {
    if (!attestation || !isAttestor) return;
    setSignError(null);
    try {
      assertWalletChain(connection.chainId, CHAIN.chain.id);
      const signature = (await sign.mutateAsync(attestationTypedData(domain, attestation))) as Hex;
      if (!(await verifyAttestation(domain, attestation, signature, c.attestor))) throw new Error("The signature does not recover to the attestor. Nothing was submitted.");
      onSigned({ attestation, signature, chainId: CHAIN.chain.id, escrow });
    } catch (e) {
      setSignError(describeRevert(e).reason);
    }
  }

  async function submit(s: SignedAttestation) {
    if (await tx.run(prepareSettle({ escrow, attestation: s.attestation, signature: s.signature }), "Settled. The contract applied the rule and paid the fixed recipient.")) onSettled();
  }

  function loadPasted() {
    setPasteError(null);
    try {
      const s = parseSignedAttestation(pasted);
      if (s.chainId !== CHAIN.chain.id || s.escrow.toLowerCase() !== escrow.toLowerCase()) throw new Error("This attestation is for a different chain or contract.");
      if (s.attestation.campaignId !== id) throw new Error(`This attestation is for campaign #${s.attestation.campaignId}, not #${id}.`);
      onSigned(s);
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : String(e));
    }
  }

  const core = evidence.kind === "ok" ? evidence.r.artifact.core : null;
  const willRelease = attestation ? attestation.indexBps <= c.thresholdBps : null;

  return (
    <div className="card grid gap-6 p-5 sm:p-6">
      <div>
        <h2 className="h3">Attest and settle</h2>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">
          Recomputing in your browser lets you check the number before signing. It does not remove the trust placed in the attestor: the contract accepts whatever
          the designated attestor signs, and everyone can check it afterwards.
        </p>
      </div>

      <Step n={1} title="Recompute the evidence" active>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-sm btn-ink" onClick={recompute} disabled={evidence.kind === "loading"}>
            {evidence.kind === "loading" ? "Fetching ERA5…" : evidence.kind === "ok" ? "Recompute again" : "Recompute from ERA5"}
          </button>
          <span className="text-[12px] text-ink-3">Open-Meteo, models=era5 · falls back to the saved snapshot with a notice</span>
        </div>
        <div aria-live="polite">
          {evidence.kind === "error" && <p className="rounded-[12px] bg-fail-soft px-4 py-3 text-[13px]"><strong>Evidence INVALID — nothing can be signed.</strong> {evidence.message}</p>}
          {core && evidence.kind === "ok" && (
            <div className="grid gap-2 rounded-[12px] bg-paper-deep/70 px-4 py-3 text-[13px]">
              <p>
                <span className="meta mr-2">{evidence.r.provenance.mode === "live" ? "Live response" : "Saved snapshot"}</span>
                {evidence.r.provenance.fellBackFromLive && `Open-Meteo unreachable (${evidence.r.provenance.liveError}); used the committed snapshot. `}
                {core.periods.observed.days}/{core.periods.observed.days} days · {core.periods.baseline.years} baseline seasons · {formatDmmAsMm(core.result.observedTotalDmm)} mm
              </p>
              <p className="tnum">
                Index <strong>{core.result.indexBps} bps</strong> ({formatBpsAsPercent(core.result.indexBps)} % of normal) · spec hash matches this campaign ✓
              </p>
            </div>
          )}
        </div>
      </Step>

      <Step n={2} title="Review the exact signing payload" active={!!attestation}>
        {attestation ? (
          <>
            <div className="overflow-x-auto rounded-[12px] ring-1 ring-rule">
              <table className="w-full min-w-[520px] text-left text-[12.5px]">
                <caption className="sr-only">EIP-712 Attestation fields</caption>
                <thead className="bg-paper-deep/60 text-ink-3">
                  <tr><th scope="col" className="px-3 py-2 font-medium">Field</th><th scope="col" className="px-3 py-2 font-medium">Meaning</th><th scope="col" className="px-3 py-2 font-medium">Raw value</th></tr>
                </thead>
                <tbody className="tnum">
                  {[
                    ["campaignId", "Only this campaign", attestation.campaignId.toString()],
                    ["specHash", "The rule stored at creation", attestation.specHash],
                    ["evidenceHash", "The evidence you just recomputed", attestation.evidenceHash],
                    ["indexBps", `${formatBpsAsPercent(attestation.indexBps)} % of normal`, String(attestation.indexBps)],
                    ["observationStart", "First day observed", String(attestation.observationStart)],
                    ["observationEnd", "Last day observed", String(attestation.observationEnd)],
                    ["expiresAt", `Usable until ${formatUtc(attestation.expiresAt)}`, attestation.expiresAt.toString()],
                  ].map(([k, m, v]) => (
                    <tr key={k} className="border-t border-rule">
                      <th scope="row" className="px-3 py-2 font-mono font-normal">{k}</th>
                      <td className="px-3 py-2 text-ink-2">{m}</td>
                      <td className="max-w-[220px] truncate px-3 py-2 font-mono" title={v}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] text-ink-3">Domain: RilvaEscrow v1 · chain {CHAIN.chain.id} · contract {escrow}</p>
            <p className={cn("rounded-[12px] px-4 py-3 text-[13px]", willRelease ? "bg-mint" : "bg-cream")}>
              <strong>Predicted on-chain outcome: {willRelease ? "Released to the beneficiary" : "Refunded to the funder (rule not met)"}</strong>
              <span className="block text-ink-2">
                {attestation.indexBps} bps {willRelease ? "≤" : ">"} {c.thresholdBps} bps, {seasonLabel(c.observationStart, c.observationEnd)}. The contract decides this itself.
              </span>
            </p>
          </>
        ) : (
          <p className="text-[13px] text-ink-2">Recompute first. The payload is built only from verified evidence.</p>
        )}
      </Step>

      <Step n={3} title="Sign as the attestor" active={!!attestation}>
        {!attestation ? null : signed ? (
          <div className="grid gap-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ok"><span aria-hidden="true">✓</span> Signature recovers to the attestor {c.attestor.slice(0, 8)}…</p>
            <HashField label="Signature" value={signed.signature} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(serializeSignedAttestation(signed)).catch(() => undefined);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy signed attestation (JSON)"}
              </button>
            </div>
          </div>
        ) : !connected || wrongChain ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[13px] text-ink-2">Connect the attestor wallet to sign.</p>
            <WalletControl tone="paper" />
          </div>
        ) : !isAttestor ? (
          <p className="rounded-[12px] bg-paper-deep px-4 py-3 text-[13px] text-ink-2">
            The connected wallet is not this campaign&apos;s attestor (<code className="font-mono">{c.attestor}</code>). The contract would reject its signature
            with InvalidSigner.
          </p>
        ) : (
          <div className="grid gap-2">
            <button type="button" className="btn btn-butter w-fit" onClick={doSign} disabled={sign.isPending}>
              {sign.isPending ? "Confirm in your wallet…" : "Sign attestation"}
            </button>
            {signError && <p className="text-[12.5px] text-fail" role="alert">{signError}</p>}
          </div>
        )}
      </Step>

      <Step n={4} title="Submit to the contract" active={!!signed}>
        {signed ? (
          !connected || wrongChain ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[13px] text-ink-2">Anyone can submit, paying only gas. Connect a wallet.</p>
              <WalletControl tone="paper" />
            </div>
          ) : (
            <button type="button" className="btn btn-ink w-fit" disabled={busy} onClick={() => submit(signed)}>
              Submit settlement
            </button>
          )
        ) : (
          <details className="text-[13px]">
            <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink">I already have a signed attestation</summary>
            <div className="mt-3 grid gap-2">
              <label htmlFor="pasted" className="sr-only">Signed attestation JSON</label>
              <textarea
                id="pasted"
                className="min-h-28 w-full rounded-[14px] bg-surface p-3 font-mono text-[12px] ring-1 ring-rule-strong focus-visible:outline-2"
                placeholder='{"schema":"rilva.signed-attestation.v1", …}'
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                aria-invalid={!!pasteError}
              />
              {pasteError && <p className="text-[12.5px] text-fail" role="alert">{pasteError}</p>}
              <button type="button" className="btn btn-sm btn-outline w-fit" onClick={loadPasted} disabled={!pasted.trim()}>
                Load attestation
              </button>
            </div>
          </details>
        )}
        <TxStatus state={tx.state} />
      </Step>
    </div>
  );
}
