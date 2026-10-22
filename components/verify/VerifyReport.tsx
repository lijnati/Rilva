"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Hex } from "viem";
import { AddressField, TxLink } from "@/components/chain/AddressField";
import { HashField } from "@/components/chain/HashField";
import { useCampaignRecord, useEscrowClient } from "@/components/chain/useRilva";
import { ERA5_NOTE, thresholdNote } from "@/components/climate/Outcome";
import { ReplayBanner } from "@/components/site/ReplayBanner";
import { CampaignStatusChip, EmptyState, NotConfigured, Skeleton } from "@/components/ui/States";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { loadBrowserEvidence } from "@/lib/app/browserEvidence";
import { campaignView } from "@/lib/app/campaignView";
import { decodeSettleCalldata } from "@/lib/app/chainHistory";
import { formatEth, formatUtc, seasonLabel, formatPct } from "@/lib/app/format";
import { describeRevert } from "@/lib/app/revert";
import { buildVerification, type Check, type CheckKind } from "@/lib/app/verifyChecks";
import { buildVerificationReport } from "@/lib/app/verifyReport";
import { ShareReport } from "./ShareReport";
import { formatBpsAsPercent, type ClimateSpec } from "@/lib/climate";
import { recoverAttestationSigner, rilvaDomain } from "@/lib/contracts";
import { cn } from "@/lib/utils";

const KIND: Record<CheckKind, { label: string; text: string }> = {
  authentic: { label: "Cryptographically authentic", text: "The published rule is exactly the one the contract stored." },
  reproducible: { label: "Data reproducible", text: "Same public inputs, same number, same hash — recomputed in your browser." },
  attested: { label: "Attested by an authorised party", text: "The designated attestor signed exactly these values." },
  contract: { label: "Contract conditions satisfied", text: "The contract applied the rule and paid the fixed recipient once." },
};

const ICON = { pass: "✓", fail: "✕", na: "–", error: "!", pending: "…" } as const;
const WORD = { pass: "Passed", fail: "Failed", na: "Not applicable", error: "Could not check", pending: "Checking" } as const;

function CheckRow({ check, i }: { check: Check; i: number }) {
  return (
    <li className="check-in grid grid-cols-[28px_1fr] gap-3 border-b border-rule py-4 last:border-0" style={{ "--i": i } as React.CSSProperties}>
      <span
        className={cn(
          "mt-0.5 grid size-7 place-items-center rounded-full text-[13px] font-bold",
          check.status === "pass" && "bg-ok text-paper",
          check.status === "fail" && "bg-fail text-paper",
          check.status === "error" && "bg-warn text-paper",
          check.status === "na" && "bg-paper-deep text-ink-3 ring-1 ring-rule",
          check.status === "pending" && "animate-pulse bg-paper-deep text-ink-2 ring-1 ring-rule",
        )}
        aria-hidden="true"
      >
        {ICON[check.status]}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[14.5px] font-semibold">
          {check.title}
          <span className={cn("text-[12px] font-semibold", check.status === "pass" ? "text-ok" : check.status === "fail" ? "text-fail" : check.status === "error" ? "text-warn" : "text-ink-3")}>
            {WORD[check.status]}
          </span>
        </p>
        <p className="meta mt-0.5">{KIND[check.kind].label}</p>
        <p className="mt-1 text-[13px] leading-6 text-ink-2">{check.detail}</p>
        <details className="mt-1 text-[12.5px]">
          <summary className="cursor-pointer text-ink-3 hover:text-ink">How to check this yourself</summary>
          <p className="mt-1 text-ink-2">{check.howTo}</p>
        </details>
      </div>
    </li>
  );
}

export function VerifyReport({ id }: { id: bigint }) {
  const record = useCampaignRecord(id);
  const { client, escrow } = useEscrowClient();
  const found = record.data?.found ? record.data : null;
  const spec: ClimateSpec | null = (() => {
    try {
      return found?.history.created ? (JSON.parse(found.history.created.spec) as ClimateSpec) : null;
    } catch {
      return null;
    }
  })();
  const settledTx = found?.history.settled?.txHash;

  const submitted = useQuery({
    queryKey: ["settleTx", CHAIN.chain.id, settledTx],
    enabled: !!client && !!escrow && !!settledTx,
    queryFn: async () => {
      const tx = await client!.getTransaction({ hash: settledTx! });
      const { attestation, signature } = decodeSettleCalldata(tx.input as Hex);
      const signer = await recoverAttestationSigner(rilvaDomain(CHAIN.chain.id, escrow!), attestation, signature);
      return { attestation, signature, signer };
    },
  });

  const recomputed = useQuery({
    queryKey: ["recompute", found?.campaign.specHash],
    enabled: !!spec && !!found?.history.settled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const r = await loadBrowserEvidence(spec!, { mode: "live-with-snapshot-fallback", timeoutMs: 15_000, retries: 1 });
      return r;
    },
  });

  if (!ESCROW.address) return <NotConfigured />;
  if (record.error)
    return (
      <EmptyState title="Could not read the chain" tone="error" action={<button type="button" className="btn btn-sm btn-outline" onClick={() => record.refetch()}>Try again</button>}>
        <p>{describeRevert(record.error).reason}</p>
      </EmptyState>
    );
  if (record.isPending) return <div className="grid gap-4" aria-busy="true" aria-label="Loading verification"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  if (!found)
    return (
      <EmptyState title={`Campaign #${id} does not exist`} action={<Link className="btn btn-sm btn-outline" href="/campaigns">All campaigns</Link>}>
        <p>There is nothing to verify for this id on {CHAIN.label}.</p>
      </EmptyState>
    );

  const { campaign: c, history } = found;
  const view = campaignView(c, 0n, { refundReason: history.refunded?.reason ?? null });
  const settledOnRule = !!history.settled;

  const verification = buildVerification({
    campaign: c,
    spec: history.created?.spec ?? null,
    settled: history.settled,
    refundReason: history.refunded?.reason ?? null,
    refund: history.refunded ? { recipient: history.refunded.funder, amount: history.refunded.amount } : null,
    submitted: submitted.data?.attestation ?? null,
    recoveredSigner: submitted.data?.signer ?? null,
    recomputed: !settledOnRule
      ? null
      : recomputed.data
        ? { ok: true, indexBps: recomputed.data.artifact.core.result.indexBps, evidenceDigest: recomputed.data.artifact.evidenceDigest, mode: recomputed.data.provenance.mode }
        : recomputed.error
          ? { ok: false, error: recomputed.error instanceof Error ? recomputed.error.message : String(recomputed.error) }
          : null,
    pending: { recompute: settledOnRule && recomputed.isPending, signer: settledOnRule && submitted.isPending },
  });

  const waiting = verification.summary === "checking";
  const summary = waiting
    ? { cls: "bg-paper-deep", title: "Checking…", text: "Reading the settle transaction and recomputing the evidence in your browser." }
    : verification.summary === "all-passed"
      ? { cls: "bg-ok-soft", title: "Every applicable check passed", text: "What that means, and what it does not, is listed under each check and below." }
      : verification.summary === "failed"
        ? { cls: "bg-fail-soft", title: "At least one check failed", text: "Something on-chain does not match the published rule or the recomputed evidence." }
        : verification.summary === "not-settled"
          ? { cls: "bg-ice", title: "Not settled yet", text: "The rule and spec can be checked now; evidence and payout checks apply after settlement." }
          : { cls: "bg-warn-soft", title: "Verification incomplete", text: "Some checks could not run. They are not counted as passed." };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[30px] font-semibold tracking-[-0.04em] sm:text-[38px]">
          Campaign #{id.toString()} <span className="text-ink-3">· {seasonLabel(c.observationStart, c.observationEnd)}</span>
        </h2>
        {view.status !== "NotFound" && <CampaignStatusChip status={view.status} reason={view.refundReason} />}
      </div>
      {spec?.replay && <ReplayBanner season={seasonLabel(c.observationStart, c.observationEnd)} />}
      {CHAIN.isLocal && <p className="rounded-[14px] bg-warn-soft px-4 py-2.5 text-[13px]"><strong>Local development chain.</strong> These records exist only on a Hardhat node on this computer.</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="card p-5 sm:p-6" aria-labelledby="checks-title" aria-busy={waiting}>
          <div className={cn("rounded-[14px] px-4 py-3.5", summary.cls)} role="status" aria-live="polite">
            <p id="checks-title" className="text-[16px] font-semibold">{summary.title}</p>
            <p className="text-[13px] text-ink-2">{summary.text}</p>
          </div>
          <ShareReport
            campaignId={id.toString()}
            ready={!waiting}
            buildJson={(url) =>
              buildVerificationReport({
                campaignId: id,
                chainId: CHAIN.chain.id,
                chainLabel: CHAIN.label,
                escrow: ESCROW.address!,
                url,
                summary: verification.summary,
                checks: verification.checks,
                amountWei: c.amount,
                status: view.status === "Refunded" && view.refundReason ? `Refunded (${view.refundReason})` : view.status,
                specHash: c.specHash,
                evidenceHash: history.settled ? c.evidenceHash : null,
                attestedIndexBps: history.settled?.indexBps ?? null,
                thresholdBps: c.thresholdBps,
                recomputation: recomputed.data ? { mode: recomputed.data.provenance.mode, evidenceDigest: recomputed.data.artifact.evidenceDigest } : null,
                generatedAt: new Date().toISOString(),
              })
            }
          />
          <ol className="mt-2">
            {verification.checks.map((ch, i) => (
              <CheckRow key={ch.id} check={ch} i={i} />
            ))}
          </ol>
          {recomputed.data && (
            <p className="mt-2 text-[12px] text-ink-3">
              Recomputed from {recomputed.data.provenance.mode === "live" ? "a live Open-Meteo response" : "the committed ERA5 snapshot (SHA-256 verified)"}
              {recomputed.data.provenance.fellBackFromLive && ` because Open-Meteo was unreachable (${recomputed.data.provenance.liveError})`}.
            </p>
          )}
          <div className="mt-5 rounded-[14px] bg-paper-deep/70 p-4 text-[13px] leading-6">
            <p className="font-semibold">Not checked, and not claimed</p>
            <ul className="mt-1 grid gap-1 text-ink-2">
              <li>• Whether ERA5 is an accurate measure of rain at this place. {ERA5_NOTE}</li>
              <li>• Whether anyone was helped, or lost money. Rainfall deficit is not drought impact.</li>
              <li>• Whether the attestor is honest. The attestor is trusted to sign honestly; Rilva makes every attestation checkable, not automatically true.</li>
            </ul>
          </div>
        </section>

        <div className="grid content-start gap-6">
          <section className="card grid gap-4 p-5 sm:p-6" aria-labelledby="facts-title">
            <h2 id="facts-title" className="h3">What was decided</h2>
            <dl className="grid gap-3 text-[13px]">
              <div className="flex justify-between gap-4"><dt className="text-ink-2">Location</dt><dd className="text-right font-medium">{spec?.location.label ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-2">Observation dates</dt><dd className="text-right font-medium">{spec ? `${spec.period.start} → ${spec.period.end}` : `${c.observationStart}–${c.observationEnd}`}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-2">Source</dt><dd className="text-right font-medium">{spec ? `Open-Meteo · ${spec.source.model} · ${spec.source.variable}` : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-2">Baseline</dt><dd className="text-right font-medium">{spec ? `${spec.baseline.startYear}–${spec.baseline.endYear}` : "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-ink-2">Threshold</dt><dd className="text-right font-medium">≤ {formatPct(c.thresholdBps)} % of normal</dd></div>
              {history.settled && (
                <div className="flex justify-between gap-4"><dt className="text-ink-2">Attested index</dt><dd className="text-right font-medium tnum">{history.settled.indexBps} bps · {formatBpsAsPercent(history.settled.indexBps)} %</dd></div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Contract decision</dt>
                <dd className="text-right font-medium">
                  {view.status === "Released" ? "Released to beneficiary" : view.status === "Refunded" ? (view.refundReason === "Timeout" ? "Refunded · timeout" : "Refunded · rule not met") : "Pending"}
                </dd>
              </div>
              <div className="flex justify-between gap-4"><dt className="text-ink-2">Amount</dt><dd className="text-right font-medium tnum">{formatEth(c.amount)}</dd></div>
            </dl>
            <p className="text-[11.5px] text-ink-3">{thresholdNote(c.thresholdBps)}</p>
          </section>

          <section className="card grid gap-4 p-5 sm:p-6" aria-labelledby="hashes-title">
            <h2 id="hashes-title" className="h3">Identities and hashes</h2>
            <AddressField label="Attestor" address={c.attestor} />
            <AddressField label={view.status === "Released" ? "Beneficiary (received funds)" : "Beneficiary"} address={c.beneficiary} />
            <AddressField label={view.status === "Refunded" ? "Funder (received refund)" : "Funder"} address={c.funder} />
            <AddressField label="RilvaEscrow contract" address={ESCROW.address} />
            <HashField label="Spec hash" value={c.specHash} />
            {history.settled && <HashField label="Evidence hash (on-chain)" value={c.evidenceHash} />}
            {recomputed.data && <HashField label="Evidence hash (recomputed here)" value={recomputed.data.artifact.evidenceDigest} />}
            <div className="grid gap-1 text-[12.5px]">
              {history.created && <TxLink hash={history.created.txHash} label="Creation transaction" />}
              {history.settled && <TxLink hash={history.settled.txHash} label="Settlement transaction" />}
              {history.refunded && history.refunded.txHash !== history.settled?.txHash && <TxLink hash={history.refunded.txHash} label="Refund transaction" />}
            </div>
            {history.created && <p className="text-[12px] text-ink-3">Created in block {history.created.blockNumber.toString()} · deadline {formatUtc(c.settlementDeadline)}</p>}
          </section>

          <section className="rounded-[18px] bg-ice p-5 text-[13px] leading-6" aria-label="What each kind of check means">
            {(Object.keys(KIND) as CheckKind[]).map((k) => (
              <p key={k} className="mt-1 first:mt-0"><strong>{KIND[k].label}:</strong> <span className="text-ink-2">{KIND[k].text}</span></p>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
