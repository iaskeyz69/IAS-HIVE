import { expect, test } from "@playwright/test";
import { assertNoOverlap, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("map or globe shows a canvas and the live card", async ({ page }) => {
  await expect(page.getByTestId("view-map")).toBeVisible();
  const map = page.getByTestId("map-host");
  const missing = page.getByTestId("map-missing-token");
  await expect(map.or(missing)).toBeVisible();
  if (await map.isVisible()) {
    await expect(page.locator(".mapboxgl-canvas")).toBeVisible({ timeout: 20_000 });
  }
  await expect(page.getByTestId("live-card")).toBeVisible();
  await assertNoOverlap(page.getByTestId("view-toggle"), page.getByTestId("live-card"), "toggle vs live");
  await page.getByTestId("view-globe").click();
  await expect(page.getByTestId("view-globe")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("live-card")).toBeVisible();
});

test("live row opens a readable hit panel", async ({ page }) => {
  const empty = page.getByTestId("event-empty");
  const row = page.getByTestId("event-row").first();
  if (await empty.isVisible()) {
    test.info().annotations.push({ type: "note", description: "no live events yet" });
    return;
  }
  await row.click();
  await expect(page.getByTestId("detail-panel")).toBeVisible();
  await expect(page.getByTestId("detail-panel")).toContainText("Hit");
  await expect(page.getByTestId("detail-ip")).toBeVisible();
  await expect(page.getByTestId("detail-close")).toBeVisible();
  await assertNoOverlap(page.getByTestId("detail-panel"), page.getByTestId("timeline"), "detail vs timeline");
  await page.getByTestId("detail-close").click();
  await expect(page.getByTestId("detail-panel")).toHaveCount(0);
});
