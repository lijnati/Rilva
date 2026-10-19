import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys the single, ownerless RilvaEscrow contract. No constructor arguments, no initial calls,
 * no funds. Campaigns are created by funders afterwards (never by this module).
 */
export default buildModule("RilvaEscrowModule", (m) => {
  const escrow = m.contract("RilvaEscrow");
  return { escrow };
});
