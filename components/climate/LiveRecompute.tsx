"use client";

import { useState } from "react";
import { checkUpstream, loadBrowserEvidence, type UpstreamCheck } from "@/lib/app/browserEvidence";
import { formatBpsAsPercent, type ClimateSpec } from "@/lib/climate";
import { truncateMiddle } from "@/components/chain/HashField";
import { UpstreamNote } from "./UpstreamNote";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; indexBps: number; digest: string; match: boolean; retrievedAt?: string; upstream?: UpstreamCheck }
  | { kind: "error"; message: string };

/**
 * Re-runs SRPN-v1 in this browser from the committed snapshot (SHA-256 checked) and compares the digest with
 * the saved evidence, then re-fetches Open-Meteo live (models=era5) and reports any upstream revision.
 */
export function LiveRecompute({ spec, expectedDigest }: { spec: ClimateSpec; expectedDigest: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    try {
      const r = await loadBrowserEvidence(spec, { mode: "snapshot" });
      const done = {
        kind: "done",
        indexBps: r.artifact.core.result.indexBps,
        digest: r.artifact.evidenceDigest,
        match: r.artifact.evidenceDigest === expectedDigest,
        retrievedAt: r.provenance.documents.at(-1)?.retrievedAt,
      } as const;
      setState(done);
      const upstream = await checkUpstream(spec, r, { timeoutMs: 15_000, retries: 1 });
      setState({ ...done, upstream });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="rounded-[14px] bg-paper-deep/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold">Recompute in your browser</p>
          <p className="text-[12.5px] text-ink-2">Rebuilds the evidence hash from the committed ERA5 snapshot, then re-fetches Open-Meteo live to compare.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={run} disabled={state.kind === "running"}>
          {state.kind === "running" ? "Recomputing…" : state.kind === "idle" ? "Recompute" : "Run again"}
        </button>
      </div>
      <div aria-live="polite" className="text-[12.5px] leading-5">
        {state.kind === "done" && (
          <div className="mt-3 grid gap-1.5 border-t border-rule pt-3">
            <p>
              <span className="meta mr-2">Pinned snapshot</span>
              Open-Meteo ERA5, retrieved {state.retrievedAt ? new Date(state.retrievedAt).toUTCString() : "—"}; every file SHA-256 checked.
            </p>
            <p className="tnum">
              Index {formatBpsAsPercent(state.indexBps)} % · digest <code className="font-mono">{truncateMiddle(state.digest, 10, 8)}</code>
            </p>
            <p className={`flex items-center gap-1.5 font-semibold ${state.match ? "text-ok" : "text-fail"}`}>
              <span aria-hidden="true">{state.match ? "✓" : "✕"}</span>
              {state.match ? "Matches the saved evidence digest." : "Does not match the saved evidence digest."}
            </p>
            <UpstreamNote check={state.upstream} pending={!state.upstream} />
          </div>
        )}
        {state.kind === "error" && (
          <p className="mt-3 border-t border-rule pt-3 font-medium text-fail">
            <span aria-hidden="true">✕ </span>Evidence INVALID — {state.message}. No numbers are shown from an invalid run.
          </p>
        )}
      </div>
    </div>
  );
}
