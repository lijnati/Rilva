import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rilva — Climate evidence. Verifiable relief.",
  description:
    "Reproducible rainfall evidence and auditable, testnet-only drought-relief escrow. Historical replays only; not a live alert.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6">
            <span className="text-lg font-semibold tracking-[-0.02em]">Rilva</span>
            <span className="text-xs text-ink-3">Base Sepolia · testnet</span>
          </div>
        </header>
        {children}
        <footer className="border-t border-rule">
          <div className="mx-auto max-w-[1200px] px-4 py-8 text-xs leading-5 text-ink-3 sm:px-6">
            <p>Testnet demonstration. No real funds, no insurance, no relief delivered.</p>
            <p>
              Weather data by{" "}
              <a className="underline" href="https://open-meteo.com/">
                Open-Meteo.com
              </a>{" "}
              (
              <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">
                CC BY 4.0
              </a>
              ), based on ERA5 — Copernicus Climate Change Service.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
