"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { readCampaignHistory, type CampaignHistory } from "@/lib/app/chainHistory";
import { CHAIN, ESCROW } from "@/lib/app/appConfig";
import { CampaignStatus, readCampaign, readCampaignCount, type Campaign } from "@/lib/contracts";

/** Read-only chain access through the configured public RPC — no wallet needed. */
export function useEscrowClient() {
  const client = usePublicClient({ chainId: CHAIN.chain.id });
  return { client, escrow: ESCROW.address, deployBlock: ESCROW.deployBlock ?? 0n };
}

export type CampaignRecord = { found: false } | { found: true; campaign: Campaign; history: CampaignHistory };

export function useCampaignRecord(id: bigint | null) {
  const { client, escrow, deployBlock } = useEscrowClient();
  return useQuery({
    queryKey: ["campaign", CHAIN.chain.id, escrow, id?.toString()],
    enabled: !!client && !!escrow && id !== null,
    queryFn: async (): Promise<CampaignRecord> => {
      const campaign = await readCampaign(client!, escrow!, id!);
      if (campaign.status === CampaignStatus.None) return { found: false };
      const history = await readCampaignHistory(client!, escrow!, id!, deployBlock);
      return { found: true, campaign, history };
    },
  });
}

export function useCampaignCount() {
  const { client, escrow } = useEscrowClient();
  return useQuery({
    queryKey: ["campaignCount", CHAIN.chain.id, escrow],
    enabled: !!client && !!escrow,
    queryFn: () => readCampaignCount(client!, escrow!),
  });
}

/** Latest block timestamp: deadlines are judged by chain time, exactly as the contract does. */
export function useChainTime() {
  const { client } = useEscrowClient();
  return useQuery({
    queryKey: ["chainTime", CHAIN.chain.id],
    enabled: !!client,
    refetchInterval: 15_000,
    queryFn: async () => (await client!.getBlock({ blockTag: "latest" })).timestamp,
  });
}
