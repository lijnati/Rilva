// Server-only by construction: it reads snapshots from disk via lib/climate/node (node:fs).
import { cache } from "react";
import { getClimateEvidence, SCENARIOS, zScore, type ScenarioId } from "../climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "../climate/node";
import { buildSeasonSeries } from "./explorerSeries";

/**
 * Server-side evidence for every demo scenario, recomputed from the committed, SHA-256-checked
 * ERA5 snapshots (never from precomputed numbers). Cached per request.
 */
export const loadScenarioEvidence = cache(async () => {
  const manifest = await readManifestFromDisk();
  const ids = Object.keys(SCENARIOS) as ScenarioId[];
  const results = await Promise.all(
    ids.map(async (id) => ({
      id,
      result: await getClimateEvidence(SCENARIOS[id].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk }),
    })),
  );
  for (const r of results) {
    if (!r.result.integrity.digestRecomputed || !r.result.integrity.snapshotHashesVerified) {
      throw new Error(`evidence for ${r.id} failed its integrity checks`);
    }
  }
  const series = buildSeasonSeries(results.map((r) => r.result.artifact));
  const scenarios = results.map(({ id, result }) => ({
    id,
    year: Number(result.artifact.core.periods.observed.start.slice(0, 4)),
    z: zScore(result.artifact.core.result.observedTotalDmm, result.artifact.core.data.baselineSeasonTotalsDmm),
    evidenceFile: `${id}.json`,
    provenance: { mode: result.provenance.mode, documents: result.provenance.documents },
  }));
  return { series, scenarios, artifacts: Object.fromEntries(results.map((r) => [r.id, r.result.artifact])) as Record<ScenarioId, (typeof results)[number]["result"]["artifact"]> };
});
