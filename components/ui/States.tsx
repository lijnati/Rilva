import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmptyState({ title, children, action, tone = "neutral" }: { title: string; children?: React.ReactNode; action?: React.ReactNode; tone?: "neutral" | "error" | "warn" }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-[18px] px-6 py-10 text-center sm:px-10",
        tone === "error" ? "bg-fail-soft" : tone === "warn" ? "bg-warn-soft" : "bg-paper-deep/70",
      )}
    >
      <p className="font-display text-[20px] font-semibold tracking-[-0.03em]">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-[56ch] text-[14px] leading-6 text-ink-2">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

export function NotConfigured() {
  return (
    <EmptyState title="Contract not configured" tone="warn" action={<Link className="btn btn-sm btn-outline" href="/explore">Explore the climate data instead</Link>}>
      <p>
        This build has no RilvaEscrow address. The Base Sepolia deployment is pending; campaigns appear here once
        <code className="mx-1 font-mono text-[12.5px]">NEXT_PUBLIC_RILVA_ESCROW_ADDRESS</code>is set. Nothing on this page is simulated.
      </p>
    </EmptyState>
  );
}

const STATUS_STYLE = {
  Active: { cls: "bg-ice text-ink", icon: "◷", label: "Active · funds in escrow" },
  Released: { cls: "bg-mint text-ink", icon: "→", label: "Released to beneficiary" },
  Refunded: { cls: "bg-cream text-ink", icon: "↩", label: "Refunded to funder" },
} as const;

/** The one status pill per campaign; mirrors the contract enum only. */
export function CampaignStatusChip({ status, reason }: { status: "Active" | "Released" | "Refunded"; reason?: "NotTriggered" | "Timeout" | null }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("chip ring-1 ring-rule", s.cls)}>
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
      {status === "Refunded" && reason && <span className="font-normal text-ink-2">· {reason === "Timeout" ? "timeout" : "rule not met"}</span>}
    </span>
  );
}
