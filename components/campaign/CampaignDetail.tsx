"use client";

import Link from "next/link";
import { useState } from "react";
import { useConnection } from "wagmi";
import { useCampaignRecord, useChainTime } from "@/components/chain/useRilva";
import { ReplayBanner } from "@/components/site/ReplayBanner";
import { CampaignStatusChip, EmptyState, NotConfigured, Skeleton } from "@/components/ui/States";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { campaignView, rolesOf } from "@/lib/app/campaignView";
import { formatEth, seasonLabel, formatPct } from "@/lib/app/format";
import { describeRevert } from "@/lib/app/revert";
import type { SignedAttestation } from "@/lib/app/signedAttestation";
import { formatBpsAsPercent, type ClimateSpec } from "@/lib/climate";
import { AttestPanel } from "./AttestPanel";
import { BreakItPanel } from "./BreakItPanel";
import { AuditTimeline, CampaignFacts, CampaignStory } from "./CampaignSummary";
import { RefundPanel } from "./RefundPanel";

function parseSpec(raw: string | undefined): ClimateSpec | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as ClimateSpec;
    return s?.schema === "rilva.spec.v1" ? s : null;
  } catch {
    return null;
  }
}

export function CampaignDetail({ id }: { id: bigint }) {
  const record = useCampaignRecord(id);
  const time = useChainTime();
  const connection = useConnection();
  const [signed, setSigned] = useState<SignedAttestation | null>(null);

  if (!ESCROW.address) return <NotConfigured />;
  if (record.error)
    return (
      <EmptyState title="Could not read this campaign" tone="error" action={<button type="button" className="btn btn-sm btn-outline" onClick={() => record.refetch()}>Try again</button>}>
        <p>{describeRevert(record.error).reason}</p>
        <p className="mt-1 text-[12.5px]">RPC: {CHAIN.rpcUrl}</p>
      </EmptyState>
    );
  if (record.isPending || time.isPending)
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading campaign">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!record.data.found)
    return (
      <EmptyState title={`Campaign #${id} does not exist`} action={<Link className="btn btn-sm btn-outline" href="/campaigns">All campaigns</Link>}>
        <p>Campaign ids start at 1 and increase by one. This contract has not created #{id.toString()}.</p>
      </EmptyState>
    );

  const { campaign: c, history } = record.data;
  const now = time.data ?? 0n;
  const view = campaignView(c, now, { refundReason: history.refunded?.reason ?? null });
  const spec = parseSpec(history.created?.spec);
  const roles = rolesOf(c, connection.status === "connected" ? connection.address : undefined);
  const refetch = () => {
    void record.refetch();
    void time.refetch();
  };

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-[30px] font-semibold tracking-[-0.04em] sm:text-[38px]">
          Campaign #{id.toString()} <span className="text-ink-3">· {seasonLabel(c.observationStart, c.observationEnd)}</span>
        </h2>
        {view.status !== "NotFound" && <CampaignStatusChip status={view.status} reason={view.refundReason} />}
        {connection.status === "connected" && (
          <span className="chip bg-paper-deep text-ink-2">You are: {roles.join(" & ")}</span>
        )}
      </div>
      {spec?.replay && <ReplayBanner season={seasonLabel(c.observationStart, c.observationEnd)} />}
      {CHAIN.isLocal && (
        <p className="rounded-[14px] bg-warn-soft px-4 py-2.5 text-[13px]"><strong>Local development chain.</strong> This campaign exists only on a Hardhat node on this computer.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <CampaignStory c={c} spec={spec} view={view} />
          {(view.status === "Released" || view.status === "Refunded") && (
            <div className={`rounded-[18px] p-5 sm:p-6 ${view.status === "Released" ? "bg-mint" : "bg-paper-deep"}`}>
              <p className="meta">Final outcome</p>
              <p className="mt-1 font-display text-[26px] font-semibold leading-[1.15] tracking-[-0.03em]">
                {view.status === "Released" ? `${formatEth(c.amount)} released to the beneficiary` : `${formatEth(c.amount)} refunded to the funder`}
              </p>
              {history.settled && (
                <p className="mt-1 text-[13px] text-ink-2 tnum">
                  Attested index {history.settled.indexBps} bps = {formatBpsAsPercent(history.settled.indexBps)} % of normal ({history.settled.triggered ? "≤" : ">"}{" "}
                  {formatPct(history.settled.thresholdBps)} %).
                </p>
              )}
              <Link className="btn btn-sm btn-ink mt-4" href={`/verify/${id}`}>
                Verify this campaign independently →
              </Link>
            </div>
          )}
          {view.status === "Active" && spec && view.canSettle && (
            <AttestPanel id={id} c={c} spec={spec} escrow={ESCROW.address} chainNow={now} signed={signed} onSigned={setSigned} onSettled={refetch} />
          )}
          {view.status === "Active" && !spec && (
            <EmptyState title="Spec unavailable" tone="warn"><p>The CampaignCreated event could not be read, so the evidence cannot be rebuilt here.</p></EmptyState>
          )}
          {view.status === "Active" && <RefundPanel id={id} c={c} escrow={ESCROW.address} canRefund={view.canTimeoutRefund} chainNow={now} onDone={refetch} />}
          <BreakItPanel id={id} c={c} active={view.status === "Active"} windowOpen={view.windowOpen} history={history} signed={signed} chainNow={now} />
        </div>

        <div className="grid content-start gap-6">
          <CampaignFacts c={c} spec={spec} />
          <section className="card p-5 sm:p-6" aria-labelledby="trail-title">
            <h2 id="trail-title" className="h3 mb-4">Audit trail</h2>
            <AuditTimeline c={c} history={history} />
          </section>
          <Link className="btn btn-outline w-fit" href={`/verify/${id}`}>
            Public verification report →
          </Link>
        </div>
      </div>
    </div>
  );
}
