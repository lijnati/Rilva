import { expect, test } from "@playwright/test";

/**
 * A build whose NEXT_PUBLIC_RILVA_ESCROW_ADDRESS is not RilvaEscrow on the configured chain (e.g. an EOA
 * on the local node). Run with E2E_CHAIN=misconfigured against such a build. Climate pages keep working;
 * no chain-backed page offers a transaction.
 */
test.skip(process.env.E2E_CHAIN !== "misconfigured", "needs a build pointing at a non-RilvaEscrow address");

for (const route of ["/campaigns", "/campaigns/new", "/campaigns/1", "/verify/1"]) {
  test(`${route} shows a configuration error and no transaction controls`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByText("Contract configuration error")).toBeVisible();
    await expect(page.getByText("Transactions are disabled until this is fixed.")).toBeVisible();
    for (const name of [/Lock .* and create campaign/, /Submit settlement/, /Refund .* to the funder/, /Continue/]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });
}

test("the climate explorer still works", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByText("33.6", { exact: false }).first()).toBeVisible();
});

test("the landing judge path does not link to campaigns on the unverified contract", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("The configured contract could not be confirmed on-chain.").first()).toBeVisible();
  await expect(page.locator('a[href^="/verify/"]')).toHaveCount(0);
});
