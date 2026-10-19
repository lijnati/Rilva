/**
 * Application-facing API: request SRPN-v1 evidence for a spec and get back the artifact,
 * its provenance (live vs saved snapshot) and the integrity checks that were performed.
 */
import { buildEvidence, verifyEvidenceArtifact, type EvidenceArtifact } from "./evidence";
import { assertValidSpec } from "./scenarios";
import { loadSnapshotDocuments, type ReadSnapshotFile, type SnapshotManifest } from "./snapshots";
import { fetchArchiveDocument, OPEN_METEO_ATTRIBUTION, planRequests, type FetchOptions } from "./source";
import { ClimateError, type ClimateSpec, type DailySeries, type SourceProvenance } from "./types";
import { mergeSeries, parseOpenMeteoDaily } from "./validate";

export type EvidenceMode = "live" | "snapshot" | "live-with-snapshot-fallback";

export interface GetEvidenceOptions extends FetchOptions {
  mode: EvidenceMode;
  manifest?: SnapshotManifest;
  readSnapshotFile?: ReadSnapshotFile;
}

export interface ClimateEvidenceResult {
  artifact: EvidenceArtifact;
  provenance: SourceProvenance;
  integrity: {
    /** Every snapshot file matched its manifest SHA-256 (false for live data: nothing to compare). */
    snapshotHashesVerified: boolean;
    /** The evidence digest was recomputed from the core and matched. */
    digestRecomputed: boolean;
    /** The stored result follows from the stored data and threshold. */
    coreConsistent: boolean;
  };
}

interface Retrieved {
  series: DailySeries;
  documents: SourceProvenance["documents"];
}

function parseDocs(spec: ClimateSpec, bodies: Array<{ body: string }>): DailySeries {
  const requests = planRequests(spec);
  const parts = bodies.map((d, i) => {
    let json: unknown;
    try {
      json = JSON.parse(d.body);
    } catch {
      throw new ClimateError("MALFORMED_RESPONSE", "document body is not JSON");
    }
    const r = requests[i]!;
    return parseOpenMeteoDaily(json, { start: r.start, end: r.end, timezone: r.timezone });
  });
  return mergeSeries(parts);
}

async function retrieveLive(spec: ClimateSpec, opts: FetchOptions): Promise<Retrieved> {
  const docs = [];
  for (const req of planRequests(spec)) docs.push(await fetchArchiveDocument(req, opts));
  return {
    series: parseDocs(spec, docs),
    documents: docs.map((d) => ({ id: `${d.request.start}_${d.request.end}`, url: d.url, retrievedAt: d.retrievedAt, sha256: d.sha256, bytes: d.bytes })),
  };
}

async function retrieveSnapshot(spec: ClimateSpec, opts: GetEvidenceOptions): Promise<Retrieved> {
  if (!opts.manifest || !opts.readSnapshotFile) {
    throw new ClimateError("SNAPSHOT_MISSING", "snapshot mode requires a manifest and a file reader");
  }
  const docs = await loadSnapshotDocuments(opts.manifest, planRequests(spec), opts.readSnapshotFile);
  return {
    series: parseDocs(spec, docs),
    documents: docs.map((d) => ({ id: d.id, url: d.url, retrievedAt: d.retrievedAt, sha256: d.sha256, bytes: d.bytes })),
  };
}

export async function getClimateEvidence(spec: ClimateSpec, opts: GetEvidenceOptions): Promise<ClimateEvidenceResult> {
  assertValidSpec(spec);

  let retrieved: Retrieved;
  let mode: SourceProvenance["mode"];
  let fellBackFromLive = false;
  let liveError: string | undefined;

  if (opts.mode === "snapshot") {
    retrieved = await retrieveSnapshot(spec, opts);
    mode = "snapshot";
  } else {
    try {
      retrieved = await retrieveLive(spec, opts);
      mode = "live";
    } catch (e) {
      if (opts.mode === "live") throw e;
      liveError = e instanceof Error ? e.message : String(e);
      retrieved = await retrieveSnapshot(spec, opts);
      mode = "snapshot";
      fellBackFromLive = true;
    }
  }

  const artifact = buildEvidence(spec, retrieved.series);
  const check = verifyEvidenceArtifact(artifact);

  return {
    artifact,
    provenance: {
      mode,
      fellBackFromLive,
      ...(liveError === undefined ? {} : { liveError }),
      documents: retrieved.documents,
      attribution: OPEN_METEO_ATTRIBUTION,
    },
    integrity: {
      snapshotHashesVerified: mode === "snapshot",
      digestRecomputed: check.ok,
      coreConsistent: check.ok,
    },
  };
}

export { buildEvidence, verifyEvidenceArtifact, evidenceDigest, specHash, canonicalSpec } from "./evidence";
export type { EvidenceArtifact, EvidenceCore } from "./evidence";
export { SCENARIOS, ILLUSTRATIVE_THRESHOLD_BPS, YABELO, isScenarioId, makeSeasonSpec } from "./scenarios";
export type { ScenarioId } from "./scenarios";
export { formatBpsAsPercent, formatDmmAsMm, baselineMeanDmmRounded, zScore } from "./srpn";
export { ClimateError } from "./types";
export type { ClimateSpec, SourceProvenance } from "./types";
