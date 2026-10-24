/**
 * Node-only adapters for reading committed snapshots from disk (scripts, tests, server components).
 * Not importable from client components.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SnapshotSlug } from "./scenarios";
import type { ReadSnapshotFile, SnapshotManifest } from "./snapshots";

export const SNAPSHOT_ROOT = path.join(process.cwd(), "public", "snapshots", "open-meteo", "era5");
/** The original Yabelo folder; every Yabelo caller keeps using it unchanged. */
export const SNAPSHOT_DIR = path.join(SNAPSHOT_ROOT, "yabelo");
export const EVIDENCE_DIR = path.join(process.cwd(), "public", "evidence");

export function snapshotDirFor(slug: SnapshotSlug): string {
  return path.join(SNAPSHOT_ROOT, slug);
}

/** A file reader confined to one location's snapshot folder. */
export function snapshotReaderFor(slug: SnapshotSlug): ReadSnapshotFile {
  const dir = snapshotDirFor(slug);
  return async (file) => {
    const resolved = path.resolve(dir, file);
    if (!resolved.startsWith(dir + path.sep)) throw new Error(`snapshot path escapes directory: ${file}`);
    return new Uint8Array(await readFile(resolved));
  };
}

export async function readManifestFromDiskFor(slug: SnapshotSlug): Promise<SnapshotManifest> {
  return JSON.parse(await readFile(path.join(snapshotDirFor(slug), "manifest.json"), "utf8")) as SnapshotManifest;
}

export const readSnapshotFileFromDisk: ReadSnapshotFile = snapshotReaderFor("yabelo");

export async function readManifestFromDisk(): Promise<SnapshotManifest> {
  return readManifestFromDiskFor("yabelo");
}
