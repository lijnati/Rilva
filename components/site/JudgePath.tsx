"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useCampaignCount, useChainTime, useEscrowClient } from "@/components/chain/useRilva";
import { Skeleton } from "@/components/ui/States";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { pickDemoCampaigns } from "@/lib/app/judgePath";
import { readCampaign } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/** How far back the landing page looks for demo campaigns (newest first). */
const SCAN = 25n;

interface Card {
  n: string;
  title: string;
  body: string;
  href: string | null;
  cta: string;
  missing: string;
  tone: string;
}

function JudgeCard({ card, loading }: { card: Card; loading: boolean }) {
  const inner = (
    <>
      <span className="num">{card.n}</span>
      <p className="h3 mt-4">{card.title}</p>
      <p className="mt-1.5 flex-1 text-[13px] leading-[1.75] text-ink-2">{card.body}</p>
      {loading ? (
        <Skeleton className="mt-4 h-5 w-32" />
      ) : card.href ? (
        <span className="mt-4 text-[13.5px] font-semibold">
          {card.cta} <span aria-hidden="true">→</span>
        </span>
      ) : (
        <span className="mt-4 text-[12.5px] text-ink-3">{card.missing}</span>
      )}
    </>
  );
  const cls = cn("flex min-h-[220px] flex-col rounded-[14px] p-5 transition-shadow", card.tone, card.href && "hover:shadow-[var(--shadow-card)]");
  return card.href ? (
    <Link href={card.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls} aria-disabled="true">
      {inner}
    </div>
  );
}

/**
 * The no-wallet tour for judges: real data first, then real on-chain campaigns discovered from the
 * configured contract. Nothing is hardcoded; a missing kind of campaign is said plainly.
 */
export function JudgePath() {
  const { client, escrow } = useEscrowClient();
  const count = useCampaignCount();
  const now = useChainTime();
  const total = count.data ?? 0n;

  const picks = useQuery({
    queryKey: ["judgePath", CHAIN.chain.id, escrow, total.toString()],
    enabled: !!client && !!escrow && count.isSuccess && now.isSuccess,
    queryFn: async () => {
      const ids: bigint[] = [];
      for (let i = total; i > 0n && i > total - SCAN; i--) ids.push(i);
      const rows = await Promise.all(ids.map(async (id) => ({ id, c: await readCampaign(client!, escrow!, id) })));
      return pickDemoCampaigns(rows, now.data!);
    },
  });

  const loading = !!ESCROW.address && (count.isPending || now.isPending || (total > 0n && picks.isPending));
  const p = picks.data ?? { released: null, refunded: null, active: null };
  const unconfigured = !ESCROW.address;
  const missing = unconfigured
    ? "Appears once the testnet contract is deployed."
    : count.error || picks.error
      ? "Could not reach the chain right now."
      : "No such campaign on this contract yet.";

  const cards: Card[] = [
    {
      n: "1",
      title: "See the rainfall record",
      body: "33 October–December seasons at Yabelo against the 1991–2020 normal, recomputable in your browser.",
      href: "/explore",
      cta: "Open the Climate Explorer",
      missing,
      tone: "pastel-mint",
    },
    {
      n: "2",
      title: "Verify a payout",
      body: "A campaign the contract released after a signed, reproducible attestation. Every check runs in your browser.",
      href: p.released ? `/verify/${p.released}` : null,
      cta: `Verify campaign #${p.released}`,
      missing,
      tone: "pastel-cream",
    },
    {
      n: "3",
      title: "Verify a refund",
      body: "A wetter season: the attested index was above the rule, so the contract returned the funds to the funder.",
      href: p.refunded ? `/verify/${p.refunded}` : null,
      cta: `Verify campaign #${p.refunded}`,
      missing,
      tone: "pastel-ice",
    },
    {
      n: "4",
      title: "Try to break it",
      body: "Forge a signature, change the index, settle twice. Watch the contract refuse each one, with no transaction sent.",
      href: p.active ? `/campaigns/${p.active}#break-title` : null,
      cta: `Attack campaign #${p.active}`,
      missing,
      tone: "pastel-mint",
    },
  ];

  return (
    <section id="see-it-work" className="container-rv scroll-mt-6 py-14 sm:py-16" aria-labelledby="judge-title">
      <div className="grid items-end gap-6 md:grid-cols-2">
        <h2 id="judge-title" className="h2">
          See it work.
          <br />
          No wallet <em>needed</em>.
        </h2>
        <p className="max-w-[46ch] leading-[1.8] text-ink-2">
          Four clicks from rainfall data to an enforced, independently checkable payout. Campaigns below are read live from RilvaEscrow on{" "}
          {CHAIN.label}.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <JudgeCard key={c.n} card={c} loading={c.n !== "1" && loading} />
        ))}
      </div>
      <p className="mt-4 text-[12px] text-ink-3">All seasons are retrospective replays. Testnet funds only.</p>
    </section>
  );
}
