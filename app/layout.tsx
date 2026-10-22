import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/chain/Providers";
import { Footer } from "@/components/site/Footer";
import { RevealObserver } from "@/components/site/RevealObserver";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-dm-sans", display: "swap" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Rilva — Climate evidence. Verifiable relief.", template: "%s · Rilva" },
  description:
    "Reproducible rainfall evidence and auditable, testnet-only drought-relief escrow. Historical replays only; not a live alert.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1512" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${dmSans.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-dvh">
        <noscript>
          <style>{`.reveal,.split .w{opacity:1!important;transform:none!important;filter:none!important}`}</style>
        </noscript>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-sm btn-butter">
          Skip to content
        </a>
        <Providers>
          {children}
          <Footer />
        </Providers>
        <RevealObserver />
      </body>
    </html>
  );
}
