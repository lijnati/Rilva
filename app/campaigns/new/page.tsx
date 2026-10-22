import type { Metadata } from "next";
import { CreateWizard } from "@/components/campaign/CreateWizard";
import { EscrowGate } from "@/components/chain/EscrowGate";
import { PageHero } from "@/components/site/PageHero";
import { ReplayBanner } from "@/components/site/ReplayBanner";

export const metadata: Metadata = { title: "Create a campaign", description: "Lock testnet ETH to a public, reproducible rainfall rule." };

export default function NewCampaignPage() {
  return (
    <>
      <PageHero seed={73} eyebrow="Create a campaign" title="Write the rule. Then lock the funds." lede="Four short steps. You will see every condition in plain words, and the exact spec that gets hashed on-chain, before your wallet asks you to sign." />
      <main id="main" className="container-rv grid gap-8 pb-20 pt-6">
        <ReplayBanner />
        <EscrowGate>
          <CreateWizard />
        </EscrowGate>
      </main>
    </>
  );
}
