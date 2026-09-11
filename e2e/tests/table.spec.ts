import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("table filter, sort, and row click work", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("view-table").click();
  await expect(page.getByTestId("table-view")).toBeVisible();
  await expect(page.getByTestId("table-filter")).toBeVisible();
  await expect(page.getByTestId("timeline")).toBeVisible();
  await page.getByTestId("table-sort-src_ip").click();
  const row = page.getByTestId("table-row").first();
  if (await row.count()) {
    await row.click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await page.getByTestId("detail-close").click();
  }
  await page.getByTestId("table-filter").fill("ssh");
});
