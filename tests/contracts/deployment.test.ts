/**
 * The smoke check used after a Base Sepolia deployment: deployed runtime code equals the compiled
 * artifact except for immutables, and nothing else passes for it.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import hre from "hardhat";
import type { Hex } from "viem";
import { runtimeCodeMatches, type ImmutableReferences } from "../../lib/contracts/bytecode";
import { deployEscrow, viem } from "./helpers";

const artifact = JSON.parse(await readFile("artifacts/contracts/RilvaEscrow.sol/RilvaEscrow.json", "utf8")) as {
  deployedBytecode: Hex;
  immutableReferences: ImmutableReferences;
};

describe("compiler profiles", () => {
  it("deploys (production profile) exactly what the tests compile (default profile)", () => {
    const { default: dflt, production } = hre.config.solidity.profiles;
    const settings = (p: typeof dflt) => p!.compilers.map((c) => ({ version: c.version, optimizerEnabled: c.settings.optimizer?.enabled, evmVersion: c.settings.evmVersion }));
    assert.deepEqual(settings(production), settings(dflt));
    assert.deepEqual(settings(dflt), [{ version: "0.8.37", optimizerEnabled: false, evmVersion: "cancun" }]);
  });
});

describe("deployed bytecode check", () => {
  it("accepts every RilvaEscrow deployment, whose immutables differ per address", async () => {
    const publicClient = await viem.getPublicClient();
    const [a, b] = [await deployEscrow(), await deployEscrow()];
    const [codeA, codeB] = [await publicClient.getCode({ address: a.address }), await publicClient.getCode({ address: b.address })];
    assert.notEqual(codeA, codeB, "immutables (address, domain separator) differ between deployments");
    assert.ok(runtimeCodeMatches(codeA, artifact.deployedBytecode, artifact.immutableReferences));
    assert.ok(runtimeCodeMatches(codeB, artifact.deployedBytecode, artifact.immutableReferences));
  });

  it("rejects another contract and an empty account", async () => {
    const publicClient = await viem.getPublicClient();
    const other = await viem.deployContract("RejectingReceiver");
    assert.equal(runtimeCodeMatches(await publicClient.getCode({ address: other.address }), artifact.deployedBytecode, artifact.immutableReferences), false);
    const [, eoa] = await viem.getWalletClients();
    assert.equal(runtimeCodeMatches(await publicClient.getCode({ address: eoa!.account.address }), artifact.deployedBytecode, artifact.immutableReferences), false);
  });
});
