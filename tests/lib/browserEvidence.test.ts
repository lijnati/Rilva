/**
 * Browser evidence loading: the same getClimateEvidence pipeline, fed by HTTP fetches of the committed
 * snapshots (served from /public) and, for live mode, Open-Meteo. A fake fetch serves files from disk.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkUpstream, loadBrowserEvidence, SNAPSHOT_BASE_PATH } from "@/lib/app/browserEvidence";
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

/** Serves the committed snapshot bytes for the matching live Open-Meteo URL, optionally revising one day. */
function liveFromSnapshots(revise?: { file: string; date: string; mm: number }) {
  return async (url: string) => {
    if (url.startsWith(SNAPSHOT_BASE_PATH)) return new Response(new Uint8Array(await readFile(path.join(PUBLIC, decodeURIComponent(url)))), { status: 200 });
    const manifest = JSON.parse(await readFile(path.join(PUBLIC, SNAPSHOT_BASE_PATH, "manifest.json"), "utf8")) as { documents: { url: string; file: string }[] };
    const doc = manifest.documents.find((d) => d.url === url);
    if (!doc) return new Response("not found", { status: 404 });
    const raw = await readFile(path.join(PUBLIC, SNAPSHOT_BASE_PATH, doc.file), "utf8");
    if (!revise || revise.file !== doc.file) return new Response(raw, { status: 200 });
    const json = JSON.parse(raw) as { daily: { time: string[]; precipitation_sum: number[] } };
    json.daily.precipitation_sum[json.daily.time.indexOf(revise.date)] = revise.mm;
    return new Response(JSON.stringify(json), { status: 200 });
  };
}

describe("checkUpstream (pinned snapshot vs a live re-fetch)", () => {
  const spec = SCENARIOS["yabelo-ond-2021"].spec;

  it("same: live bytes equal to the snapshot give the same digest", async () => {
    const impl = liveFromSnapshots();
    const pinned = await loadBrowserEvidence(spec, { mode: "snapshot", fetchImpl: impl });
    const u = await checkUpstream(spec, pinned, { fetchImpl: impl, retries: 0 });
    expect(u).toEqual({ kind: "same", indexBps: 3363, digest: pinned.artifact.evidenceDigest });
  });

  it("revised: a changed upstream day is reported with the live index, never used for the pinned result", async () => {
    // 2021-10-07 is 0.4 mm in the snapshot; set to 40.4 mm, T moves from 787 to 787 - 4 + 404 = 1187 dmm.
    const impl = liveFromSnapshots({ file: "2021-10-01_2021-12-31.json", date: "2021-10-07", mm: 40.4 });
    const pinned = await loadBrowserEvidence(spec, { mode: "snapshot", fetchImpl: impl });
    const u = await checkUpstream(spec, pinned, { fetchImpl: impl, retries: 0 });
    expect(u.kind).toBe("revised");
    if (u.kind !== "revised") return;
    expect(u.indexBps).toBe(Number((1187n * 10000n * 30n) / 70193n));
    expect(u.deltaBps).toBe(u.indexBps - 3363);
    expect(u.sameDecision).toBe(true);
    expect(u.digest).not.toBe(pinned.artifact.evidenceDigest);
    expect(pinned.artifact.core.result.indexBps).toBe(3363);
  });

  it("unreachable: a live failure is reported, not thrown", async () => {
    const { impl } = diskFetch({ liveFails: true });
    const pinned = await loadBrowserEvidence(spec, { mode: "snapshot", fetchImpl: impl });
    const u = await checkUpstream(spec, pinned, { fetchImpl: impl, retries: 0 });
    expect(u.kind).toBe("unreachable");
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
