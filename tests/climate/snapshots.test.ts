import { sha256, stringToBytes } from "viem";
import { describe, expect, it, vi } from "vitest";
import { getClimateEvidence } from "@/lib/climate";
import { makeSeasonSpec } from "@/lib/climate/scenarios";
import { loadSnapshotDocuments, type SnapshotManifest, type ReadSnapshotFile } from "@/lib/climate/snapshots";
import type { FetchLike } from "@/lib/climate/source";
import { syntheticBody } from "../helpers/synthetic";

/** SYNTHETIC two-year baseline + 3-day season, stored as an in-memory "snapshot set". */
const spec = makeSeasonSpec({
  label: "SYNTHETIC test location",
  latitude: 4.88,
  longitude: 38.08,
  start: "2021-10-01",
  end: "2021-10-03",
  baselineStartYear: 1991,
  baselineEndYear: 1992,
  thresholdBps: 6000,
  replay: true,
});

const files: Record<string, string> = {
  "base.json": syntheticBody({ start: "1991-01-01", end: "1992-12-31" }),
  "obs.json": syntheticBody({ start: "2021-10-01", end: "2021-10-03", value: () => 0.4 }),
};

function manifestFor(f: Record<string, string>): SnapshotManifest {
  const doc = (id: string, file: string, start: string, end: string) => ({
    id,
    file,
    url: `https://archive-api.open-meteo.com/v1/archive?latitude=4.88&longitude=38.08&start_date=${start}&end_date=${end}&daily=precipitation_sum&timezone=Africa%2FAddis_Ababa&models=era5`,
    request: { latitude: 4.88, longitude: 38.08, start, end, timezone: "Africa/Addis_Ababa" },
    retrievedAt: "2026-10-19T08:00:00.000Z",
    bytes: stringToBytes(f[file]!).length,
    sha256: sha256(stringToBytes(f[file]!)),
  });
  return {
    schema: "rilva.snapshot-manifest.v1",
    provider: "open-meteo",
    model: "era5",
    variable: "precipitation_sum",
    attribution: "SYNTHETIC",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    documents: [doc("base", "base.json", "1991-01-01", "1992-12-31"), doc("obs", "obs.json", "2021-10-01", "2021-10-03")],
  };
}

const reader =
  (f: Record<string, string>): ReadSnapshotFile =>
  async (file) => {
    const s = f[file];
    if (s === undefined) throw new Error(`no such file ${file}`);
    return stringToBytes(s);
  };

const requests = [
  { latitude: 4.88, longitude: 38.08, start: "1991-01-01", end: "1992-12-31", timezone: "Africa/Addis_Ababa" },
  { latitude: 4.88, longitude: 38.08, start: "2021-10-01", end: "2021-10-03", timezone: "Africa/Addis_Ababa" },
];

describe("loadSnapshotDocuments", () => {
  it("loads documents whose bytes match the manifest", async () => {
    const docs = await loadSnapshotDocuments(manifestFor(files), requests, reader(files));
    expect(docs.map((d) => d.id)).toEqual(["base", "obs"]);
  });

  it("detects a single tampered byte", async () => {
    const m = manifestFor(files);
    const tampered = { ...files, "obs.json": files["obs.json"]!.replace("0.40", "0.50") };
    await expect(loadSnapshotDocuments(m, requests, reader(tampered))).rejects.toThrow(/SNAPSHOT_INTEGRITY.*obs/);
  });

  it("fails when no snapshot covers a request", async () => {
    const m = manifestFor(files);
    m.documents = m.documents.filter((d) => d.id !== "obs");
    await expect(loadSnapshotDocuments(m, requests, reader(files))).rejects.toThrow(/SNAPSHOT_MISSING.*2021-10-01/);
  });

  it("rejects a manifest that is not pinned to era5", async () => {
    const m = { ...manifestFor(files), model: "best_match" } as unknown as SnapshotManifest;
    await expect(loadSnapshotDocuments(m, requests, reader(files))).rejects.toThrow(/SNAPSHOT_INTEGRITY.*era5/);
  });
});

describe("getClimateEvidence provenance", () => {
  const deps = { manifest: manifestFor(files), readSnapshotFile: reader(files) };

  it("labels snapshot-sourced evidence as snapshot with retrieval metadata", async () => {
    const r = await getClimateEvidence(spec, { mode: "snapshot", ...deps });
    expect(r.provenance.mode).toBe("snapshot");
    expect(r.provenance.fellBackFromLive).toBe(false);
    expect(r.provenance.documents.every((d) => d.retrievedAt === "2026-10-19T08:00:00.000Z")).toBe(true);
    expect(r.integrity).toMatchObject({ snapshotHashesVerified: true, digestRecomputed: true });
    expect(r.artifact.core.result.indexBps).toBe(4000); // SYNTHETIC: 0.4 mm/day vs 1.0 mm/day
  });

  it("labels live evidence as live", async () => {
    const fetchImpl = vi.fn<FetchLike>(async (url) => {
      const s = String(url);
      const body = s.includes("1991-01-01") ? files["base.json"]! : files["obs.json"]!;
      return new Response(body.replace('"generationtime_ms":0.5', '"generationtime_ms":9.9'), { status: 200 });
    });
    const live = await getClimateEvidence(spec, { mode: "live", fetchImpl, sleep: async () => {} });
    expect(live.provenance.mode).toBe("live");
    expect(live.integrity.snapshotHashesVerified).toBe(false);
    const snap = await getClimateEvidence(spec, { mode: "snapshot", ...deps });
    // Different raw bytes, same normalised evidence.
    expect(live.provenance.documents[0]!.sha256).not.toBe(snap.provenance.documents[0]!.sha256);
    expect(live.artifact.evidenceDigest).toBe(snap.artifact.evidenceDigest);
  });

  it("falls back to the snapshot explicitly when live retrieval fails", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError("getaddrinfo ENOTFOUND");
    });
    const r = await getClimateEvidence(spec, { mode: "live-with-snapshot-fallback", fetchImpl, sleep: async () => {}, retries: 0, ...deps });
    expect(r.provenance.mode).toBe("snapshot");
    expect(r.provenance.fellBackFromLive).toBe(true);
    expect(r.provenance.liveError).toMatch(/NETWORK_ERROR/);
  });

  it("never falls back silently in live mode", async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError("offline");
    });
    await expect(getClimateEvidence(spec, { mode: "live", fetchImpl, sleep: async () => {}, retries: 0, ...deps })).rejects.toThrow(/NETWORK_ERROR/);
  });
});
