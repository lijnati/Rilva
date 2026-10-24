/**
 * Regional demo scenarios outside Ethiopia (scope change requested 2026-10-24, CLIMATE_DATA.md §3.4).
 * Golden values were computed from the committed ERA5 snapshots retrieved 2026-10-24 and are
 * verification targets only. If these fail, investigate; never edit them to pass.
 */
import { describe, expect, it } from "vitest";
import { getClimateEvidence } from "@/lib/climate";
import { readManifestFromDiskFor, snapshotReaderFor } from "@/lib/climate/node";
import {
  ALL_SCENARIOS,
  assertValidSpec,
  REGIONAL_SCENARIOS,
  SCENARIOS,
  snapshotSlug,
  type RegionalScenarioId,
} from "@/lib/climate/scenarios";
import { specHash } from "@/lib/climate";
import { ClimateError } from "@/lib/climate/types";

describe("regional scenario specs", () => {
  it("are valid SRPN-v1 specs pinned to era5, the illustrative 60 % rule and their local timezone", () => {
    const tz: Record<RegionalScenarioId, string> = {
      "marsabit-ond-2021": "Africa/Nairobi",
      "petrolina-mam-2012": "America/Bahia",
      "beed-jjas-2015": "Asia/Kolkata",
    };
    for (const [id, { spec }] of Object.entries(REGIONAL_SCENARIOS) as Array<[RegionalScenarioId, (typeof REGIONAL_SCENARIOS)[RegionalScenarioId]]>) {
      expect(() => assertValidSpec(spec)).not.toThrow();
      expect(spec.source.model).toBe("era5");
      expect(spec.source.timezone).toBe(tz[id]);
      expect(spec.thresholdBps).toBe(6000);
      expect(spec.replay).toBe(true);
    }
  });

  it("use the baselines decided on 2026-10-24", () => {
    expect(REGIONAL_SCENARIOS["marsabit-ond-2021"].spec.baseline).toEqual({ startYear: 1991, endYear: 2020 });
    expect(REGIONAL_SCENARIOS["petrolina-mam-2012"].spec.baseline).toEqual({ startYear: 1981, endYear: 2010 });
    expect(REGIONAL_SCENARIOS["beed-jjas-2015"].spec.baseline).toEqual({ startYear: 1981, endYear: 2010 });
    expect(REGIONAL_SCENARIOS["petrolina-mam-2012"].spec.period).toEqual({ start: "2012-03-01", end: "2012-05-31" });
    expect(REGIONAL_SCENARIOS["beed-jjas-2015"].spec.period).toEqual({ start: "2015-06-01", end: "2015-09-30" });
  });

  it("do not change or collide with the Yabelo specs", () => {
    const hashes = Object.values(ALL_SCENARIOS).map(({ spec }) => specHash(spec));
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(Object.keys(ALL_SCENARIOS)).toEqual([...Object.keys(SCENARIOS), ...Object.keys(REGIONAL_SCENARIOS)]);
  });
});

describe("snapshotSlug", () => {
  it("keeps Yabelo in its original folder and gives each new location its own", () => {
    expect(snapshotSlug(SCENARIOS["yabelo-ond-2021"].spec)).toBe("yabelo");
    expect(snapshotSlug(REGIONAL_SCENARIOS["marsabit-ond-2021"].spec)).toBe("marsabit");
    expect(snapshotSlug(REGIONAL_SCENARIOS["petrolina-mam-2012"].spec)).toBe("petrolina");
    expect(snapshotSlug(REGIONAL_SCENARIOS["beed-jjas-2015"].spec)).toBe("beed");
  });

  it("refuses a location it does not know instead of guessing a folder", () => {
    const spec = { ...SCENARIOS["yabelo-ond-2021"].spec, location: { label: "x", latitude: 1, longitude: 2 } };
    expect(() => snapshotSlug(spec)).toThrow(ClimateError);
    const wrongTz = { ...SCENARIOS["yabelo-ond-2021"].spec, source: { ...SCENARIOS["yabelo-ond-2021"].spec.source, timezone: "UTC" } };
    expect(() => snapshotSlug(wrongTz)).toThrow(ClimateError);
  });
});

const golden: Array<[RegionalScenarioId, { T: number; S: number; indexBps: number; triggered: boolean; days: number }]> = [
  ["marsabit-ond-2021", { T: 476, S: 51205, indexBps: 2788, triggered: true, days: 92 }],
  ["petrolina-mam-2012", { T: 74, S: 46102, indexBps: 481, triggered: true, days: 92 }],
  ["beed-jjas-2015", { T: 5132, S: 179313, indexBps: 8586, triggered: false, days: 122 }],
];

describe("regional reproduction from committed snapshots (offline)", () => {
  it.each(golden)("%s", async (id, want) => {
    const spec = REGIONAL_SCENARIOS[id].spec;
    const slug = snapshotSlug(spec);
    const r = await getClimateEvidence(spec, { mode: "snapshot", manifest: await readManifestFromDiskFor(slug), readSnapshotFile: snapshotReaderFor(slug) });
    const res = r.artifact.core.result;
    expect(res.observedTotalDmm).toBe(want.T);
    expect(res.baselineSumDmm).toBe(want.S);
    expect(res.baselineYears).toBe(30);
    expect(res.indexBps).toBe(want.indexBps);
    expect(res.triggered).toBe(want.triggered);
    expect(r.artifact.core.data.observedDailyDmm).toHaveLength(want.days);
    expect(r.integrity).toEqual({ snapshotHashesVerified: true, digestRecomputed: true, coreConsistent: true });
  });
});
