"use client";

import type { CampaignHistory } from "@/lib/app/chainHistory";
import type { CampaignView } from "@/lib/app/campaignView";
import { formatEth, formatLatLon, formatUtc, seasonLabel, formatPct } from "@/lib/app/format";
import { formatBpsAsPercent, type ClimateSpec } from "@/lib/climate";
import type { Campaign } from "@/lib/contracts";
import { AddressField, TxLink } from "@/components/chain/AddressField";
import { HashField, truncateMiddle } from "@/components/chain/HashField";

export function CampaignStory({ c, spec, view }: { c: Campaign; spec: ClimateSpec | null; view: CampaignView }) {
  const season = seasonLabel(c.observationStart, c.observationEnd);
  const place = spec?.location.label ?? "the spec's location";
  const t = formatPct(c.thresholdBps);
  return (
    <div className="rounded-[18px] bg-cream p-5 text-[15px] leading-7 sm:p-6">
      <p>
        <strong>{truncateMiddle(c.funder, 6, 4)}</strong> locked <strong>{formatEth(c.amount)}</strong>. If {season} rainfall at {place} is at or below{" "}
        <strong>{t} % of normal</strong>
        {spec && ` (${spec.baseline.startYear}–${spec.baseline.endYear})`}, as signed by attestor <strong>{truncateMiddle(c.attestor, 6, 4)}</strong>, the contract
        releases it to beneficiary <strong>{truncateMiddle(c.beneficiary, 6, 4)}</strong>. Otherwise it returns to the funder.
      </p>
      <p className="mt-2 text-[13px] text-ink-2">
        {view.status === "Active"
          ? view.windowOpen
            ? `Settlement is open until ${formatUtc(c.settlementDeadline)}. After that, anyone can refund the funder.`
            : `The settlement window closed at ${formatUtc(c.settlementDeadline)}. Anyone can now refund the funder.`
          : view.status === "Released"
            ? "Settled: the rule was met and the beneficiary was paid. This campaign is final."
            : view.refundReason === "Timeout"
              ? "Refunded after the deadline passed without a settlement. This campaign is final."
              : "Settled: the rule was not met and the funder was repaid. This campaign is final."}
      </p>
    </div>
  );
}

export function CampaignFacts({ c, spec }: { c: Campaign; spec: ClimateSpec | null }) {
  return (
    <dl className="card grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2 sm:p-6">
      <div><dt className="meta mb-1">Funder</dt><dd><AddressField address={c.funder} /></dd></div>
      <div><dt className="meta mb-1">Beneficiary (fixed)</dt><dd><AddressField address={c.beneficiary} /></dd></div>
      <div><dt className="meta mb-1">Attestor</dt><dd><AddressField address={c.attestor} /></dd></div>
      <div><dt className="meta mb-1">Escrowed</dt><dd className="text-[15px] font-semibold tnum">{formatEth(c.amount)}</dd></div>
      <div>
        <dt className="meta mb-1">Observation period</dt>
        <dd className="text-[14px] font-medium">{seasonLabel(c.observationStart, c.observationEnd)} <span className="font-normal text-ink-2">({spec ? `${spec.period.start} → ${spec.period.end}` : `${c.observationStart}–${c.observationEnd}`})</span></dd>
      </div>
      <div>
        <dt className="meta mb-1">Rule</dt>
        <dd className="text-[14px] font-medium">Index ≤ {c.thresholdBps} bps ({formatPct(c.thresholdBps)} % of normal) <span className="block text-[12px] font-normal text-ink-3">Illustrative hackathon rule, not an official drought definition.</span></dd>
      </div>
      <div><dt className="meta mb-1">Settlement deadline</dt><dd className="text-[14px] font-medium tnum">{formatUtc(c.settlementDeadline)}</dd></div>
      <div>
        <dt className="meta mb-1">Data</dt>
        <dd className="text-[14px] font-medium">{spec ? `ERA5 (${spec.source.model}) via Open-Meteo · ${formatLatLon(spec.location.latitude, spec.location.longitude)} · days in ${spec.source.timezone}` : "Spec unavailable"}</dd>
      </div>
      <div className="sm:col-span-2"><HashField label="Spec hash" value={c.specHash} /></div>
    </dl>
  );
}

export function AuditTimeline({ c, history }: { c: Campaign; history: CampaignHistory }) {
  const items: Array<{ title: string; body: React.ReactNode; tx?: `0x${string}`; block?: bigint; done: boolean }> = [
    {
      title: "Created and funded",
      body: <>Terms and spec hash stored; {formatEth(c.amount)} locked by {truncateMiddle(c.funder, 6, 4)}.</>,
      tx: history.created?.txHash,
      block: history.created?.blockNumber,
      done: !!history.created,
    },
  ];
  if (history.settled) {
    const s = history.settled;
    items.push({
      title: s.triggered ? "Settled · rule met → Released" : "Settled · rule not met",
      body: (
        <>
          Attested index {s.indexBps} bps ({formatBpsAsPercent(s.indexBps)} % of normal) vs threshold {s.thresholdBps} bps. {formatEth(s.amount)} sent to{" "}
          {s.triggered ? "the beneficiary" : "the funder"} ({truncateMiddle(s.recipient, 6, 4)}).
        </>
      ),
      tx: s.txHash,
      block: s.blockNumber,
      done: true,
    });
  }
  if (history.refunded) {
    items.push({
      title: history.refunded.reason === "Timeout" ? "Refunded · deadline passed" : "Refunded to funder",
      body: <>{formatEth(history.refunded.amount)} returned to {truncateMiddle(history.refunded.funder, 6, 4)} (reason: {history.refunded.reason}).</>,
      tx: history.refunded.txHash,
      block: history.refunded.blockNumber,
      done: true,
    });
  }
  if (!history.settled && !history.refunded) {
    items.push({ title: "Awaiting attestation or deadline", body: <>Funds remain in escrow until a valid settlement or a timeout refund after {formatUtc(c.settlementDeadline)}.</>, done: false });
  }
  return (
    <ol className="relative grid gap-6 border-l border-rule-strong pl-6" aria-label="Audit trail">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[31px] top-1 grid size-[13px] place-items-center rounded-full ring-4 ring-paper ${it.done ? "bg-ink" : "border border-dashed border-ink-3 bg-paper"}`} aria-hidden="true" />
          <p className="text-[14px] font-semibold">{it.title}</p>
          <p className="mt-0.5 text-[13px] leading-6 text-ink-2">{it.body}</p>
          {it.tx && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-ink-3">
              {it.block !== undefined && <span>Block {it.block.toString()}</span>}
              <TxLink hash={it.tx} />
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
