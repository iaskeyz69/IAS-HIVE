import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("table filter, sort, type chips, and row click work", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("view-table").click();
  await expect(page.getByTestId("table-view")).toBeVisible();
  await expect(page.getByTestId("type-filter")).toBeVisible();
  await expect(page.getByTestId("type-filter-payload")).toBeVisible();
  await expect(page.getByTestId("hit-filters")).toBeVisible();
  await expect(page.getByTestId("filter-ip")).toBeVisible();
  await expect(page.getByTestId("filter-time-1h")).toBeVisible();
  await expect(page.getByTestId("table-filter")).toBeVisible();
  await expect(page.getByTestId("table-pager")).toBeVisible();
  await expect(page.getByTestId("timeline")).toHaveCount(0);
  await page.getByTestId("table-sort-src_ip").click();
  const row = page.getByTestId("table-row").first();
  if (await row.count()) {
    await expect(page.getByTestId("table-type").first()).toBeVisible();
    await expect(page.getByTestId("table-summary").first()).toBeVisible();
    await expect(page.getByTestId("table-time").first()).toBeVisible();
    await row.click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await expect(page.getByTestId("detail-summary")).toBeVisible();
    await page.getByTestId("detail-close").click();
  }
  await page.getByTestId("type-filter-login").click();
  await page.getByTestId("table-filter").fill("ssh");
  await page.getByTestId("filter-time-1h").click();
});
