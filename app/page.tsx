import { getClimateEvidence, SCENARIOS, type ScenarioId } from "@/lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "@/lib/climate/node";
import { baselineMeanDmmRounded, formatBpsAsPercent, formatDmmAsMm } from "@/lib/climate/srpn";

// Phase 1 shell: proves the climate engine runs inside Next.js. The full UI arrives in Phase 2–3.
async function loadScenarios() {
  const manifest = await readManifestFromDisk();
  const ids = Object.keys(SCENARIOS) as ScenarioId[];
  return Promise.all(
    ids.map(async (id) => ({
      id,
      ...SCENARIOS[id],
      result: await getClimateEvidence(SCENARIOS[id].spec, {
        mode: "snapshot",
        manifest,
        readSnapshotFile: readSnapshotFileFromDisk,
      }),
    })),
  );
}

function shortHash(h: string) {
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

export default async function Home() {
  const rows = await loadScenarios();
  const first = rows[0]!.result.artifact.core;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-ink-3">Phase 1 · climate engine</p>
      <h1 className="mt-3 max-w-[18ch] text-4xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[56px]">
        Climate evidence. Verifiable relief.
      </h1>
      <p className="mt-6 max-w-[68ch] text-base leading-7 text-ink-2">
        Seasonal rainfall at {first.spec.location.label}, October–December, compared with the same season in{" "}
        {first.periods.baseline.startYear}–{first.periods.baseline.endYear}. Values are recomputed on the server from saved
        ERA5 snapshots each time this page is built.
      </p>

      <div role="note" className="mt-10 border-l-2 border-warn bg-surface px-4 py-3 text-sm leading-6 text-ink-2">
        <strong className="font-semibold text-ink">Retrospective replay.</strong> These are past seasons, not a live drought
        alert. ERA5 is a reanalysis estimate for one ~28 km grid cell; it does not measure drought impact or financial loss.
        The 60 % threshold is an illustrative hackathon rule, not an official drought definition.
      </div>

      <div className="mt-10 overflow-x-auto rounded-[10px] border border-rule bg-surface">
        <table className="w-full min-w-[720px] whitespace-nowrap text-left text-sm tabular-nums">
          <caption className="sr-only">SRPN-v1 results for three historical OND seasons at Yabelo</caption>
          <thead className="border-b border-rule text-xs text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Season</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Rainfall</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Normal (mean)</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">% of normal</th>
              <th scope="col" className="px-4 py-3 font-medium">Rule ≤ 60 %</th>
              <th scope="col" className="px-4 py-3 font-medium">Evidence digest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, title, result }) => {
              const r = result.artifact.core.result;
              return (
                <tr key={id} className="border-b border-rule last:border-0">
                  <th scope="row" className="px-4 py-3 font-medium">{title}</th>
                  <td className="px-4 py-3 text-right">{formatDmmAsMm(r.observedTotalDmm)} mm</td>
                  <td className="px-4 py-3 text-right text-ink-2">
                    {formatDmmAsMm(baselineMeanDmmRounded(r.baselineSumDmm, r.baselineYears))} mm
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.indexBps < 10000 ? "text-deficit" : "text-normal"}`}>
                    {formatBpsAsPercent(r.indexBps)} %
                  </td>
                  <td className="px-4 py-3">{r.triggered ? "Condition met" : "Not met"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-2" title={result.artifact.evidenceDigest}>
                    {shortHash(result.artifact.evidenceDigest)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-5 text-ink-3">
        Source: Open-Meteo archive API, <span className="font-mono">models=era5</span>, precipitation_sum, grid cell{" "}
        {first.location.resolved.latitude}° N, {first.location.resolved.longitude}° E. Provenance: saved snapshot (not a live
        reading), integrity-checked by SHA-256. Index = floor(T × 10000 × N / S) basis points.
      </p>
    </main>
  );
}
