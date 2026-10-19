import { keccak256, sha256, stringToBytes } from "viem";
import { describe, expect, it } from "vitest";
import {
  buildEvidence,
  evidenceDigest,
  seriesDigest,
  specHash,
  verifyEvidenceArtifact,
} from "@/lib/climate/evidence";
import { makeSeasonSpec } from "@/lib/climate/scenarios";
import type { ClimateSpec } from "@/lib/climate/types";
import { mergeSeries, parseOpenMeteoDaily } from "@/lib/climate/validate";
import { syntheticBody, syntheticResponse } from "../helpers/synthetic";

const TZ = "Africa/Addis_Ababa";

/** SYNTHETIC: a tiny 3-year baseline (1991–1993) with a short Oct 1–3 season. */
function syntheticSpec(overrides: Partial<ClimateSpec> = {}): ClimateSpec {
  return {
    ...makeSeasonSpec({
      label: "SYNTHETIC test location",
      latitude: 4.88,
      longitude: 38.08,
      start: "2021-10-01",
      end: "2021-10-03",
      baselineStartYear: 1991,
      baselineEndYear: 1993,
      thresholdBps: 6000,
      replay: true,
    }),
    ...overrides,
  };
}

function syntheticSeries(observed: (i: number) => number = () => 0.5, gen = 0.5) {
  const parts = [1991, 1992, 1993].map((y) =>
    parseOpenMeteoDaily(syntheticResponse({ start: `${y}-10-01`, end: `${y}-10-03`, value: () => 1.0, generationtimeMs: gen }), {
      start: `${y}-10-01`,
      end: `${y}-10-03`,
      timezone: TZ,
    }),
  );
  parts.push(
    parseOpenMeteoDaily(syntheticResponse({ start: "2021-10-01", end: "2021-10-03", value: (_d, i) => observed(i), generationtimeMs: gen }), {
      start: "2021-10-01",
      end: "2021-10-03",
      timezone: TZ,
    }),
  );
  return mergeSeries(parts);
}

describe("keccak256 primitive", () => {
  it("is Keccak-256 (Ethereum), not SHA3-256", () => {
    expect(keccak256(stringToBytes(""))).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  });
});

describe("buildEvidence", () => {
  it("computes the SRPN result inside the evidence core", () => {
    const art = buildEvidence(syntheticSpec(), syntheticSeries());
    expect(art.core.result).toMatchObject({
      observedTotalDmm: 15,
      baselineSumDmm: 90,
      baselineYears: 3,
      indexBps: 5000,
      thresholdBps: 6000,
      triggered: true,
    });
    expect(art.core.data.observedDailyDmm).toEqual([5, 5, 5]);
    expect(art.core.data.baselineSeasonTotalsDmm).toEqual([30, 30, 30]);
    expect(art.core.location.resolved).toEqual({ latitude: 5, longitude: 38, elevation: 1891, utcOffsetSeconds: 10800 });
    expect(art.core.source.model).toBe("era5");
    expect(art.evidenceDigest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("produces an identical digest for identical input", () => {
    const a = buildEvidence(syntheticSpec(), syntheticSeries());
    const b = buildEvidence(syntheticSpec(), syntheticSeries());
    expect(a.evidenceDigest).toBe(b.evidenceDigest);
    expect(a.core).toEqual(b.core);
  });

  it("digest = keccak256(utf8(JCS(core)))", () => {
    const a = buildEvidence(syntheticSpec(), syntheticSeries());
    expect(evidenceDigest(a.core)).toBe(a.evidenceDigest);
  });

  it("changes when a single observation changes", () => {
    const a = buildEvidence(syntheticSpec(), syntheticSeries());
    const b = buildEvidence(syntheticSpec(), syntheticSeries((i) => (i === 1 ? 0.6 : 0.5)));
    expect(a.evidenceDigest).not.toBe(b.evidenceDigest);
  });

  it.each<[string, Partial<ClimateSpec>]>([
    ["coordinates", { location: { label: "SYNTHETIC test location", latitude: 4.89, longitude: 38.08 } }],
    ["threshold", { thresholdBps: 5000 }],
    ["replay flag", { replay: false }],
  ])("changes when the %s change", (_n, override) => {
    const a = buildEvidence(syntheticSpec(), syntheticSeries());
    const b = buildEvidence(syntheticSpec(override), syntheticSeries());
    expect(specHash(syntheticSpec())).not.toBe(specHash(syntheticSpec(override)));
    expect(a.evidenceDigest).not.toBe(b.evidenceDigest);
  });

  it("changes when the model changes", () => {
    const spec = syntheticSpec();
    const other = { ...spec, source: { ...spec.source, model: "era5_land" } } as unknown as ClimateSpec;
    expect(() => buildEvidence(other, syntheticSeries())).toThrow(/INVALID_SEASON|model/);
    expect(specHash(spec)).not.toBe(specHash(other));
  });

  it("changes when the date range changes", () => {
    const a = buildEvidence(syntheticSpec(), syntheticSeries());
    const shorter = syntheticSpec({ period: { start: "2021-10-01", end: "2021-10-02" } });
    const b = buildEvidence(shorter, syntheticSeries());
    expect(a.evidenceDigest).not.toBe(b.evidenceDigest);
  });

  it("is identical for live-shaped and snapshot-shaped responses whose raw bytes differ", () => {
    const bodyA = syntheticBody({ start: "2021-10-01", end: "2021-10-03", generationtimeMs: 0.43 });
    const bodyB = syntheticBody({ start: "2021-10-01", end: "2021-10-03", generationtimeMs: 12.7 });
    expect(sha256(stringToBytes(bodyA))).not.toBe(sha256(stringToBytes(bodyB)));
    const a = buildEvidence(syntheticSpec(), syntheticSeries(undefined, 0.43));
    const b = buildEvidence(syntheticSpec(), syntheticSeries(undefined, 12.7));
    expect(a.evidenceDigest).toBe(b.evidenceDigest);
  });

  it("refuses to build evidence when an observed day is missing", () => {
    const partial = mergeSeries([
      parseOpenMeteoDaily(syntheticResponse({ start: "1991-10-01", end: "1993-12-31" }), { start: "1991-10-01", end: "1993-12-31", timezone: TZ }),
      parseOpenMeteoDaily(syntheticResponse({ start: "2021-10-01", end: "2021-10-02" }), { start: "2021-10-01", end: "2021-10-02", timezone: TZ }),
    ]);
    expect(() => buildEvidence(syntheticSpec(), partial)).toThrow(/MISSING_DATE.*2021-10-03/);
  });

  it("rejects a spec whose resolved grid timezone does not match", () => {
    expect(() => buildEvidence(syntheticSpec({ source: { provider: "open-meteo", model: "era5", variable: "precipitation_sum", timezone: "UTC" } }), syntheticSeries())).toThrow(
      /UNEXPECTED_TIMEZONE/,
    );
  });
});

describe("seriesDigest", () => {
  it("covers exactly the days used, in date order", () => {
    const s = syntheticSeries();
    const d1 = seriesDigest(s.grid, [["2021-10-01", 5], ["2021-10-02", 5]]);
    const d2 = seriesDigest(s.grid, [["2021-10-01", 5], ["2021-10-02", 6]]);
    expect(d1).not.toBe(d2);
    expect(() => seriesDigest(s.grid, [["2021-10-02", 5], ["2021-10-01", 5]])).toThrow(/UNEXPECTED_DATE/);
  });
});

describe("verifyEvidenceArtifact (tamper detection)", () => {
  it("accepts an untouched artifact", () => {
    const art = buildEvidence(syntheticSpec(), syntheticSeries());
    expect(verifyEvidenceArtifact(JSON.parse(JSON.stringify(art)))).toEqual({ ok: true, problems: [] });
  });

  it("detects an edited result, an edited observation and an edited digest", () => {
    const art = buildEvidence(syntheticSpec(), syntheticSeries());

    const r1 = structuredClone(art);
    r1.core.result.indexBps = 3363;
    expect(verifyEvidenceArtifact(r1).ok).toBe(false);

    const r2 = structuredClone(art);
    r2.core.data.observedDailyDmm[0] = 50;
    const v2 = verifyEvidenceArtifact(r2);
    expect(v2.ok).toBe(false);
    expect(v2.problems.join(" ")).toMatch(/digest|total/);

    const r3 = structuredClone(art);
    r3.evidenceDigest = keccak256(stringToBytes("forged"));
    expect(verifyEvidenceArtifact(r3).ok).toBe(false);
  });
});
