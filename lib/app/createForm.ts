/**
 * Create-campaign form validation. Mirrors RilvaEscrow.createCampaign's rules (CONTRACTS.md §3) so the
 * funder sees problems before signing; the contract remains the final authority. Terms always come
 * from campaignTermsFromSpec() — never from user-typed percentages or dates.
 */
import { getAddress, isAddress, parseEther, zeroAddress, type Address } from "viem";
import { isScenarioId, SCENARIOS, type ClimateSpec } from "../climate";
import { campaignTermsFromSpec, type CampaignTerms } from "../contracts";

const MAX_UINT96 = (1n << 96n) - 1n;
/** Contract window is [now + 10 min, now + 366 days] at inclusion time; keep 2 minutes of margin each side. */
export const MIN_DEADLINE_SECONDS = 10 * 60 + 120;
export const MAX_DEADLINE_SECONDS = 366 * 86400 - 120;

export interface CreateFormInput {
  scenarioId: string;
  beneficiary: string;
  attestor: string;
  amountEth: string;
  deadlineSeconds: number;
}

export type CreateFormField = keyof CreateFormInput;
export type CreateFormErrors = Partial<Record<CreateFormField, string>>;

export interface CreateFormValue {
  spec: ClimateSpec;
  terms: CampaignTerms;
  beneficiary: Address;
  attestor: Address;
  value: bigint;
  settlementDeadline: bigint;
}

export type CreateFormResult = { ok: true; value: CreateFormValue } | { ok: false; errors: CreateFormErrors };

function parseAddress(raw: string, label: string): { address?: Address; error?: string } {
  const v = raw.trim();
  if (!v) return { error: `Enter the ${label} address.` };
  if (!isAddress(v, { strict: false })) return { error: "That is not a valid 0x address (40 hex characters)." };
  const address = getAddress(v);
  if (address === zeroAddress) return { error: `The ${label} cannot be the zero address.` };
  return { address };
}

export function parseEthAmount(raw: string): { wei?: bigint; error?: string } {
  const v = raw.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(v)) return { error: "Enter an amount like 0.01 (up to 18 decimals)." };
  const wei = parseEther(v);
  if (wei <= 0n) return { error: "The amount must be more than 0 ETH." };
  if (wei > MAX_UINT96) return { error: "The amount is larger than the contract supports." };
  return { wei };
}

export function validateCreateForm(input: CreateFormInput, ctx: { now: bigint; funder?: Address; balance?: bigint }): CreateFormResult {
  const errors: CreateFormErrors = {};
  const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

  let spec: ClimateSpec | undefined;
  if (!isScenarioId(input.scenarioId)) errors.scenarioId = "Choose one of the verified Yabelo replay seasons.";
  else spec = SCENARIOS[input.scenarioId].spec;

  const b = parseAddress(input.beneficiary, "beneficiary");
  const a = parseAddress(input.attestor, "attestor");
  if (b.error) errors.beneficiary = b.error;
  if (a.error) errors.attestor = a.error;
  if (!b.error && same(b.address, ctx.funder)) errors.beneficiary = "The beneficiary cannot be your own (funder) address.";
  if (!a.error && same(a.address, ctx.funder)) errors.attestor = "The attestor cannot be your own (funder) address.";
  if (!a.error && !b.error && same(a.address, b.address)) errors.attestor = "The attestor and beneficiary must be different addresses.";

  const amt = parseEthAmount(input.amountEth);
  if (amt.error) errors.amountEth = amt.error;
  else if (ctx.balance !== undefined && amt.wei! > ctx.balance) errors.amountEth = "This is more than your wallet balance (gas is extra).";

  const d = input.deadlineSeconds;
  if (!Number.isInteger(d) || d < MIN_DEADLINE_SECONDS || d > MAX_DEADLINE_SECONDS) {
    errors.deadlineSeconds = "The settlement window must be between 12 minutes and 365 days.";
  }

  if (Object.keys(errors).length > 0 || !spec) return { ok: false, errors };
  return {
    ok: true,
    value: {
      spec,
      terms: campaignTermsFromSpec(spec),
      beneficiary: b.address!,
      attestor: a.address!,
      value: amt.wei!,
      settlementDeadline: ctx.now + BigInt(d),
    },
  };
}
