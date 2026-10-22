import type { Metadata } from "next";
import { ExplorerView } from "@/components/climate/ExplorerView";
import { LocatorMap } from "@/components/climate/LocatorMap";
import { SourceComparison } from "@/components/climate/SourceComparison";
import { PageHero } from "@/components/site/PageHero";
import { ReplayBanner } from "@/components/site/ReplayBanner";
import { loadScenarioEvidence } from "@/lib/app/evidence.server";
import { formatDmmAsMm } from "@/lib/climate";

export const metadata: Metadata = {
  title: "Climate Explorer",
  description: "Thirty-three October–December seasons of ERA5 rainfall at Yabelo, Ethiopia, against the 1991–2020 normal.",
};

export default async function ExplorePage() {
  const { series, scenarios, sources } = await loadScenarioEvidence();
  const { resolved, requested } = series.location;

  return (
    <>
      <PageHero
        seed={41}
        eyebrow="Climate Explorer · Yabelo, Borena"
        title={
          <>
            Thirty-three short rains. One <em>honest</em> record.
          </>
        }
        lede={`October–December rainfall at one ERA5 grid cell in southern Ethiopia, compared with its own 1991–2020 normal of ${formatDmmAsMm(series.baseline.meanDmm)} mm.`}
      />
      <main id="main" className="container-rv grid grid-cols-[minmax(0,1fr)] gap-10 pb-20 pt-6">
        <ReplayBanner />
        <ExplorerView
          series={series}
          scenarios={scenarios}
          belowChart={
            <LocatorMap
              label={series.location.label}
              requested={requested}
              era5Cell={{ latitude: resolved.latitude, longitude: resolved.longitude, size: 0.25 }}
              chirpsCell={{ latitude: 4.875, longitude: 38.075, size: 0.05 }}
            />
          }
        />

        <SourceComparison rows={sources} thresholdBps={series.thresholdBps} />

        <section aria-labelledby="place-title">
          <div className="card p-5 sm:p-6">
            <h2 id="place-title" className="h3">Where and what</h2>
            <div className="mt-3 grid items-start gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <dl className="grid gap-0 text-[13px]">
              {[
                ["Place", "Yabelo, Borena Zone, Oromia, Ethiopia"],
                ["Requested point", `${requested.latitude}° N, ${requested.longitude}° E`],
                ["Resolved ERA5 cell", `${resolved.latitude}° N, ${resolved.longitude}° E · ${resolved.elevation} m`],
                ["Day boundary", `Africa/Addis_Ababa (UTC+${resolved.utcOffsetSeconds / 3600})`],
                ["Variable", "precipitation_sum, mm/day (0.1 mm steps)"],
                ["Model", "ERA5 reanalysis, pinned (models=era5)"],
                ["Season", "Oct 1 – Dec 31 (Hagaya short rains)"],
                ["Baseline", `${series.baseline.startYear}–${series.baseline.endYear}, ${series.baseline.years} seasons`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-rule py-2.5 last:border-0">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-[12px] bg-ice px-4 py-3.5 text-[13px] leading-6">
              <p className="font-semibold">What this cell is, and is not</p>
              <p className="mt-1 text-ink-2">
                One ~28 km ERA5 grid cell over Yabelo. It is a model estimate, not a rain gauge, and it does not represent Borena Zone, a farm or a
                household. A different baseline period would shift every percentage.
              </p>
            </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
