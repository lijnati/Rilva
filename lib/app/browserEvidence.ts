/**
 * Runs the Phase 1 evidence pipeline in the browser. Saved snapshots are fetched from /public and
 * still SHA-256-checked against the manifest; live mode calls Open-Meteo directly (CORS verified,
 * CLIMATE_DATA.md §2.1) with models=era5 pinned by planRequests/buildArchiveUrl.
 */
import { getClimateEvidence, type ClimateEvidenceResult, type EvidenceMode } from "../climate";
import { snapshotSlug } from "../climate/scenarios";
import type { FetchLike, FetchOptions } from "../climate/source";
import type { SnapshotManifest } from "../climate/snapshots";
import type { ClimateSpec } from "../climate/types";

export const SNAPSHOT_BASE_PATH = "/snapshots/open-meteo/era5/yabelo/";

/** Each location's snapshots live in their own folder; Yabelo keeps SNAPSHOT_BASE_PATH. */
export function snapshotBasePath(spec: ClimateSpec): string {
  return `/snapshots/open-meteo/era5/${snapshotSlug(spec)}/`;
}

export interface BrowserEvidenceOptions extends Omit<FetchOptions, "fetchImpl"> {
  mode: EvidenceMode;
  fetchImpl?: FetchLike;
}

async function getBytes(fetchImpl: FetchLike, url: string): Promise<Uint8Array> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * The decision path is pinned to the committed snapshot: Open-Meteo revised its ERA5 archive after the
 * 2026-10-19 snapshot (CLIMATE_DATA.md §2.4), so a live re-fetch is reported next to it, never in place of it.
 */
export type UpstreamCheck =
  | { kind: "same"; indexBps: number; digest: string }
  | { kind: "revised"; indexBps: number; digest: string; deltaBps: number; sameDecision: boolean }
  | { kind: "unreachable"; error: string };

export async function checkUpstream(
  spec: ClimateSpec,
  pinned: ClimateEvidenceResult,
  opts: Omit<BrowserEvidenceOptions, "mode"> = {},
): Promise<UpstreamCheck> {
  try {
    const live = await loadBrowserEvidence(spec, { ...opts, mode: "live" });
    const indexBps = live.artifact.core.result.indexBps;
    const digest = live.artifact.evidenceDigest;
    if (digest === pinned.artifact.evidenceDigest) return { kind: "same", indexBps, digest };
    const pinnedResult = pinned.artifact.core.result;
    return {
      kind: "revised",
      indexBps,
      digest,
      deltaBps: indexBps - pinnedResult.indexBps,
      sameDecision: live.artifact.core.result.triggered === pinnedResult.triggered,
    };
  } catch (e) {
    return { kind: "unreachable", error: e instanceof Error ? e.message : String(e) };
  }
}

export async function loadBrowserEvidence(spec: ClimateSpec, opts: BrowserEvidenceOptions): Promise<ClimateEvidenceResult> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const base = snapshotBasePath(spec);
  const manifestBytes = await getBytes(fetchImpl, `${base}manifest.json`);
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as SnapshotManifest;
  return getClimateEvidence(spec, {
    ...opts,
    fetchImpl,
    manifest,
    readSnapshotFile: (file) => getBytes(fetchImpl, `${base}${encodeURIComponent(file)}`),
  });
}
