import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

/**
 * Hardhat 3 configuration for RilvaEscrow (CONTRACTS.md, DEPLOYMENT.md).
 *
 * Compiler: solc 0.8.37 with the optimizer DISABLED. The only known bug in 0.8.37
 * (YulOptimizerKnowledgeBaseStaleBookkeeping, low severity) requires the Yul optimizer; gas on an
 * L2 testnet is negligible, so we trade a little gas for removing that condition entirely.
 *
 * Secrets: the deployer key is read lazily via configVariable — from the Hardhat keystore
 * (`pnpm hardhat keystore set BASE_SEPOLIA_PRIVATE_KEY`) or an env var — and only when the
 * baseSepolia network is actually used. Never commit keys; never use a NEXT_PUBLIC_ variable for them.
 */
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.37",
    settings: {
      optimizer: { enabled: false },
      evmVersion: "cancun",
    },
  },
  paths: {
    tests: { nodejs: "tests/contracts" },
  },
  networks: {
    baseSepolia: {
      type: "http",
      chainType: "op",
      chainId: 84532,
      url: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      accounts: [configVariable("BASE_SEPOLIA_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
});
