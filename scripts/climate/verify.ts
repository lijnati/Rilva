/**
 * pnpm climate:verify [scenario|all] [--live]
 *
 * Default: offline. Verifies every committed snapshot against manifest.json (SHA-256), recomputes
 * SRPN-v1 and the evidence digest from scratch, and compares with public/evidence/<scenario>.json.
 * --live additionally re-fetches from Open-Meteo and checks the live digest equals the snapshot digest.
 * Exit code 1 if any check fails.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getClimateEvidence, type ClimateEvidenceResult } from "@/lib/climate";
import { EVIDENCE_DIR, readManifestFromDiskFor, snapshotReaderFor } from "@/lib/climate/node";
import { ALL_SCENARIOS, isAnyScenarioId, SNAPSHOT_SLUGS, snapshotSlug, type AnyScenarioId } from "@/lib/climate/scenarios";
import { loadSnapshotDocuments } from "@/lib/climate/snapshots";
import { baselineMeanDmmRounded, formatBpsAsPercent, formatDmmAsMm } from "@/lib/climate/srpn";

const args = process.argv.slice(2);
const live = args.includes("--live");
const target = args.find((a) => !a.startsWith("--")) ?? "all";

function line(label: string, value: string) {
  console.log(`  ${label.padEnd(22)} ${value}`);
}

async function verifyScenario(id: AnyScenarioId): Promise<boolean> {
  const { spec, title } = ALL_SCENARIOS[id];
  const slug = snapshotSlug(spec);
  const manifest = await readManifestFromDiskFor(slug);
  const readSnapshotFileFromDisk = snapshotReaderFor(slug);
  const checks: Array<[string, boolean]> = [];

  let r: ClimateEvidenceResult;
  try {
    r = await getClimateEvidence(spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
  } catch (e) {
    console.log(`\n${id} — ${title}\n  FAILED: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
  const again = await getClimateEvidence(spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
  const c = r.artifact.core;
  const res = c.result;

  checks.push(["snapshot SHA-256 matches manifest", r.integrity.snapshotHashesVerified]);
  checks.push(["evidence digest recomputed", r.integrity.digestRecomputed]);
  checks.push(["result follows from data", r.integrity.coreConsistent]);
  checks.push(["deterministic (2 runs equal)", again.artifact.evidenceDigest === r.artifact.evidenceDigest]);
  checks.push(["no missing days", c.data.observedDailyDmm.length === c.periods.observed.days]);

  let committed = "not found (run pnpm climate:evidence)";
  try {
    const file = JSON.parse(await readFile(path.join(EVIDENCE_DIR, `${id}.json`), "utf8")) as { artifact: { evidenceDigest: string } };
    const match = file.artifact.evidenceDigest === r.artifact.evidenceDigest;
    committed = match ? "matches recomputed digest" : `MISMATCH (${file.artifact.evidenceDigest})`;
    checks.push(["committed evidence file matches", match]);
  } catch {
    checks.push(["committed evidence file present", false]);
  }

  let liveResult = "not requested (offline)";
  if (live) {
    try {
      const l = await getClimateEvidence(spec, { mode: "live", timeoutMs: 60_000, retries: 3 });
      const match = l.artifact.evidenceDigest === r.artifact.evidenceDigest;
      liveResult = match ? "live re-fetch reproduces digest" : `live digest differs: ${l.artifact.evidenceDigest}`;
      checks.push(["live digest equals snapshot digest", match]);
    } catch (e) {
      liveResult = `live unavailable: ${e instanceof Error ? e.message : String(e)}`;
      checks.push(["live re-fetch", false]);
    }
  }

  console.log(`\n${id} — ${title}`);
  line("Replay", spec.replay ? "RETROSPECTIVE REPLAY — not a live alert" : "no");
  line("Location", `${spec.location.label} (requested ${c.location.requested.latitude}, ${c.location.requested.longitude})`);
  line("Resolved grid cell", `${c.location.resolved.latitude}, ${c.location.resolved.longitude} · elevation ${c.location.resolved.elevation} m`);
  line("Observed period", `${c.periods.observed.start} → ${c.periods.observed.end} inclusive (${c.periods.observed.days} days)`);
  line("Baseline", `${c.periods.baseline.startYear}–${c.periods.baseline.endYear}, same season (${c.periods.baseline.years} seasons)`);
  line("Source / model", `Open-Meteo archive · models=${c.source.model} · ${c.source.variable} [${c.source.unit}] · tz ${c.source.timezone}`);
  line("Provenance", `SAVED SNAPSHOT (not a live reading) — retrieved ${r.provenance.documents.map((d) => d.retrievedAt).sort()[0] ?? "?"}`);
  for (const d of r.provenance.documents) line(`  snapshot ${d.id}`, `sha256 ${d.sha256}`);
  line("Seasonal rainfall", `${formatDmmAsMm(res.observedTotalDmm)} mm (T = ${res.observedTotalDmm} dmm)`);
  line("Baseline mean", `${formatDmmAsMm(baselineMeanDmmRounded(res.baselineSumDmm, res.baselineYears))} mm (S = ${res.baselineSumDmm} dmm, N = ${res.baselineYears})`);
  line("Percent of normal", `${formatBpsAsPercent(res.indexBps)} % (indexBps = ${res.indexBps})`);
  line("Deficit vs normal", `${formatBpsAsPercent(res.deficitBps)} pp (deficitBps = ${res.deficitBps}; negative = surplus)`);
  line("Threshold (illustrative)", `≤ ${formatBpsAsPercent(res.thresholdBps)} % (${res.thresholdBps} bps)`);
  line("Decision", res.triggered ? "TRIGGER — condition met" : "NO TRIGGER — condition not met");
  line("Spec hash", c.specHash);
  line("Series digest", c.data.seriesDigest);
  line("Evidence digest", r.artifact.evidenceDigest);
  line("Committed evidence", committed);
  line("Live check", liveResult);
  for (const [name, ok] of checks) line(ok ? "  PASS" : "  FAIL", name);
  return checks.every(([, ok]) => ok);
}

async function main() {
  // Verify every snapshot file in every location's manifest, not only those a scenario touches.
  for (const slug of SNAPSHOT_SLUGS) {
    const manifest = await readManifestFromDiskFor(slug);
    await loadSnapshotDocuments(
      manifest,
      manifest.documents.map((d) => d.request),
      snapshotReaderFor(slug),
    );
    console.log(`Snapshot set ${slug}: ${manifest.documents.length} files verified against manifest.json (SHA-256).`);
  }
  console.log((await readManifestFromDiskFor("yabelo")).attribution);

  const ids: AnyScenarioId[] =
    target === "all" ? (Object.keys(ALL_SCENARIOS) as AnyScenarioId[]) : isAnyScenarioId(target) ? [target] : [];
  if (ids.length === 0) {
    console.error(`unknown scenario "${target}". Use one of: all, ${Object.keys(ALL_SCENARIOS).join(", ")}`);
    process.exit(2);
  }
  let ok = true;
  for (const id of ids) ok = (await verifyScenario(id)) && ok;
  console.log(`\n${ok ? "ALL CHECKS PASSED" : "VERIFICATION FAILED"}`);
  console.log("Note: a matching digest proves integrity and reproducibility, not that the rainfall estimate is ground truth.");
  process.exit(ok ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
