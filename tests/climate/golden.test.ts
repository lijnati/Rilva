/**
 * Golden tests on REAL committed ERA5 snapshots (Open-Meteo, retrieved 2026-10-19).
 * Expected numbers come from Phase 0 (CLIMATE_DATA.md §4) and are verification targets only —
 * production code never contains them. If these fail, investigate; never edit them to pass.
 */
import { describe, expect, it } from "vitest";
import { getClimateEvidence } from "@/lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "@/lib/climate/node";
import { REFERENCE_CASES, SCENARIOS, type ScenarioId } from "@/lib/climate/scenarios";

const cases: Array<[ScenarioId, { T: number; indexBps: number; triggered: boolean }]> = [
  ["yabelo-ond-2021", { T: 787, indexBps: 3363, triggered: true }],
  ["yabelo-ond-2022", { T: 1044, indexBps: 4461, triggered: true }],
  ["yabelo-ond-2023", { T: 4989, indexBps: 21322, triggered: false }],
];

describe("Phase 0 reproduction from committed snapshots (offline)", async () => {
  const manifest = await readManifestFromDisk();

  it.each(cases)("%s", async (id, want) => {
    const r = await getClimateEvidence(SCENARIOS[id].spec, {
      mode: "snapshot",
      manifest,
      readSnapshotFile: readSnapshotFileFromDisk,
    });
    const res = r.artifact.core.result;
    expect(res.observedTotalDmm).toBe(want.T);
    expect(res.baselineSumDmm).toBe(70193);
    expect(res.baselineYears).toBe(30);
    expect(res.indexBps).toBe(want.indexBps);
    expect(res.thresholdBps).toBe(6000);
    expect(res.triggered).toBe(want.triggered);
    expect(r.artifact.core.data.observedDailyDmm).toHaveLength(92);
    expect(r.artifact.core.location.resolved).toMatchObject({ latitude: 5, longitude: 38, elevation: 1891 });
    expect(r.integrity).toEqual({ snapshotHashesVerified: true, digestRecomputed: true, coreConsistent: true });
    expect(r.provenance.mode).toBe("snapshot");
  });

  it("MAM 2021 reference case (ERA5/CHIRPS disagreement) reproduces 5468 bps", async () => {
    const r = await getClimateEvidence(REFERENCE_CASES["yabelo-mam-2021"].spec, {
      mode: "snapshot",
      manifest,
      readSnapshotFile: readSnapshotFileFromDisk,
    });
    expect(r.artifact.core.result).toMatchObject({ observedTotalDmm: 2265, baselineSumDmm: 124257, baselineYears: 30, indexBps: 5468 });
    expect(r.artifact.core.data.observedDailyDmm).toHaveLength(92);
  });

  it("produces the same digest on repeated runs", async () => {
    const opts = { mode: "snapshot" as const, manifest, readSnapshotFile: readSnapshotFileFromDisk };
    const a = await getClimateEvidence(SCENARIOS["yabelo-ond-2021"].spec, opts);
    const b = await getClimateEvidence(SCENARIOS["yabelo-ond-2021"].spec, opts);
    expect(a.artifact.evidenceDigest).toBe(b.artifact.evidenceDigest);
  });
});
