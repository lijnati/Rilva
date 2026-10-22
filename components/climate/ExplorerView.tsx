"use client";

import { useEffect, useRef, useState } from "react";
import { HashField } from "@/components/chain/HashField";
import { CHIRPS_OND, CHIRPS_SOURCE } from "@/lib/app/chirps";
import { deficitVsNormal, type SeasonSeries } from "@/lib/app/explorerSeries";
import { formatBpsAsPercent, formatDmmAsMm, SCENARIOS, type ScenarioId } from "@/lib/climate";
import { ERA5_NOTE, RuleOutcome, thresholdNote } from "./Outcome";
import { LiveRecompute } from "./LiveRecompute";
import { SeasonChart } from "./SeasonChart";
import { SeasonTabs } from "./SeasonTabs";

export interface ScenarioInfo {
  id: ScenarioId;
  year: number;
  z: number | null;
  evidenceFile: string;
  provenance: { mode: "live" | "snapshot"; documents: Array<{ id: string; url: string; retrievedAt: string; sha256: string; bytes: number }> };
}

function Row({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 last:border-0">
      <dt className="text-[13px] text-ink-2">{k}</dt>
      <dd className="text-right text-[13.5px] font-medium tnum">
        {v}
        {sub && <span className="block text-[11.5px] font-normal text-ink-3">{sub}</span>}
      </dd>
    </div>
  );
}

export function ExplorerView({ series, scenarios, belowChart }: { series: SeasonSeries; scenarios: ScenarioInfo[]; belowChart?: React.ReactNode }) {
  const [year, setYear] = useState(scenarios[0]!.year);
  const scroller = useRef<HTMLDivElement>(null);
  // On narrow screens the chart scrolls sideways; start at the most recent (replay) seasons.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
  }, []);
  const obs = series.observed.find((o) => o.year === year)!;
  const info = scenarios.find((s) => s.year === year)!;
  const spec = SCENARIOS[info.id].spec;
  const dev = deficitVsNormal(obs.totalDmm, series.baseline.sumDmm, series.baseline.years);
  const chirps = CHIRPS_OND[year];
  const below = obs.indexBps < 10000;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SeasonTabs
          label="Replay season"
          controls="season-panel"
          value={year}
          onChange={setYear}
          options={scenarios.map((s) => ({ value: s.year, label: `OND ${s.year}` }))}
        />
        <p className="meta">Oct–Dec · Hagaya short rains · retrospective replay</p>
      </div>

      <div id="season-panel" role="tabpanel" aria-labelledby={`tab-${year}`} className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        {/* chart */}
        <section className="card p-4 sm:p-6" aria-labelledby="chart-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="chart-title" className="h3">October–December rainfall, 1991–2023 <span className="text-[13px] font-normal tracking-normal text-ink-3">· seasonal total, mm</span></h2>
            <p className="meta">ERA5 · {series.location.resolved.latitude}° N {series.location.resolved.longitude}° E</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-2">
            <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm bg-baseline" />Baseline season</span>
            <span className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm ring-[1.5px] ring-ink-2" />Replay season</span>
            <span className="inline-flex items-center gap-1.5"><i className={`inline-block size-2.5 rounded-sm ${below ? "bg-deficit" : "bg-normal"}`} />Selected · OND {year}</span>
            <span className="inline-flex items-center gap-1.5 text-normal"><i className="inline-block h-0 w-4 border-t-[1.5px] border-normal" />1991–2020 normal · {formatDmmAsMm(series.baseline.meanDmm)} mm</span>
            <span className="inline-flex items-center gap-1.5 text-deficit"><i className="inline-block h-0 w-4 border-t-[1.5px] border-dashed border-deficit" />{formatBpsAsPercent(series.thresholdBps).replace(/\.00$/, "")} % of normal · illustrative threshold</span>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3 sm:hidden" aria-hidden="true">← Scroll for earlier seasons</p>
          <div ref={scroller} className="-mx-2 mt-1 overflow-x-auto px-2 sm:mt-3" aria-describedby="chart-summary">
            <div className="min-w-[560px]">
              <SeasonChart
                points={series.points}
                meanDmm={series.baseline.meanDmm}
                baselineSumDmm={series.baseline.sumDmm}
                baselineYears={series.baseline.years}
                thresholdBps={series.thresholdBps}
                selectedYear={year}
                onSelect={(y) => scenarios.some((s) => s.year === y) && setYear(y)}
              />
            </div>
          </div>
          <p id="chart-summary" className="sr-only">
            {`OND ${year}: ${formatDmmAsMm(obs.totalDmm)} mm, ${formatBpsAsPercent(obs.indexBps)} % of the 1991–2020 normal of ${formatDmmAsMm(series.baseline.meanDmm)} mm.`}
          </p>
          <p className="mt-3 text-[11.5px] text-ink-3">
            Source: ERA5 via Open-Meteo (CC BY 4.0) · Copernicus C3S. <span className="font-mono">models=era5</span>, daily precipitation_sum,
            Africa/Addis_Ababa days. Baseline percentages are shown for context only.
          </p>
          <details className="mt-3 text-[12.5px]">
            <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink">Show the data as a table</summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-[10px] ring-1 ring-rule">
              <table className="w-full text-left tnum">
                <caption className="sr-only">OND seasonal rainfall totals at the ERA5 cell</caption>
                <thead className="sticky top-0 bg-surface text-ink-3">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Season</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">mm</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">% of normal</th>
                    <th scope="col" className="px-3 py-2 font-medium">Kind</th>
                  </tr>
                </thead>
                <tbody>
                  {series.points.map((p) => (
                    <tr key={p.year} className="border-t border-rule">
                      <th scope="row" className="px-3 py-1.5 font-medium">{p.year}</th>
                      <td className="px-3 py-1.5 text-right">{formatDmmAsMm(p.totalDmm)}</td>
                      <td className="px-3 py-1.5 text-right">{formatBpsAsPercent(p.indexBps)}</td>
                      <td className="px-3 py-1.5 text-ink-2">{p.inBaseline ? "Baseline" : "Replay"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        {belowChart}
        </div>

        {/* evidence panel */}
        <section className="card p-5 sm:p-6" aria-labelledby="evidence-title">
          <h2 id="evidence-title" className="sr-only">Evidence for OND {year}</h2>
          <p className="meta">OND {year} · % of 1991–2020 normal</p>
          <p className={`mt-2 font-display text-[64px] font-semibold leading-none tracking-[-0.05em] tnum sm:text-[80px] ${below ? "text-deficit" : "text-normal"}`}>
            {formatBpsAsPercent(obs.indexBps).split(".")[0]}
            <span className="text-[0.45em] tracking-[-0.02em]">.{formatBpsAsPercent(obs.indexBps).split(".")[1]} %</span>
          </p>
          <p className="mt-2 text-[12.5px] text-ink-2">
            {formatDmmAsMm(obs.totalDmm)} mm fell ({obs.start} → {obs.end}) against a normal of {formatDmmAsMm(series.baseline.meanDmm)} mm.
          </p>
          <div className="mt-4">
            <RuleOutcome indexBps={obs.indexBps} thresholdBps={series.thresholdBps} />
            <p className="mt-2 text-[11.5px] text-ink-3">{thresholdNote(series.thresholdBps)}</p>
          </div>

          <dl className="mt-4">
            <Row
              k={dev.kind === "surplus" ? "Surplus vs normal" : "Deficit vs normal"}
              v={`${formatDmmAsMm(dev.dmm)} mm ${dev.kind === "surplus" ? "above" : dev.kind === "deficit" ? "below" : ""}`}
            />
            <Row k="Days with data" v={`${obs.observedDays} / ${obs.observedDays}`} sub="any missing day → INVALID" />
            <Row k="Baseline seasons" v={`${series.baseline.years} / ${series.baseline.endYear - series.baseline.startYear + 1}`} />
            <Row
              k="Index (basis points)"
              v={obs.indexBps}
              sub={`floor(${obs.totalDmm} × 10000 × ${series.baseline.years} / ${series.baseline.sumDmm})`}
            />
            {info.z !== null && <Row k="z-score (informational)" v={info.z.toFixed(2)} />}
            {chirps && (
              <Row k="CHIRPS v3 cross-check" v={`${chirps.percentOfNormal} % · ${chirps.mm} mm`} sub="informational, never used for eligibility" />
            )}
          </dl>

          <div className="mt-4 grid gap-3">
            <HashField label="Evidence digest (keccak256)" value={obs.evidenceDigest} />
            <HashField label="Spec hash" value={obs.specHash} />
          </div>

          <div className="mt-4 rounded-[12px] bg-paper-deep/70 px-3.5 py-3 text-[12px] leading-5 text-ink-2">
            <p>
              <span className="meta mr-1.5">Provenance</span>
              Saved ERA5 snapshots (historical observations), retrieved {info.provenance.documents[0]?.retrievedAt.slice(0, 10)}, SHA-256 verified against
              the manifest ({info.provenance.documents.length} files).
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink">Files and hashes</summary>
              <ul className="mt-2 grid gap-1.5">
                {info.provenance.documents.map((d) => (
                  <li key={d.id} className="min-w-0">
                    <a className="link font-mono text-[11.5px]" href={d.url} target="_blank" rel="noreferrer">{d.id}</a>
                    <code className="block truncate font-mono text-[11px] text-ink-3" title={d.sha256}>sha256 {d.sha256}</code>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="mt-4">
            <LiveRecompute key={year} spec={spec} expectedDigest={obs.evidenceDigest} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn btn-sm btn-outline" href={`/evidence/${info.evidenceFile}`} download>
              Download evidence JSON
            </a>
          </div>
          <p className="mt-4 text-[11.5px] leading-5 text-ink-3">{ERA5_NOTE}</p>
          {chirps && (
            <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
              CHIRPS: {CHIRPS_SOURCE.citation}, cited from {CHIRPS_SOURCE.doc} (accessed {CHIRPS_SOURCE.accessed}).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
