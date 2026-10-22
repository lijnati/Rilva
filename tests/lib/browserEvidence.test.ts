/**
 * Browser evidence loading: the same getClimateEvidence pipeline, fed by HTTP fetches of the committed
 * snapshots (served from /public) and, for live mode, Open-Meteo. A fake fetch serves files from disk.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBrowserEvidence, SNAPSHOT_BASE_PATH } from "@/lib/app/browserEvidence";
import { deficitVsNormal } from "@/lib/app/explorerSeries";
import { SCENARIOS } from "@/lib/climate";

const PUBLIC = path.join(process.cwd(), "public");

function diskFetch(opts: { liveFails?: boolean; tamper?: boolean } = {}) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    if (url.startsWith("https://archive-api.open-meteo.com/")) {
      if (opts.liveFails) throw new TypeError("Failed to fetch");
      throw new Error("unexpected live call");
    }
    if (!url.startsWith(SNAPSHOT_BASE_PATH)) return new Response("not found", { status: 404 });
    let bytes = new Uint8Array(await readFile(path.join(PUBLIC, decodeURIComponent(url))));
    if (opts.tamper && url.endsWith("2021-10-01_2021-12-31.json")) {
      bytes = new Uint8Array(bytes);
      bytes[bytes.length - 2] = bytes[bytes.length - 2]! ^ 1;
    }
    return new Response(bytes, { status: 200 });
  };
  return { impl, calls };
}

describe("loadBrowserEvidence", () => {
  it("snapshot mode reproduces OND 2021 = 3363 bps with verified snapshot hashes", async () => {
    const { impl } = diskFetch();
    const r = await loadBrowserEvidence(SCENARIOS["yabelo-ond-2021"].spec, { mode: "snapshot", fetchImpl: impl });
    expect(r.artifact.core.result.indexBps).toBe(3363);
    expect(r.provenance.mode).toBe("snapshot");
    expect(r.integrity.snapshotHashesVerified).toBe(true);
  });

  it("live mode falls back to the saved snapshot when Open-Meteo is unreachable, and says so", async () => {
    const { impl, calls } = diskFetch({ liveFails: true });
    const r = await loadBrowserEvidence(SCENARIOS["yabelo-ond-2023"].spec, {
      mode: "live-with-snapshot-fallback",
      fetchImpl: impl,
      retries: 0,
    });
    const live = calls.filter((u) => u.startsWith("https://archive-api.open-meteo.com/"));
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((u) => u.includes("models=era5") && !u.includes("best_match"))).toBe(true);
    expect(r.provenance.mode).toBe("snapshot");
    expect(r.provenance.fellBackFromLive).toBe(true);
    expect(r.provenance.liveError).toBeTruthy();
    expect(r.artifact.core.result.indexBps).toBe(21322);
  });

  it("a tampered snapshot file is rejected, never silently used", async () => {
    const { impl } = diskFetch({ tamper: true });
    await expect(loadBrowserEvidence(SCENARIOS["yabelo-ond-2021"].spec, { mode: "snapshot", fetchImpl: impl })).rejects.toThrow(
      /manifest hash/,
    );
  });
});

describe("deficitVsNormal", () => {
  it("OND 2021: 155.3 mm below the 1991–2020 mean", () => {
    expect(deficitVsNormal(787, 70193, 30)).toEqual({ kind: "deficit", dmm: 1553 });
  });
  it("OND 2023: 264.9 mm above the mean", () => {
    expect(deficitVsNormal(4989, 70193, 30)).toEqual({ kind: "surplus", dmm: 2649 });
  });
  it("exactly normal", () => {
    expect(deficitVsNormal(100, 3000, 30)).toEqual({ kind: "normal", dmm: 0 });
  });
});
