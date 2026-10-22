import { expect, test } from "@playwright/test";

/** Journeys 1–2: an anonymous visitor explores real drought evidence, then a non-trigger season. */
test("explorer: OND 2021 meets the rule, OND 2023 does not", async ({ page }) => {
  await page.goto("/explore");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("33");
  await expect(panel).toContainText(".63 %");
  await expect(panel).toContainText("condition met");
  await expect(panel).toContainText("3363");

  const tab2021 = page.getByRole("tab", { name: "OND 2021" });
  await tab2021.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "OND 2023" })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("213");
  await expect(panel).toContainText(".22 %");
  await expect(panel).toContainText("condition not met");
  await expect(page.getByText("Retrospective replay.").first()).toBeVisible();
});

test("explorer: the data table offers every season as text", async ({ page }) => {
  await page.goto("/explore");
  await page.getByText("Show the data as a table").click();
  await expect(page.locator("table tbody tr")).toHaveCount(33);
});

test("landing: hero, how-it-works and disclosures", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(/Climate evidence you can verify/);
  await expect(page.getByText("Testnet demonstration. No real funds, no insurance, no relief delivered.")).toBeVisible();
  await page.getByRole("link", { name: /See how it works/ }).click();
  await expect(page.getByRole("heading", { name: /Public rules/ })).toBeVisible();
});

test("invalid campaign ids are explained, not crashed", async ({ page }) => {
  await page.goto("/campaigns/abc");
  await expect(page.getByText("Not a campaign id")).toBeVisible();
  await page.goto("/verify/0");
  await expect(page.getByText("Not a campaign id")).toBeVisible();
});
