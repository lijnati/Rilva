/**
 * Seeds the LOCAL Hardhat node (chain 31337 only) with demo campaigns built exactly like the app builds
 * them: campaignTermsFromSpec() for terms, Phase 1 evidence from committed snapshots, buildAttestation()
 * and EIP-712 signing. The node's unlocked dev accounts sign over JSON-RPC — this script holds no keys.
 *
 *   pnpm chain:node            # terminal 1
 *   pnpm chain:deploy:local    # terminal 2
 *   pnpm chain:seed:local
 *
 * Refuses to run against any chain other than 31337. Never use it for Base Sepolia.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseEther, type Address, type Hex } from "viem";
import { hardhat } from "viem/chains";
import { getClimateEvidence } from "../../lib/climate";
import { readManifestFromDisk, readSnapshotFileFromDisk } from "../../lib/climate/node";
import { SCENARIOS, type ScenarioId } from "../../lib/climate/scenarios";
import {
  attestationTypedData,
  buildAttestation,
  campaignIdFromReceipt,
  campaignTermsFromSpec,
  prepareCreateCampaign,
  prepareSettle,
  rilvaDomain,
} from "../../lib/contracts";

const RPC = "http://127.0.0.1:8545";
const transport = http(RPC);
const publicClient = createPublicClient({ chain: hardhat, transport });

async function escrowAddress(): Promise<Address> {
  const file = path.join(process.cwd(), "ignition", "deployments", "chain-31337", "deployed_addresses.json");
  const json = JSON.parse(await readFile(file, "utf8")) as Record<string, Address>;
  const addr = json["RilvaEscrowModule#RilvaEscrow"];
  if (!addr) throw new Error("RilvaEscrow not found in the local Ignition deployment; run pnpm chain:deploy:local");
  return addr;
}

async function main() {
  const chainId = await publicClient.getChainId();
  if (chainId !== 31337) throw new Error(`refusing to seed chain ${chainId}: this script only targets the local Hardhat node (31337)`);

  const escrow = await escrowAddress();
  const accounts = await createWalletClient({ chain: hardhat, transport }).getAddresses(); // eth_accounts (node-held dev keys)
  if (accounts.length < 4) throw new Error("the local node exposes fewer than 4 dev accounts");
  const [funder, attestor, beneficiary, relayer] = accounts as [Address, Address, Address, Address];
  const wallet = (account: Address) => createWalletClient({ chain: hardhat, transport, account });
  const manifest = await readManifestFromDisk();
  const block = await publicClient.getBlock();

  async function create(id: ScenarioId, deadlineSeconds: bigint, amountEth: string): Promise<bigint> {
    const terms = campaignTermsFromSpec(SCENARIOS[id].spec);
    const call = prepareCreateCampaign({
      escrow,
      beneficiary,
      attestor,
      terms,
      settlementDeadline: (await publicClient.getBlock()).timestamp + deadlineSeconds,
      value: parseEther(amountEth),
    });
    const hash = await wallet(funder).writeContract(call);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const campaignId = campaignIdFromReceipt(receipt.logs);
    if (campaignId === null) throw new Error(`no CampaignCreated event in ${hash}`);
    return campaignId;
  }

  async function settle(id: ScenarioId, campaignId: bigint): Promise<Hex> {
    const r = await getClimateEvidence(SCENARIOS[id].spec, { mode: "snapshot", manifest, readSnapshotFile: readSnapshotFileFromDisk });
    const attestation = buildAttestation({ evidence: r.artifact, campaignId, expiresAt: (await publicClient.getBlock()).timestamp + 3600n });
    const typed = attestationTypedData(rilvaDomain(chainId, escrow), attestation);
    const signature = await wallet(attestor).signTypedData(typed);
    const hash = await wallet(relayer).writeContract(prepareSettle({ escrow, attestation, signature }));
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  const DAY = 86_400n;
  const a = await create("yabelo-ond-2021", 7n * DAY, "0.01");
  const aTx = await settle("yabelo-ond-2021", a);
  const b = await create("yabelo-ond-2023", 7n * DAY, "0.01");
  const bTx = await settle("yabelo-ond-2023", b);
  const c = await create("yabelo-ond-2022", 7n * DAY, "0.005");
  const d = await create("yabelo-ond-2021", 11n * 60n, "0.002");

  console.log(`Local chain 31337 · RilvaEscrow ${escrow} (deploy block ≤ ${block.number})`);
  console.log(`  #${a}  OND 2021 → settled (expected Released)      ${aTx}`);
  console.log(`  #${b}  OND 2023 → settled (expected Refunded)      ${bTx}`);
  console.log(`  #${c}  OND 2022 → Active, 7-day window (attest/settle demo)`);
  console.log(`  #${d}  OND 2021 → Active, 11-minute window (timeout-refund demo)`);
  console.log(`Roles: funder ${funder} · attestor ${attestor} · beneficiary ${beneficiary}`);
  console.log("\nFor .env.local:");
  console.log("NEXT_PUBLIC_RILVA_CHAIN=local");
  console.log(`NEXT_PUBLIC_RILVA_ESCROW_ADDRESS=${escrow}`);
  console.log("NEXT_PUBLIC_RILVA_DEPLOY_BLOCK=0");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
