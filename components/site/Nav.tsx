"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";

const LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/methodology", label: "Methodology" },
] as const;

/** Sky nav (pixel-meadow): white text over the art; links sit in the glass pill so clouds never cut legibility. */
export function Nav({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname();
  // The menu is open only for the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <div className="on-art relative z-20 fade-down">
      <div className="flex items-center gap-6 px-4 py-4 sm:px-8 sm:py-6">
        <Brand />
        <nav aria-label="Primary" className="glass ml-auto hidden items-center gap-7 rounded-full px-6 py-2.5 text-sm lg:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn("underline-offset-[6px] hover:underline", active && "underline decoration-butter decoration-2")}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:ml-0 lg:flex">{right}</div>
        <button
          type="button"
          className="btn btn-sm btn-sheet ml-auto lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="glass mx-3 mb-3 rounded-[18px] p-3 lg:hidden">
          <nav aria-label="Primary mobile" className="grid">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-4 py-3 text-[15px] hover:bg-white/15">
                {l.label}
              </Link>
            ))}
          </nav>
          {right && <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/25 px-2 pt-3">{right}</div>}
        </div>
      )}
    </div>
  );
}
