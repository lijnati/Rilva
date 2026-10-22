import { Nav } from "./Nav";

/** Server wrapper so pages don't need to know what sits on the right of the nav. */
export function SiteNav() {
  return <Nav />;
}
