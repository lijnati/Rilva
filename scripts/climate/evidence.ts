/**
 * pnpm climate:evidence — regenerates public/evidence/<scenario>.json from the committed snapshots
 * (offline). The file contains the hashed core, its digest, and non-hashed provenance/presentation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getClimateEvidence } from "@/lib/climate";
import { EVIDENCE_DIR, readManifestFromDiskFor, snapshotReaderFor } from "@/lib/climate/node";
import { ALL_SCENARIOS, snapshotSlug, type AnyScenarioId } from "@/lib/climate/scenarios";
import { toEvidenceFile } from "./shared";

async function main() {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  for (const id of Object.keys(ALL_SCENARIOS) as AnyScenarioId[]) {
    const { spec } = ALL_SCENARIOS[id];
    const slug = snapshotSlug(spec);
    const r = await getClimateEvidence(spec, { mode: "snapshot", manifest: await readManifestFromDiskFor(slug), readSnapshotFile: snapshotReaderFor(slug) });
    const file = path.join(EVIDENCE_DIR, `${id}.json`);
    await writeFile(file, `${JSON.stringify(toEvidenceFile(id, r), null, 2)}\n`, "utf8");
    console.log(`${id}: ${r.artifact.evidenceDigest} → ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
