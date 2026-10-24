"use client";

import Link from "next/link";
import { cardPlace, meterPosition, specForHash } from "@/lib/app/campaignCatalog";
import type { CampaignView } from "@/lib/app/campaignView";
import { formatEth, formatPct, formatUtc, seasonLabel } from "@/lib/app/format";
import type { ClimateSpec } from "@/lib/climate";
import type { Campaign } from "@/lib/contracts";
import { CampaignStatusChip, Skeleton } from "@/components/ui/States";
import { useCampaignRecord } from "@/components/chain/useRilva";
import { PixelScene, type ScenePreset } from "@/components/site/PixelScene";

function parseSpec(raw: string | undefined): ClimateSpec | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as ClimateSpec;
    return s?.schema === "rilva.spec.v1" ? s : null;
  } catch {
    return null;
  }
}

/** Decorative only: the landscape follows the spec's country, the sky follows the contract status. */
function sceneFor(spec: ClimateSpec | null, status: CampaignView["status"]): { preset: ScenePreset; sky?: string[] } {
  const country = spec?.location.label.split(",").at(-1)?.trim() ?? "";
  const preset: ScenePreset = ["Ethiopia", "Kenya"].includes(country) || !spec ? "highland" : "meadow";
  if (status === "Released") return { preset, sky: ["#f2b88f", "#f7d7ae", "#cfe1ea"] };
  if (status === "Refunded") return { preset, sky: ["#8fa8c9", "#c7d3e3", "#e9eef2"] };
  return { preset };
}

function RuleMeter({ thresholdBps, indexBps, triggered }: { thresholdBps: number; indexBps?: number; triggered?: boolean }) {
  const t = meterPosition(thresholdBps);
  const n = meterPosition(10000);
  return (
    <div className="grid gap-1.5" aria-hidden="true">
      <div className="relative h-[6px] rounded-full bg-rule">
        <div className="absolute inset-y-0 left-0 rounded-full bg-ok/45" style={{ width: `${t}%` }} />
        <div className="absolute -top-[3px] h-[12px] w-px bg-ok" style={{ left: `${t}%` }} />
        <div className="absolute -top-[3px] h-[12px] w-px bg-ink-3" style={{ left: `${n}%` }} />
        {indexBps !== undefined && (
          <div
            className={`absolute top-1/2 size-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-[var(--surface)] ${triggered ? "bg-ink" : "bg-ink-3"}`}
            style={{ left: `${meterPosition(indexBps)}%` }}
          />
        )}
      </div>
      <div className="relative h-4 text-[10.5px] text-ink-3 tnum">
        <span className="absolute -translate-x-full whitespace-nowrap pr-1.5" style={{ left: `${t}%` }}>≤ {formatPct(thresholdBps)} % rule</span>
        <span className="absolute whitespace-nowrap pl-1.5" style={{ left: `${n}%` }}>100 % normal</span>
      </div>
    </div>
  );
}

export function CampaignCard({ id, c, status, seed }: { id: bigint; c: Campaign; status: Exclude<CampaignView["status"], "NotFound">; seed: number }) {
  const settledOrRefunded = status !== "Active";
  const record = useCampaignRecord(settledOrRefunded ? id : null);
  const history = record.data?.found ? record.data.history : null;
  const spec = specForHash(c.specHash) ?? parseSpec(history?.created?.spec);
  const { place, region } = spec ? cardPlace(spec.location.label) : { place: "Custom location", region: "Spec in the creation event" };
  const season = seasonLabel(c.observationStart, c.observationEnd);
  const settled = history?.settled ?? null;
  const scene = sceneFor(spec, status);
  const t = formatPct(c.thresholdBps);

  return (
    <Link
      href={`/campaigns/${id}`}
      className="card-raised group flex h-full flex-col p-2 transition-transform duration-500 ease-[var(--ease)] motion-safe:hover:-translate-y-0.5"
      aria-label={`Campaign #${id}: ${place}, ${season}`}
    >
      <div className="relative isolate h-[104px] overflow-hidden rounded-[12px] bg-ice">
        <PixelScene preset={scene.preset} seed={seed} sky={scene.sky} sunX={0.84} sunY={0.3} className="art-layer" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-paper/90 px-2.5 py-0.5 font-mono text-[12px] font-medium text-ink tnum">#{id.toString()}</span>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-3 pb-3 pt-4">
        <div>
          <p className="meta">{season}{spec?.replay ? " · retrospective replay" : ""}</p>
          <p className="mt-1 font-display text-[23px] font-semibold leading-[1.1] tracking-[-0.03em]">{place}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-2">{region}</p>
        </div>

        <div className="grid gap-2.5 rounded-[12px] bg-paper-deep/60 p-3.5 ring-1 ring-rule ring-inset">
          {status === "Active" ? (
            <p className="text-[13px] leading-5 text-ink-2">
              <span className="font-semibold text-ink">Awaiting attestation.</span> Pays out if the index is ≤ {t} % of normal.
            </p>
          ) : settled ? (
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.035em] tnum">{formatPct(settled.indexBps)} %</span>
              <span className="text-[12.5px] text-ink-2">of normal · {settled.triggered ? "≤" : ">"} {t} % rule</span>
            </p>
          ) : record.isPending ? (
            <Skeleton className="h-[28px] w-2/3" />
          ) : (
            <p className="text-[13px] leading-5 text-ink-2">
              {history?.refunded?.reason === "Timeout" ? "No attestation before the deadline." : "Attested index unavailable from the RPC."}
            </p>
          )}
          <RuleMeter thresholdBps={c.thresholdBps} indexBps={settled?.indexBps} triggered={settled?.triggered} />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-[12.5px]">
          <div>
            <dt className="text-ink-3">Escrowed</dt>
            <dd className="mt-0.5 font-semibold tnum">{formatEth(c.amount)}</dd>
          </div>
          <div>
            <dt className="text-ink-3">{status === "Active" ? "Deadline" : "Settlement block"}</dt>
            <dd className="mt-0.5 font-semibold tnum">
              {status === "Active"
                ? formatUtc(c.settlementDeadline).slice(0, 10)
                : (history?.settled?.blockNumber ?? history?.refunded?.blockNumber)?.toString() ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-rule pt-3">
          <CampaignStatusChip status={status} reason={history?.refunded?.reason ?? null} />
          <span className="whitespace-nowrap text-[12.5px] font-semibold">
            Open <span className="i inline-block transition-transform duration-500 group-hover:translate-x-0.5" aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
