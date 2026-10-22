import type { Metadata } from "next";
import { CampaignList } from "@/components/campaign/CampaignList";
import { PageHero } from "@/components/site/PageHero";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Drought-trigger escrow campaigns read directly from the RilvaEscrow contract.",
};

export default function CampaignsPage() {
  return (
    <>
      <PageHero
        seed={57}
        eyebrow="Campaigns"
        title={
          <>
            Money locked to a rule. Released by <em>evidence</em>.
          </>
        }
        lede="Each campaign escrows testnet ETH for one beneficiary. If the attested rainfall index meets the rule, the contract pays out; otherwise the funder is refunded."
      />
      <main id="main" className="container-rv grid gap-10 pb-20 pt-6">
        <CampaignList />
        <section className="grid gap-4 md:grid-cols-3" aria-label="What a campaign is">
          {[
            ["Funder", "Locks a fixed amount and publishes the rule. Cannot attest, and cannot pull funds back before the deadline."],
            ["Attestor", "An independent party who recomputes the rainfall index and signs it. Trusted to sign honestly; every signature is checkable."],
            ["Beneficiary", "Fixed at creation. Receives the full amount once, and only if the rule is met."],
          ].map(([t, d], i) => (
            <div key={t} className={`rounded-[14px] p-5 ${["pastel-mint", "pastel-cream", "pastel-ice"][i]}`}>
              <p className="h3">{t}</p>
              <p className="mt-1.5 text-[13px] leading-[1.75] text-ink-2">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
