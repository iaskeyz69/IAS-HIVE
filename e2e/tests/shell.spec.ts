import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("top bar and left rail are usable", async ({ page }) => {
  await expect(page.getByTestId("stream-status")).toBeVisible();
  await expect(page.getByTestId("event-count")).toContainText("events");
  await expect(page.getByTestId("clock")).toBeVisible();
  await expect(page.getByTestId("connection-card")).toContainText("Connection");
  await expect(page.getByTestId("sensor-all")).toBeVisible();
  const sensors = page.getByTestId("sensor-row");
  await expect(sensors.first()).toBeVisible();
  await sensors.first().click();
  await expect(page.getByTestId("detail-panel")).toBeVisible();
  await page.getByTestId("sensor-all").click();
  await expect(page.getByTestId("detail-panel")).toHaveCount(0);
});
