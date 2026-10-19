/**
 * Shared fixtures for RilvaEscrow tests (Hardhat 3 + node:test + viem).
 * Test keys below are derived from public strings — worthless, never used outside local tests.
 */
import { network } from "hardhat";
import { getAddress, keccak256, parseEther, stringToBytes, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SCENARIOS } from "../../lib/climate/scenarios";
import {
  campaignTermsFromSpec,
  rilvaDomain,
  signAttestation,
  type Attestation,
  type CampaignTerms,
} from "../../lib/contracts";

export const connection = await network.create();
export const { viem, networkHelpers } = connection;

export const attestorAccount = privateKeyToAccount(keccak256(stringToBytes("rilva-test-attestor")));
export const impostorAccount = privateKeyToAccount(keccak256(stringToBytes("rilva-test-impostor")));

export const AMOUNT = parseEther("0.01");
export const DAY = 86_400n;

/** Terms from the real Phase 1 OND 2021 spec (the canonical string the app will submit). */
export const OND2021_TERMS: CampaignTerms = campaignTermsFromSpec(SCENARIOS["yabelo-ond-2021"].spec);

export async function deployEscrow() {
  return viem.deployContract("RilvaEscrow");
}

export async function baseFixture() {
  const escrow = await deployEscrow();
  const [deployer, funder, beneficiary, other, relayer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  // Hardhat's json-rpc accounts expose lowercase addresses; the contract returns checksummed ones.
  const A = {
    escrow: getAddress(escrow.address),
    funder: getAddress(funder!.account.address),
    beneficiary: getAddress(beneficiary!.account.address),
    other: getAddress(other!.account.address),
    relayer: getAddress(relayer!.account.address),
  };
  return { escrow, deployer: deployer!, funder: funder!, beneficiary: beneficiary!, other: other!, relayer: relayer!, publicClient, chainId, A };
}

export type Fixture = Awaited<ReturnType<typeof baseFixture>>;
export type Escrow = Fixture["escrow"];

export async function now(): Promise<bigint> {
  return BigInt(await networkHelpers.time.latest());
}

export interface CreateOptions {
  beneficiary?: Address;
  attestor?: Address;
  terms?: CampaignTerms;
  deadline?: bigint;
  value?: bigint;
  from?: Fixture["funder"];
}

/** Creates a campaign and returns its id and deadline. */
export async function createCampaign(f: Fixture, o: CreateOptions = {}) {
  const terms = o.terms ?? OND2021_TERMS;
  const deadline = o.deadline ?? (await now()) + 7n * DAY;
  const from = o.from ?? f.funder;
  const before = await f.escrow.read.campaignCount();
  const hash = await f.escrow.write.createCampaign(
    [
      o.beneficiary ?? f.beneficiary.account.address,
      o.attestor ?? attestorAccount.address,
      terms.observationStart,
      terms.observationEnd,
      terms.thresholdBps,
      deadline,
      terms.spec,
    ],
    { account: from.account, value: o.value ?? AMOUNT },
  );
  await f.publicClient.waitForTransactionReceipt({ hash });
  return { id: before + 1n, deadline, terms, hash };
}

export function attestationFor(id: bigint, terms: CampaignTerms, indexBps: number, expiresAt: bigint, evidenceHash?: Hex): Attestation {
  return {
    campaignId: id,
    specHash: terms.specHash,
    evidenceHash: evidenceHash ?? keccak256(stringToBytes(`evidence-${id}-${indexBps}`)),
    indexBps,
    observationStart: terms.observationStart,
    observationEnd: terms.observationEnd,
    expiresAt,
  };
}

export async function sign(f: Fixture, a: Attestation, signer = attestorAccount, chainId = f.chainId, verifyingContract: Address = f.escrow.address) {
  return signAttestation(signer, rilvaDomain(chainId, verifyingContract), a);
}

/** Sum of amounts of Active campaigns — must always equal the contract balance (invariant I1). */
export async function activeLiabilities(f: Fixture): Promise<bigint> {
  const count = await f.escrow.read.campaignCount();
  let total = 0n;
  for (let i = 1n; i <= count; i++) {
    const c = await f.escrow.read.getCampaign([i]);
    if (c.status === 1) total += c.amount;
  }
  return total;
}
