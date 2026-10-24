/**
 * pnpm climate:snapshot [--refresh] — saves genuine Open-Meteo ERA5 responses for every demo
 * scenario and reference case: the exact bytes plus a manifest (URL, retrievedAt, byte length,
 * SHA-256, attribution).
 *
 * Incremental by default: documents already in manifest.json whose bytes still match their hash
 * are kept untouched; only missing ones are fetched. --refresh re-downloads everything.
 * Network required for anything missing.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { snapshotDirFor, snapshotReaderFor } from "@/lib/climate/node";
import { ALL_SCENARIOS, REFERENCE_CASES, snapshotSlug, type SnapshotSlug } from "@/lib/climate/scenarios";
import {
  loadSnapshotDocuments,
  SNAPSHOT_MANIFEST_SCHEMA,
  type SnapshotDocument,
  type SnapshotManifest,
} from "@/lib/climate/snapshots";
import {
  fetchArchiveDocument,
  OPEN_METEO_ATTRIBUTION,
  OPEN_METEO_LICENSE_URL,
  planRequests,
  type ArchiveRequest,
} from "@/lib/climate/source";
import { parseOpenMeteoDaily } from "@/lib/climate/validate";

const refresh = process.argv.includes("--refresh");

async function readExisting(dir: string): Promise<SnapshotManifest | null> {
  try {
    return JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as SnapshotManifest;
  } catch {
    return null;
  }
}

async function main() {
  // One folder (and manifest) per location; document ids are dates, unique within a folder.
  const bySlug = new Map<SnapshotSlug, Map<string, ArchiveRequest>>();
  for (const s of [...Object.values(ALL_SCENARIOS), ...Object.values(REFERENCE_CASES)]) {
    const slug = snapshotSlug(s.spec);
    const unique = bySlug.get(slug) ?? new Map<string, ArchiveRequest>();
    for (const r of planRequests(s.spec)) unique.set(`${r.latitude},${r.longitude},${r.start},${r.end},${r.timezone}`, r);
    bySlug.set(slug, unique);
  }
  for (const [slug, unique] of bySlug) await snapshotLocation(slug, unique);
}

async function snapshotLocation(slug: SnapshotSlug, unique: Map<string, ArchiveRequest>) {
  const SNAPSHOT_DIR = snapshotDirFor(slug);
  const readSnapshotFileFromDisk = snapshotReaderFor(slug);
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const existing = refresh ? null : await readExisting(SNAPSHOT_DIR);
  const documents: SnapshotDocument[] = [];
  for (const req of unique.values()) {
    const id = `${req.start}_${req.end}`;
    if (existing) {
      try {
        await loadSnapshotDocuments(existing, [req], readSnapshotFileFromDisk);
        const kept = existing.documents.find((d) => d.id === id);
        if (kept) {
          documents.push(kept);
          console.log(`kept     ${id} (sha256 verified, retrieved ${kept.retrievedAt})`);
          continue;
        }
      } catch {
        // missing or failed integrity → fetch below
      }
    }
    process.stdout.write(`fetching ${id} … `);
    const doc = await fetchArchiveDocument(req, { timeoutMs: 60_000, retries: 5, backoffMs: 2_000 });
    // Refuse to save anything that would not validate.
    parseOpenMeteoDaily(JSON.parse(doc.body), { start: req.start, end: req.end, timezone: req.timezone });
    const file = `${id}.json`;
    await writeFile(path.join(SNAPSHOT_DIR, file), doc.body, "utf8");
    documents.push({ id, file, url: doc.url, request: req, retrievedAt: doc.retrievedAt, bytes: doc.bytes, sha256: doc.sha256 });
    console.log(`${doc.bytes} bytes sha256=${doc.sha256}`);
  }

  const manifest: SnapshotManifest = {
    schema: SNAPSHOT_MANIFEST_SCHEMA,
    provider: "open-meteo",
    model: "era5",
    variable: "precipitation_sum",
    attribution: OPEN_METEO_ATTRIBUTION,
    license: "CC BY 4.0",
    licenseUrl: OPEN_METEO_LICENSE_URL,
    documents,
  };
  await writeFile(path.join(SNAPSHOT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`manifest: ${documents.length} documents in ${path.relative(process.cwd(), SNAPSHOT_DIR)}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
