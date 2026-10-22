/**
 * Read-only deployment preflight. Shows what a deployment WOULD do and sends nothing:
 *
 *   pnpm contracts:preflight:base-sepolia   # hardhat run … --network baseSepolia
 *   pnpm chain:preflight:local              # against the local Hardhat node
 *
 * Prints the network, the chain id reported by the RPC, the deployer address and balance, the artifact
 * identity, and a gas/cost estimate. Never prints a private key or the full RPC URL (it may embed an API
 * key). Refuses any chain other than Base Sepolia (84532) or the local Hardhat node (31337).
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { network } from "hardhat";
import { formatEther, formatGwei, keccak256, type Hex } from "viem";

const ALLOWED: Record<number, string> = { 84532: "Base Sepolia (testnet)", 31337: "local Hardhat node" };

const connection = await network.connect();
const publicClient = await connection.viem.getPublicClient();
const chainId = await publicClient.getChainId();
if (!(chainId in ALLOWED)) {
  throw new Error(`refusing: the RPC reports chain ${chainId}. Only Base Sepolia (84532) or a local node (31337) are allowed. Never mainnet.`);
}
const [deployer] = await connection.viem.getWalletClients();
if (!deployer) throw new Error("no deployer account: set BASE_SEPOLIA_PRIVATE_KEY in the Hardhat keystore (see DEPLOYMENT.md)");

const artifact = JSON.parse(await readFile(path.join("artifacts", "contracts", "RilvaEscrow.sol", "RilvaEscrow.json"), "utf8")) as {
  sourceName: string;
  bytecode: Hex;
  deployedBytecode: Hex;
  buildInfoId: string;
};

const address = deployer.account.address;
const balance = await publicClient.getBalance({ address });
const gas = await publicClient.estimateGas({ account: address, data: artifact.bytecode });
const fees = await publicClient.estimateFeesPerGas();
const maxCost = gas * fees.maxFeePerGas;
const transport = publicClient.transport as { url?: string };
const rpcHost = transport.url ? new URL(transport.url).host : "(in-process)";
const journal = path.join("ignition", "deployments", `chain-${chainId}`, "deployed_addresses.json");

const rows: Array<[string, string]> = [
  ["Hardhat network", connection.networkName],
  ["Chain (from RPC)", `${chainId} · ${ALLOWED[chainId]}`],
  ["RPC host", rpcHost],
  ["Deployer", address],
  ["Deployer balance", `${formatEther(balance)} ETH`],
  ["Artifact", `${artifact.sourceName}:RilvaEscrow · ${artifact.buildInfoId}`],
  ["Creation code keccak256", keccak256(artifact.bytecode)],
  ["Runtime size", `${(artifact.deployedBytecode.length - 2) / 2} bytes`],
  ["Estimated gas", gas.toString()],
  ["Max fee per gas", `${formatGwei(fees.maxFeePerGas)} gwei`],
  ["Worst-case cost", `${formatEther(maxCost)} ETH`],
  ["Existing Ignition record", existsSync(journal) ? `${journal} (Ignition will reuse it, not redeploy)` : "none"],
];
const width = Math.max(...rows.map(([k]) => k.length));
console.log("\nRilvaEscrow deployment preflight (read-only, nothing sent)\n");
for (const [k, v] of rows) console.log(`  ${k.padEnd(width)}  ${v}`);
const enough = balance > maxCost;
console.log(`\n  ${enough ? "OK" : "INSUFFICIENT FUNDS"}: balance ${enough ? "covers" : "does not cover"} the worst-case deployment cost.\n`);
if (!enough) process.exitCode = 1;
