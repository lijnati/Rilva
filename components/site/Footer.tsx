import Link from "next/link";
import { Brand } from "./Brand";

export function Footer() {
  return (
    <footer className="pb-10 pt-14 text-[12.5px]">
      <div className="container-rv">
        <div className="flex flex-wrap items-start justify-between gap-8 border-b border-rule pb-8">
          <div>
            <div className="text-ink">
              <Brand tone="ink" />
            </div>
            <p className="mt-2 text-ink-2">Climate evidence. Verifiable relief.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-ink">
            <Link className="hover:underline" href="/explore">Explore</Link>
            <Link className="hover:underline" href="/campaigns">Campaigns</Link>
            <Link className="hover:underline" href="/campaigns/new">Create a campaign</Link>
            <Link className="hover:underline" href="/methodology">Methodology</Link>
          </nav>
        </div>
        <div className="grid gap-2 pt-6 leading-5 text-ink-2 md:grid-cols-2 md:gap-8">
          <p>
            <strong className="font-semibold text-ink">Testnet demonstration. No real funds, no insurance, no relief delivered.</strong>{" "}
            All seasons shown are retrospective replays, not live drought alerts.
          </p>
          <p>
            Weather data by{" "}
            <a className="link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo.com
            </a>{" "}
            (
            <a className="link" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            ), based on ERA5 — Copernicus Climate Change Service. CHIRPS v3.0 cross-check: Funk et al., Climate Hazards Center, UCSB.
            Ethiopia outline: Natural Earth (public domain).
          </p>
        </div>
      </div>
    </footer>
  );
}
