"use client";

import { useState } from "react";
import { loadBrowserEvidence } from "@/lib/app/browserEvidence";
import { formatBpsAsPercent, type ClimateSpec } from "@/lib/climate";
import { truncateMiddle } from "@/components/chain/HashField";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; mode: "live" | "snapshot"; fellBack: boolean; liveError?: string; indexBps: number; digest: string; match: boolean; retrievedAt?: string }
  | { kind: "error"; message: string };

/**
 * Re-runs SRPN-v1 in this browser: live Open-Meteo first (models=era5), falling back to the committed
 * snapshot with a visible notice. Compares the recomputed evidence digest with the saved one.
 */
export function LiveRecompute({ spec, expectedDigest }: { spec: ClimateSpec; expectedDigest: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    try {
      const r = await loadBrowserEvidence(spec, { mode: "live-with-snapshot-fallback", timeoutMs: 15_000, retries: 1 });
      setState({
        kind: "done",
        mode: r.provenance.mode,
        fellBack: r.provenance.fellBackFromLive,
        liveError: r.provenance.liveError,
        indexBps: r.artifact.core.result.indexBps,
        digest: r.artifact.evidenceDigest,
        match: r.artifact.evidenceDigest === expectedDigest,
        retrievedAt: r.provenance.documents.at(-1)?.retrievedAt,
      });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="rounded-[14px] bg-paper-deep/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold">Recompute in your browser</p>
          <p className="text-[12.5px] text-ink-2">Fetches ERA5 from Open-Meteo directly and rebuilds the evidence hash.</p>
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={run} disabled={state.kind === "running"}>
          {state.kind === "running" ? "Fetching 4 documents…" : state.kind === "idle" ? "Recompute" : "Run again"}
        </button>
      </div>
      <div aria-live="polite" className="text-[12.5px] leading-5">
        {state.kind === "done" && (
          <div className="mt-3 grid gap-1.5 border-t border-rule pt-3">
            <p>
              <span className="meta mr-2">{state.mode === "live" ? "Live response" : "Saved snapshot"}</span>
              {state.mode === "live"
                ? `Open-Meteo answered (${state.retrievedAt ? new Date(state.retrievedAt).toUTCString() : "now"}).`
                : state.fellBack
                  ? `Open-Meteo unreachable (${state.liveError ?? "network error"}). Used the committed snapshot instead.`
                  : "Committed snapshot."}
            </p>
            <p className="tnum">
              Index {formatBpsAsPercent(state.indexBps)} % · digest <code className="font-mono">{truncateMiddle(state.digest, 10, 8)}</code>
            </p>
            <p className={`flex items-center gap-1.5 font-semibold ${state.match ? "text-ok" : "text-fail"}`}>
              <span aria-hidden="true">{state.match ? "✓" : "✕"}</span>
              {state.match ? "Matches the saved evidence digest." : "Does not match the saved evidence digest."}
            </p>
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
