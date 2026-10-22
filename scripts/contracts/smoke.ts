/**
 * Read-only post-deployment smoke test. Holds no keys and sends nothing.
 *
 *   pnpm contracts:smoke:base-sepolia   # also writes deployments/base-sepolia.json when every check passes
 *   pnpm chain:smoke:local
 *
 * Takes the address and deployment transaction from the Ignition journal, then checks them against the
 * chain itself: RPC chain id, a successful receipt that created exactly that address, runtime code equal
 * to the compiled artifact (immutables masked), the EIP-712 domain, and campaignCount().
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, http, isAddressEqual, keccak256, type Address, type Hex } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { checkEscrowDeployment } from "../../lib/app/escrowHealth";
import { RILVA_ESCROW_ABI } from "../../lib/contracts";
import { runtimeCodeMatches, type ImmutableReferences } from "../../lib/contracts/bytecode";

const target = process.argv[2];
const NETWORKS = {
  "base-sepolia": { chain: baseSepolia, rpc: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", explorer: "https://sepolia.basescan.org" },
  local: { chain: hardhat, rpc: "http://127.0.0.1:8545", explorer: null },
} as const;
if (target !== "base-sepolia" && target !== "local") throw new Error('usage: smoke.ts base-sepolia|local');
const net = NETWORKS[target];
const FUTURE = "RilvaEscrowModule#RilvaEscrow";
const dir = path.join("ignition", "deployments", `chain-${net.chain.id}`);

const addresses = JSON.parse(await readFile(path.join(dir, "deployed_addresses.json"), "utf8")) as Record<string, Address>;
const address = addresses[FUTURE];
if (!address) throw new Error(`${FUTURE} is not in ${dir}/deployed_addresses.json`);
const journal = (await readFile(path.join(dir, "journal.jsonl"), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
const confirm = journal.find((e) => e.type === "TRANSACTION_CONFIRM" && e.futureId === FUTURE) as { hash: Hex } | undefined;
if (!confirm) throw new Error("no confirmed deployment transaction in the Ignition journal");

const artifact = JSON.parse(await readFile(path.join("artifacts", "contracts", "RilvaEscrow.sol", "RilvaEscrow.json"), "utf8")) as {
  deployedBytecode: Hex;
  immutableReferences: ImmutableReferences;
  buildInfoId: string;
};

const client = createPublicClient({ chain: net.chain, transport: http(net.rpc, { retryCount: 3, timeout: 20_000 }) });
const results: Array<[string, boolean, string]> = [];
const check = (name: string, ok: boolean, detail: string) => results.push([name, ok, detail]);

const chainId = await client.getChainId();
check("RPC chain id", chainId === net.chain.id, `${chainId}`);
const receipt = await client.getTransactionReceipt({ hash: confirm.hash });
check("Deployment receipt", receipt.status === "success", `${receipt.status} in block ${receipt.blockNumber}`);
check("Receipt created this address", !!receipt.contractAddress && isAddressEqual(receipt.contractAddress, address), `${receipt.contractAddress}`);
const code = await client.getCode({ address });
check("Runtime code = compiled artifact", runtimeCodeMatches(code, artifact.deployedBytecode, artifact.immutableReferences), `${code ? (code.length - 2) / 2 : 0} bytes`);
const health = await checkEscrowDeployment(client, { address, chainId: net.chain.id });
check("EIP-712 domain RilvaEscrow v1", health.ok, health.ok ? "(\"RilvaEscrow\", \"1\", chain, address)" : health.detail);
const count = await client.readContract({ address, abi: RILVA_ESCROW_ABI, functionName: "campaignCount" });
check("campaignCount() readable", true, count.toString());

console.log(`\nRilvaEscrow smoke test · ${target} · ${address}\n`);
for (const [name, ok, detail] of results) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(34)} ${detail}`);
const allOk = results.every(([, ok]) => ok);
console.log(`\n  ${allOk ? "ALL SMOKE CHECKS PASSED" : "SMOKE CHECKS FAILED"}\n`);

if (allOk && target === "base-sepolia") {
  const record = {
    network: "base-sepolia",
    chainId: net.chain.id,
    contract: "RilvaEscrow",
    address,
    deployTxHash: confirm.hash,
    deployBlock: receipt.blockNumber.toString(),
    deployer: receipt.from,
    compiler: "solc 0.8.37 (optimizer off, evmVersion cancun)",
    buildInfoId: artifact.buildInfoId,
    runtimeCodeKeccak256: code ? keccak256(code) : null,
    explorer: { contract: `${net.explorer}/address/${address}`, deployTx: `${net.explorer}/tx/${confirm.hash}` },
    smokeCheckedAt: new Date().toISOString(),
  };
  await mkdir("deployments", { recursive: true });
  await writeFile(path.join("deployments", "base-sepolia.json"), `${JSON.stringify(record, null, 2)}\n`);
  console.log("  Wrote deployments/base-sepolia.json\n");
}
if (!allOk) process.exitCode = 1;
