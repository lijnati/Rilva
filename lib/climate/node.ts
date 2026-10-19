/**
 * Node-only adapters for reading committed snapshots from disk (scripts, tests, server components).
 * Not importable from client components.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SnapshotManifest } from "./snapshots";

export const SNAPSHOT_DIR = path.join(process.cwd(), "public", "snapshots", "open-meteo", "era5", "yabelo");
export const EVIDENCE_DIR = path.join(process.cwd(), "public", "evidence");

export async function readSnapshotFileFromDisk(file: string): Promise<Uint8Array> {
  const resolved = path.resolve(SNAPSHOT_DIR, file);
  if (!resolved.startsWith(SNAPSHOT_DIR + path.sep)) throw new Error(`snapshot path escapes directory: ${file}`);
  return new Uint8Array(await readFile(resolved));
}

export async function readManifestFromDisk(): Promise<SnapshotManifest> {
  const raw = await readFile(path.join(SNAPSHOT_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw) as SnapshotManifest;
}
