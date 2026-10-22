"use client";

import { useEffect, useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { CHAIN } from "@/lib/app/appConfig";
import { truncateMiddle } from "./HashField";

/**
 * Wallet states (DESIGN.md §6): no wallet installed · disconnected · connecting · wrong network
 * (one-click switch) · connected. Only needed for transactions; reading never requires a wallet.
 */
export function WalletControl({ tone = "art" }: { tone?: "art" | "paper" }) {
  const connection = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: wallet state only exists in the browser
  useEffect(() => setMounted(true), []);

  const primary = tone === "art" ? "btn-sheet" : "btn-ink";
  const secondary = tone === "art" ? "btn-ghost ring-1 ring-white/50" : "btn-outline";

  if (!mounted) return <span className={`btn btn-sm ${primary} opacity-60`} aria-hidden="true">Wallet</span>;

  const injectedConnector = connectors[0];
  const hasProvider = typeof window !== "undefined" && "ethereum" in window;

  if (connection.status === "connected") {
    const wrong = connection.chainId !== CHAIN.chain.id;
    if (wrong) {
      return (
        <button
          type="button"
          className="btn btn-sm btn-butter"
          onClick={() => switchChain.mutate({ chainId: CHAIN.chain.id })}
          disabled={switchChain.isPending}
        >
          {switchChain.isPending ? "Switching…" : `Switch to ${CHAIN.chain.name}`}
        </button>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <span className={`btn btn-sm ${primary} cursor-default font-mono`} title={connection.address}>
          <span className="inline-block size-2 rounded-full bg-[#3aa76d]" aria-hidden="true" />
          {truncateMiddle(connection.address, 6, 4)}
        </span>
        <button type="button" className={`btn btn-sm ${secondary}`} onClick={() => disconnect.mutate()}>
          Disconnect
        </button>
      </div>
    );
  }

  if (!hasProvider || !injectedConnector) {
    return (
      <a className={`btn btn-sm ${secondary}`} href="https://ethereum.org/en/wallets/find-wallet/" target="_blank" rel="noreferrer" title="Only needed to create, sign or settle">
        No wallet found ↗
      </a>
    );
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${primary}`}
      disabled={connect.isPending || connection.status === "connecting" || connection.status === "reconnecting"}
      onClick={() => connect.mutate({ connector: injectedConnector })}
    >
      {connect.isPending || connection.status === "connecting" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

export function NetworkBadge({ tone = "art" }: { tone?: "art" | "paper" }) {
  return (
    <span
      className={`chip ${tone === "art" ? "bg-white/15 text-white ring-1 ring-white/35" : CHAIN.isLocal ? "bg-warn-soft text-warn" : "bg-paper-deep text-ink-2"}`}
      title={CHAIN.isLocal ? "Development chain on this computer. Nothing here exists on a public network." : "Public test network. Testnet ETH has no value."}
    >
      {CHAIN.label}
    </span>
  );
}
