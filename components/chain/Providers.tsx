"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { CHAIN } from "@/lib/app/appConfig";

/** One chain only (Base Sepolia, or the labelled local Hardhat node). Injected wallets only. */
const wagmiConfig = createConfig({
  chains: [CHAIN.chain],
  connectors: [injected()],
  // JSON-RPC batching (accepted by https://sepolia.base.org, checked 2026-10-22), bounded retries and a timeout.
  transports: { [CHAIN.chain.id]: http(CHAIN.rpcUrl, { batch: true, retryCount: 3, timeout: 15_000 }) },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
