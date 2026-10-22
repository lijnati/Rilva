/**
 * Turns a viem / wallet error into the contract's custom error name and a plain-language reason
 * (decodeRilvaError). Used for simulations, writes and the "Try to break it" panel.
 */
import { BaseError, ContractFunctionRevertedError } from "viem";
import { decodeRilvaError } from "../contracts";

export interface RevertInfo {
  name: string;
  reason: string;
}

function isUserRejection(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 8 && cur; i++) {
    const x = cur as { code?: number; name?: string; cause?: unknown };
    if (x.code === 4001 || x.name === "UserRejectedRequestError") return true;
    cur = x.cause;
  }
  return false;
}

function isWrongNetwork(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 8 && cur; i++) {
    const name = (cur as { name?: string }).name;
    if (name === "ChainMismatchError" || name === "WrongNetworkError") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

export function describeRevert(e: unknown): RevertInfo {
  if (isWrongNetwork(e)) return { name: "WrongNetwork", reason: "Your wallet is on a different network. Switch networks and try again. Nothing was sent." };
  if (isUserRejection(e)) return { name: "UserRejected", reason: "You rejected the request in your wallet. Nothing was sent." };
  if (e instanceof BaseError) {
    const reverted = e instanceof ContractFunctionRevertedError ? e : e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      const name = reverted.data.errorName;
      return { name, reason: decodeRilvaError({ errorName: name }) };
    }
    return { name: e.name, reason: e.shortMessage || e.message };
  }
  if (e instanceof Error) return { name: e.name, reason: e.message.split("\n")[0] ?? e.message };
  return { name: "Error", reason: String(e) };
}
