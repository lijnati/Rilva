"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { campaignView } from "@/lib/app/campaignView";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { parseCampaignId } from "@/lib/app/format";
import { describeRevert } from "@/lib/app/revert";
import { readCampaign } from "@/lib/contracts";
import { EmptyState, NotConfigured, Skeleton } from "@/components/ui/States";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { truncateMiddle } from "@/components/chain/HashField";
import { useCampaignCount, useChainTime, useEscrowClient } from "@/components/chain/useRilva";

const PAGE = 10n;

function Lookup() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const id = parseCampaignId(raw);
        if (id === null) return setErr("Campaign ids are whole numbers starting at 1.");
        router.push(`/campaigns/${id}`);
      }}
    >
      <label htmlFor="lookup" className="sr-only">Campaign id</label>
      <div className="min-w-0 flex-1">
        <input
          id="lookup"
          inputMode="numeric"
          className="field mono max-w-[200px]"
          placeholder="Campaign #"
          value={raw}
          aria-invalid={!!err}
          aria-describedby={err ? "lookup-err" : undefined}
          onChange={(e) => {
            setRaw(e.target.value);
            setErr(null);
          }}
        />
        {err && <p id="lookup-err" className="mt-1.5 pl-4 text-[12px] text-fail">{err}</p>}
      </div>
      <button className="btn btn-outline" type="submit">Open</button>
    </form>
  );
}

export function CampaignList() {
  const { client, escrow } = useEscrowClient();
  const count = useCampaignCount();
  const now = useChainTime();
  const [page, setPage] = useState(0n);

  const total = count.data ?? 0n;
  const top = total - page * PAGE;
  const ids: bigint[] = [];
  for (let i = top; i > 0n && i > top - PAGE; i--) ids.push(i);

  const rows = useQuery({
    queryKey: ["campaignPage", CHAIN.chain.id, escrow, ids.map(String).join(",")],
    enabled: !!client && !!escrow && ids.length > 0,
    queryFn: () => Promise.all(ids.map(async (id) => ({ id, c: await readCampaign(client!, escrow!, id) }))),
  });

  if (!ESCROW.address) return <NotConfigured />;

  const error = count.error ?? rows.error;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="h3">On-chain campaigns</h2>
          <p className="mt-1 text-[13px] text-ink-2">
            Read directly from RilvaEscrow on {CHAIN.label} · <code className="font-mono text-[12px]">{truncateMiddle(ESCROW.address, 8, 6)}</code>
            {count.data !== undefined && <> · {count.data.toString()} total</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Lookup />
          <Link className="btn btn-butter" href="/campaigns/new">
            Create a campaign <span className="i" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      {error ? (
        <EmptyState
          title="Could not reach the chain"
          tone="error"
          action={
            <button type="button" className="btn btn-sm btn-outline" onClick={() => (count.error ? count.refetch() : rows.refetch())}>
              Try again
            </button>
          }
        >
          <p>{describeRevert(error).reason}</p>
          <p className="mt-1 text-[12.5px]">RPC: {CHAIN.rpcUrl}. Nothing is shown instead of real records.</p>
        </EmptyState>
      ) : count.isPending || (ids.length > 0 && rows.isPending) ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading campaigns">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[372px] rounded-[14px]" />
          ))}
        </div>
      ) : total === 0n ? (
        <EmptyState title="No campaigns yet" action={<Link className="btn btn-sm btn-butter" href="/campaigns/new">Create the first one →</Link>}>
          <p>The contract is deployed but nobody has funded a campaign on it yet.</p>
        </EmptyState>
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Campaigns, newest first">
            {rows.data!.map(({ id, c }) => {
              const v = campaignView(c, now.data ?? 0n);
              if (v.status === "NotFound") return null;
              return (
                <li key={id.toString()}>
                  <CampaignCard id={id} c={c} status={v.status} seed={Number(id) * 13 + 5} />
                </li>
              );
            })}
          </ul>
          {total > PAGE && (
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="btn btn-sm btn-outline" disabled={page === 0n} onClick={() => setPage((p) => p - 1n)}>
                ← Newer
              </button>
              <span className="text-[12.5px] text-ink-2">Page {(page + 1n).toString()}</span>
              <button type="button" className="btn btn-sm btn-outline" disabled={top - PAGE <= 0n} onClick={() => setPage((p) => p + 1n)}>
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
