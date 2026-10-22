import { NetworkBadge, WalletControl } from "@/components/chain/WalletControl";
import { Nav } from "./Nav";

/** Server wrapper so pages don't need to know what sits on the right of the nav. */
export function SiteNav() {
  return (
    <Nav
      right={
        <>
          <span className="hidden xl:inline-flex">
            <NetworkBadge />
          </span>
          <WalletControl />
        </>
      }
    />
  );
}
