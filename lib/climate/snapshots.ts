/**
 * Saved snapshots of genuine Open-Meteo responses (public/snapshots/...). Each file holds the exact
 * bytes received; manifest.json records the request, retrieval time, byte length and SHA-256.
 * Snapshot data is always labelled as such — it is never presented as a live reading.
 */
import { sha256, type Hex } from "viem";
import { buildArchiveUrl, type ArchiveRequest } from "./source";
import { ClimateError } from "./types";

export const SNAPSHOT_MANIFEST_SCHEMA = "rilva.snapshot-manifest.v1" as const;

export interface SnapshotDocument {
  id: string;
  /** Path relative to the snapshot directory. */
  file: string;
  url: string;
  request: ArchiveRequest;
  retrievedAt: string;
  bytes: number;
  sha256: Hex;
}

export interface SnapshotManifest {
  schema: typeof SNAPSHOT_MANIFEST_SCHEMA;
  provider: "open-meteo";
  model: "era5";
  variable: "precipitation_sum";
  attribution: string;
  license: string;
  licenseUrl: string;
  documents: SnapshotDocument[];
}

export type ReadSnapshotFile = (file: string) => Promise<Uint8Array>;

export interface LoadedSnapshot {
  id: string;
  url: string;
  retrievedAt: string;
  bytes: number;
  sha256: Hex;
  body: string;
}

function sameRequest(a: ArchiveRequest, b: ArchiveRequest): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude && a.start === b.start && a.end === b.end && a.timezone === b.timezone;
}

/** Loads and integrity-checks the snapshot documents covering each request, in request order. */
export async function loadSnapshotDocuments(
  manifest: SnapshotManifest,
  requests: ArchiveRequest[],
  read: ReadSnapshotFile,
): Promise<LoadedSnapshot[]> {
  if (manifest.schema !== SNAPSHOT_MANIFEST_SCHEMA || manifest.model !== "era5" || manifest.variable !== "precipitation_sum") {
    throw new ClimateError("SNAPSHOT_INTEGRITY", "manifest is not a rilva era5 precipitation_sum manifest");
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const out: LoadedSnapshot[] = [];
  for (const req of requests) {
    const doc = manifest.documents.find((d) => sameRequest(d.request, req));
    if (!doc) {
      throw new ClimateError("SNAPSHOT_MISSING", `no saved snapshot for ${req.start}..${req.end} at ${req.latitude},${req.longitude}`);
    }
    if (doc.url !== buildArchiveUrl(doc.request)) {
      throw new ClimateError("SNAPSHOT_INTEGRITY", `snapshot ${doc.id} URL does not match its pinned era5 request`);
    }
    let bytes: Uint8Array;
    try {
      bytes = await read(doc.file);
    } catch (e) {
      throw new ClimateError("SNAPSHOT_MISSING", `snapshot file ${doc.file} unreadable: ${e instanceof Error ? e.message : String(e)}`);
    }
    const digest = sha256(bytes);
    if (bytes.length !== doc.bytes || digest !== doc.sha256) {
      throw new ClimateError("SNAPSHOT_INTEGRITY", `snapshot ${doc.id} does not match its manifest hash`, {
        expected: doc.sha256,
        actual: digest,
      });
    }
    out.push({ id: doc.id, url: doc.url, retrievedAt: doc.retrievedAt, bytes: bytes.length, sha256: digest, body: decoder.decode(bytes) });
  }
  return out;
}
