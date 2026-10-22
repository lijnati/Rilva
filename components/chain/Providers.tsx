"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { CHAIN } from "@/lib/app/appConfig";

/** One chain only (Base Sepolia, or the labelled local Hardhat node). Injected wallets only. */
const wagmiConfig = createConfig({
  chains: [CHAIN.chain],
  connectors: [injected()],
  transports: { [CHAIN.chain.id]: http(CHAIN.rpcUrl) },
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
