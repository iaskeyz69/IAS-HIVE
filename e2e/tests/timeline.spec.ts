import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("timeline stays visible on every view", async ({ page }) => {
  await signIn(page);
  for (const id of ["view-map", "view-globe", "view-table", "view-stats"]) {
    await page.getByTestId(id).click();
    const bar = page.getByTestId("timeline");
    await expect(bar).toBeVisible();
    await expect(bar.getByText("Last hour")).toBeVisible();
    await expect(page.getByTestId("timeline-live")).toBeVisible();
    const box = await bar.boundingBox();
    expect(box, `timeline missing on ${id}`).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  }
});
