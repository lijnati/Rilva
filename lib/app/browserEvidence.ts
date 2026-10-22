/**
 * Runs the Phase 1 evidence pipeline in the browser. Saved snapshots are fetched from /public and
 * still SHA-256-checked against the manifest; live mode calls Open-Meteo directly (CORS verified,
 * CLIMATE_DATA.md §2.1) with models=era5 pinned by planRequests/buildArchiveUrl.
 */
import { getClimateEvidence, type ClimateEvidenceResult, type EvidenceMode } from "../climate";
import type { FetchLike, FetchOptions } from "../climate/source";
import type { SnapshotManifest } from "../climate/snapshots";
import type { ClimateSpec } from "../climate/types";

export const SNAPSHOT_BASE_PATH = "/snapshots/open-meteo/era5/yabelo/";

export interface BrowserEvidenceOptions extends Omit<FetchOptions, "fetchImpl"> {
  mode: EvidenceMode;
  fetchImpl?: FetchLike;
}

async function getBytes(fetchImpl: FetchLike, url: string): Promise<Uint8Array> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function loadBrowserEvidence(spec: ClimateSpec, opts: BrowserEvidenceOptions): Promise<ClimateEvidenceResult> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const manifestBytes = await getBytes(fetchImpl, `${SNAPSHOT_BASE_PATH}manifest.json`);
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as SnapshotManifest;
  return getClimateEvidence(spec, {
    ...opts,
    fetchImpl,
    manifest,
    readSnapshotFile: (file) => getBytes(fetchImpl, `${SNAPSHOT_BASE_PATH}${encodeURIComponent(file)}`),
  });
}
