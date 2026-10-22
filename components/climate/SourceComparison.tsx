import { CHIRPS_SOURCE, type SourceComparisonRow } from "@/lib/app/chirps";
import { formatPct } from "@/lib/app/format";
import { cn } from "@/lib/utils";

/**
 * Two datasets, one season: ERA5 (decides the rule) vs CHIRPS v3 (informational) as % of each
 * dataset's own 1991–2020 mean. The rule line shows where the choice of source changes the outcome.
 */
const MAX = 22_000; // 220 % of normal — covers OND 2023

const x = (bps: number) => `${(Math.min(bps, MAX) / MAX) * 100}%`;

export function SourceComparison({ rows, thresholdBps }: { rows: SourceComparisonRow[]; thresholdBps: number }) {
  const t = formatPct(thresholdBps);
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="sources-title">
      <div className="grid items-end gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <h2 id="sources-title" className="h3">Two datasets. Same seasons. Different answers.</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] leading-6 text-ink-2">
            ERA5 and CHIRPS v3 disagree for some seasons (e.g. MAM 2021: 55 % vs 101 % of normal). Rilva shows both and uses ERA5 for the rule,
            because it can be re-fetched and re-hashed byte-for-byte. Disagreement is shown, not hidden.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-full bg-ink" />ERA5 (decides the rule)</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block size-3 rounded-full ring-2 ring-ink-2 ring-inset" />CHIRPS v3 (cross-check)</span>
        </div>
      </div>

      <div className="mt-6 grid gap-1">
        <div className="relative ml-0 mr-3 h-5 sm:ml-[132px] sm:mr-[232px]" aria-hidden="true">
          {[0, 6000, 10000, 15000, 20000].map((b) => (
            <span key={b} className="absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] text-ink-3 tnum" style={{ left: x(b) }}>
              {b / 100} %
            </span>
          ))}
        </div>
        <ul className="grid gap-3">
          {rows.map((r) => {
            const lo = Math.min(r.era5Bps, r.chirpsBps);
            const hi = Math.max(r.era5Bps, r.chirpsBps);
            return (
              <li key={r.key} className="grid gap-2 sm:grid-cols-[120px_1fr_220px] sm:items-center sm:gap-3">
                <p className="text-[13.5px] font-semibold">
                  {r.key}
                  {r.key.startsWith("MAM") && <span className="block text-[11px] font-normal text-ink-3">counter-example, not a campaign</span>}
                </p>
                <div
                  className="relative h-9 rounded-full bg-paper-deep/70"
                  role="img"
                  aria-label={`${r.key}: ERA5 ${r.era5Pct} % of normal, CHIRPS v3 ${r.chirpsPct} % of normal; ${r.gapPp} percentage points apart.`}
                >
                  <span className="absolute inset-y-1 w-px border-l border-dashed border-deficit" style={{ left: x(thresholdBps) }} />
                  <span className="absolute inset-y-1 w-px bg-normal" style={{ left: x(10000) }} />
                  <span className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-rule-strong" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
                  <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface ring-[2.5px] ring-ink-2 ring-inset" style={{ left: x(r.chirpsBps) }} />
                  <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: x(r.era5Bps) }} />
                </div>
                <p className="text-[12.5px] leading-5 tnum">
                  <span className="whitespace-nowrap text-ink-2">ERA5 {r.era5Pct.replace(/\.00$/, "")} % · CHIRPS {r.chirpsPct} %</span>
                  <span className={cn("block font-semibold", r.sourcesAgree ? "text-ink" : "text-deficit")}>
                    {r.sourcesAgree
                      ? `Both ${r.ruleEra5 ? "meet" : "miss"} the ${t} % rule`
                      : `Rule ${r.ruleEra5 ? "met" : "missed"} on ERA5, ${r.ruleChirps ? "met" : "missed"} on CHIRPS`}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-3 sm:ml-[132px]">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-0 border-l border-dashed border-deficit" />{t} % illustrative threshold</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-px bg-normal" />100 % = each dataset&apos;s own 1991–2020 mean</span>
        </div>
      </div>
      <p className="mt-4 text-[11.5px] leading-5 text-ink-3">
        ERA5 values are recomputed from the committed snapshots. CHIRPS: {CHIRPS_SOURCE.citation}, single 0.05° pixel, cited from {CHIRPS_SOURCE.doc} (accessed{" "}
        {CHIRPS_SOURCE.accessed}). CHIRPS never feeds eligibility, the index, the evidence hash or the contract.
      </p>
    </section>
  );
}
