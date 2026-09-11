import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("stats cards render", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("view-stats").click();
  await expect(page.getByTestId("stats-view").or(page.getByTestId("stats-loading"))).toBeVisible();
  await expect(page.getByTestId("stats-view")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("stats-card")).toHaveCount(4);
  await expect(page.getByTestId("stats-view")).toContainText("Events over time");
  await expect(page.getByTestId("stats-view")).toContainText("Top countries");
  await expect(page.getByTestId("stats-view")).toContainText("Top ports");
  await expect(page.getByTestId("stats-view")).toContainText("Protocols");
  await expect(page.getByTestId("timeline")).toBeVisible();
});
