/**
 * Explorer series built from the three committed evidence cores (snapshot mode, offline).
 * Expected values come from CLIMATE_DATA.md §3.2/§4 — verification targets, never constants in app code.
 */
import { describe, expect, it } from "vitest";
import { buildSeasonSeries } from "@/lib/app/explorerSeries";
import { getClimateEvidence, SCENARIOS, type ScenarioId } from "@/lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "@/lib/climate/node";

async function loadCores() {
  const manifest = await readManifestFromDisk();
  const ids = Object.keys(SCENARIOS) as ScenarioId[];
  return Promise.all(
    ids.map(async (id) => {
      const r = await getClimateEvidence(SCENARIOS[id].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
      return r.artifact;
    }),
  );
}

describe("buildSeasonSeries", async () => {
  const artifacts = await loadCores();
  const series = buildSeasonSeries(artifacts);

  it("has one point per OND season 1991–2023, in year order", () => {
    expect(series.points).toHaveLength(33);
    expect(series.points.map((p) => p.year)).toEqual(Array.from({ length: 33 }, (_, i) => 1991 + i));
    expect(series.points.filter((p) => p.inBaseline)).toHaveLength(30);
  });

  it("reproduces the golden observed indices", () => {
    const byYear = new Map(series.points.map((p) => [p.year, p]));
    expect(byYear.get(2021)).toMatchObject({ totalDmm: 787, indexBps: 3363, inBaseline: false });
    expect(byYear.get(2022)).toMatchObject({ totalDmm: 1044, indexBps: 4461, inBaseline: false });
    expect(byYear.get(2023)).toMatchObject({ totalDmm: 4989, indexBps: 21322, inBaseline: false });
  });

  it("exposes the baseline normal and the illustrative threshold from the spec", () => {
    expect(series.baseline).toMatchObject({ startYear: 1991, endYear: 2020, years: 30, sumDmm: 70193, meanDmm: 2340 });
    expect(series.thresholdBps).toBe(6000);
    expect(series.location.resolved).toMatchObject({ latitude: 5, longitude: 38, elevation: 1891 });
  });

  it("OND 2021 is the second-driest season, 0.1 mm above 1998 (CLIMATE_DATA.md §3.2)", () => {
    const ranked = [...series.points].sort((a, b) => a.totalDmm - b.totalDmm);
    expect(ranked.slice(0, 2).map((p) => [p.year, p.totalDmm])).toEqual([
      [1998, 786],
      [2021, 787],
    ]);
  });

  it("7 of 30 baseline seasons fall at or below the illustrative threshold (base-rate disclosure)", () => {
    const hits = series.points.filter((p) => p.inBaseline && p.indexBps <= series.thresholdBps).map((p) => p.year);
    expect(hits).toEqual([1993, 1996, 1998, 2003, 2007, 2010, 2018]);
  });

  it("keeps each observed season's evidence digest and outcome", () => {
    const o = series.observed.find((s) => s.year === 2023)!;
    expect(o.triggered).toBe(false);
    expect(o.evidenceDigest).toBe(artifacts[2]!.evidenceDigest);
    expect(series.observed.find((s) => s.year === 2021)!.triggered).toBe(true);
  });

  it("refuses cores that do not share one baseline", () => {
    const a = artifacts[0]!;
    const tampered = {
      ...a,
      core: { ...a.core, data: { ...a.core.data, baselineSeasonTotalsDmm: [...a.core.data.baselineSeasonTotalsDmm.slice(1), 1] } },
    };
    expect(() => buildSeasonSeries([tampered, artifacts[1]!])).toThrow(/baseline/);
  });

  it("refuses an empty input", () => {
    expect(() => buildSeasonSeries([])).toThrow();
  });
});
