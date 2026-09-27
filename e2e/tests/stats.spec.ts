import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("stats KPIs and kill-chain charts render", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("view-stats").click();
  await expect(page.getByTestId("stats-view").or(page.getByTestId("stats-loading"))).toBeVisible();
  await expect(page.getByTestId("stats-view")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("type-filter")).toBeVisible();
  await expect(page.getByTestId("stats-kpis")).toBeVisible();
  await expect(page.getByTestId("kpi-unique-ips")).toBeVisible();
  await expect(page.getByTestId("kpi-payload")).toBeVisible();
  await expect(page.getByTestId("stats-card")).toHaveCount(5);
  await expect(page.getByTestId("stats-view")).toContainText("Events over time by type");
  await expect(page.getByTestId("stats-view")).toContainText("Top countries (internet)");
  await expect(page.getByTestId("stats-view")).toContainText("Top ports");
  await expect(page.getByTestId("stats-view")).toContainText("Protocols");
  await expect(page.getByTestId("stats-protocol-legend")).toBeVisible();
  await expect(page.getByTestId("stats-top-ips")).toBeVisible();
  await expect(page.getByTestId("timeline")).toHaveCount(0);
});
