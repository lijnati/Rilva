import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/explore", "/campaigns", "/campaigns/new", "/campaigns/1", "/verify/1", "/methodology"];

for (const width of [360, 390]) {
  for (const route of ROUTES) {
    test(`no horizontal scroll at ${width}px: ${route}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
