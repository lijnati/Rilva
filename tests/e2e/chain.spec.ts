import { expect, test } from "@playwright/test";

/**
 * Journeys 6–7 against the LOCAL Hardhat chain (pnpm chain:node, chain:deploy:local, chain:seed:local;
 * .env.local NEXT_PUBLIC_RILVA_CHAIN=local). Skipped unless E2E_CHAIN=local.
 */
test.skip(process.env.E2E_CHAIN !== "local", "needs the seeded local Hardhat chain");

test("public verification of a released campaign passes every check without a wallet", async ({ page }) => {
  await page.goto("/verify/1");
  await expect(page.getByText("Every applicable check passed")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Passed", { exact: true })).toHaveCount(7);
  await expect(page.getByText("Local development chain.")).toBeVisible();
});

test("a non-triggering refund also verifies", async ({ page }) => {
  await page.goto("/verify/2");
  await expect(page.getByText("Every applicable check passed")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Refunded · rule not met").first()).toBeVisible();
});

test("try to break it: stranger signature and premature refund are rejected (eth_call only)", async ({ page }) => {
  await page.goto("/campaigns/3");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Try to break it" }) });
  await panel.getByRole("listitem").filter({ hasText: "Sign with a stranger" }).getByRole("button", { name: "Try it" }).click();
  await expect(panel.getByText("Rejected: InvalidSigner")).toBeVisible();
  await panel.getByRole("listitem").filter({ hasText: "Refund before the deadline" }).getByRole("button", { name: "Try it" }).click();
  await expect(panel.getByText("Rejected: SettlementWindowOpen")).toBeVisible();
});

test("duplicate settlement is rejected", async ({ page }) => {
  await page.goto("/campaigns/1");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Try to break it" }) });
  await panel.getByRole("listitem").filter({ hasText: "Settle the same campaign twice" }).getByRole("button", { name: "Try it" }).click();
  await expect(panel.getByText("Rejected: CampaignNotActive")).toBeVisible();
});

test("campaign list shows real records and a missing id is explained", async ({ page }) => {
  await page.goto("/campaigns");
  await expect(page.getByRole("link", { name: /#1/ })).toBeVisible();
  await page.goto("/campaigns/999");
  await expect(page.getByText("Campaign #999 does not exist")).toBeVisible();
});

test("judge path links to real released, refunded and active campaigns", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#see-it-work");
  await expect(section.getByRole("link", { name: /Verify campaign #\d+/ }).first()).toBeVisible({ timeout: 60_000 });
  await expect(section.getByRole("link", { name: /Attack campaign #\d+/ })).toBeVisible();
  await section.getByRole("link", { name: /Verify a payout/ }).click();
  await expect(page.getByText("Every applicable check passed")).toBeVisible({ timeout: 90_000 });
});
