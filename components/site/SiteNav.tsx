import { NetworkBadge } from "@/components/chain/WalletControl";
import { Nav } from "./Nav";

/**
 * Server wrapper so pages don't need to know what sits on the right of the nav. Only the network
 * badge lives here: reading needs no wallet, so wallet controls appear only on pages that transact.
 */
export function SiteNav() {
  return <Nav right={<NetworkBadge />} />;
}
