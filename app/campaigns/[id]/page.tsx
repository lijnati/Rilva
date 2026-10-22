import type { Metadata } from "next";
import { CampaignDetail } from "@/components/campaign/CampaignDetail";
import { EscrowGate } from "@/components/chain/EscrowGate";
import { PageHero } from "@/components/site/PageHero";
import { EmptyState } from "@/components/ui/States";
import { parseCampaignId } from "@/lib/app/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Campaign #${id}` };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = parseCampaignId(raw);
  return (
    <>
      <PageHero seed={88} eyebrow="Campaign" title="Who funded it. What decides it. Where it goes." />
      <main id="main" className="container-rv pb-20 pt-6">
        {id === null ? (
          <EmptyState title="Not a campaign id">
            <p>Campaign ids are whole numbers starting at 1.</p>
          </EmptyState>
        ) : (
          <EscrowGate>
            <CampaignDetail id={id} />
          </EscrowGate>
        )}
      </main>
    </>
  );
}
