import type { Metadata } from "next";
import { EscrowGate } from "@/components/chain/EscrowGate";
import { PageHero } from "@/components/site/PageHero";
import { EmptyState } from "@/components/ui/States";
import { VerifyReport } from "@/components/verify/VerifyReport";
import { parseCampaignId } from "@/lib/app/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Verify campaign #${id}`, description: "Independent verification of a Rilva campaign: no wallet needed." };
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = parseCampaignId(raw);
  return (
    <>
      <PageHero
        seed={101}
        preset="highland"
        sky={["#f4b9a0", "#f7d6b0", "#cfe3ef"]}
        eyebrow="Public verification · no wallet needed"
        title={
          <>
            Don&apos;t trust the page. Check the <em>math</em>.
          </>
        }
        lede="Your browser reads the contract, decodes the signed attestation, re-fetches the rainfall and recomputes every hash. Each check says exactly what it proves."
      />
      <main id="main" className="container-rv pb-20 pt-6">
        {id === null ? (
          <EmptyState title="Not a campaign id"><p>Campaign ids are whole numbers starting at 1.</p></EmptyState>
        ) : (
          <EscrowGate>
            <VerifyReport id={id} />
          </EscrowGate>
        )}
      </main>
    </>
  );
}
