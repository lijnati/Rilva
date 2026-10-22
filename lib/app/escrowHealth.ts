/**
 * Is the configured address really RilvaEscrow v1 on the configured chain? Checked before any write
 * is offered: RPC chain id, deployed bytecode, and the EIP-712 domain (EIP-5267), which binds name,
 * version, chain id and the contract's own address. Read-only; no wallet involved.
 */
import { isAddressEqual, type Address, type PublicClient } from "viem";
import { EIP712_DOMAIN_NAME, EIP712_DOMAIN_VERSION, RILVA_ESCROW_ABI } from "../contracts";

export type EscrowProbe = Pick<PublicClient, "getChainId" | "getCode" | "readContract">;

export type EscrowProblem = "no-address" | "rpc-error" | "wrong-chain" | "no-code" | "wrong-contract";
export type EscrowHealth = { ok: true } | { ok: false; problem: EscrowProblem; detail: string };

export async function checkEscrowDeployment(client: EscrowProbe, cfg: { address: Address | null; chainId: number }): Promise<EscrowHealth> {
  if (!cfg.address) return { ok: false, problem: "no-address", detail: "NEXT_PUBLIC_RILVA_ESCROW_ADDRESS is not set." };
  let rpcChainId: number;
  let code: string | undefined;
  try {
    rpcChainId = await client.getChainId();
    code = await client.getCode({ address: cfg.address });
  } catch (e) {
    return { ok: false, problem: "rpc-error", detail: `The RPC did not answer: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}` };
  }
  if (rpcChainId !== cfg.chainId) {
    return { ok: false, problem: "wrong-chain", detail: `The RPC reports chain ${rpcChainId}; this build expects chain ${cfg.chainId}.` };
  }
  if (!code || code === "0x") {
    return { ok: false, problem: "no-code", detail: `No contract code at ${cfg.address} on chain ${cfg.chainId}.` };
  }
  try {
    const [, name, version, chainId, verifyingContract] = await client.readContract({ address: cfg.address, abi: RILVA_ESCROW_ABI, functionName: "eip712Domain" });
    const ok = name === EIP712_DOMAIN_NAME && version === EIP712_DOMAIN_VERSION && chainId === BigInt(cfg.chainId) && isAddressEqual(verifyingContract, cfg.address);
    if (ok) return { ok: true };
    return { ok: false, problem: "wrong-contract", detail: `The EIP-712 domain is ("${name}", "${version}", ${chainId}, ${verifyingContract}), not RilvaEscrow v1 at this address.` };
  } catch {
    return { ok: false, problem: "wrong-contract", detail: `The contract at ${cfg.address} does not expose RilvaEscrow's EIP-712 domain.` };
  }
}
