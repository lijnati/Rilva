/**
 * Every wallet action names the chain it is meant for. wagmi's writeContract only asserts the
 * wallet's chain when `chainId` is passed (otherwise it sends with assertChainId: false), and
 * signTypedData has no chain check at all — so the UI's "switch network" gating is never the only guard.
 */
export class WrongNetworkError extends Error {
  override name = "WrongNetworkError";
  constructor(readonly walletChainId: number | undefined, readonly expectedChainId: number) {
    super(`Wallet is on chain ${walletChainId ?? "unknown"}, expected ${expectedChainId}.`);
  }
}

export function pinChain<T extends object>(request: T, chainId: number): T & { chainId: number } {
  return { ...request, chainId };
}

export function assertWalletChain(walletChainId: number | undefined, expectedChainId: number): void {
  if (walletChainId !== expectedChainId) throw new WrongNetworkError(walletChainId, expectedChainId);
}
