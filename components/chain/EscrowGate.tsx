"use client";

import Link from "next/link";
import { EmptyState, NotConfigured, Skeleton } from "@/components/ui/States";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { useEscrowHealth } from "./useRilva";

/**
 * Renders chain-backed views only once the configured address is confirmed to be RilvaEscrow v1 on
 * the configured chain. Otherwise: a plain environment error, no write buttons, and a way back to the
 * climate pages (which never depend on the contract). Never substitutes a mock contract.
 */
export function EscrowGate({ children }: { children: React.ReactNode }) {
  const health = useEscrowHealth();
  if (!ESCROW.address) return <NotConfigured />;
  if (health.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Checking the contract">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36" />
      </div>
    );
  }
  if (health.error || !health.data.ok) {
    const rpcDown = health.data && !health.data.ok && health.data.problem === "rpc-error";
    return (
      <EmptyState
        title={rpcDown ? "Could not reach the chain" : "Contract configuration error"}
        tone={rpcDown ? "warn" : "error"}
        action={
          <>
            {rpcDown && (
              <button type="button" className="btn btn-sm btn-outline" onClick={() => health.refetch()}>
                Try again
              </button>
            )}
            <Link className="btn btn-sm btn-outline" href="/explore">
              Explore the climate data instead
            </Link>
          </>
        }
      >
        <p className="wrap-anywhere">{health.data && !health.data.ok ? health.data.detail : String(health.error)}</p>
        <p className="mt-1 wrap-anywhere text-[12.5px]">
          {CHAIN.label} · RPC {CHAIN.rpcUrl} · <code className="font-mono">{ESCROW.address}</code>
        </p>
        {!rpcDown && <p className="mt-1 text-[12.5px]">Transactions are disabled until this is fixed. Nothing on this page is simulated.</p>}
      </EmptyState>
    );
  }
  return <>{children}</>;
}
