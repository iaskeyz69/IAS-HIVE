import { expect, test } from "@playwright/test";
import { ignoreConsole, isOpaqueColor, signIn } from "./helpers";

test("no page errors and floating chrome is opaque", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ignoreConsole(msg.text())) consoleErrors.push(msg.text());
  });

  await signIn(page);
  await expect(page.getByTestId("live-card")).toBeVisible();
  await expect(page.getByTestId("timeline")).toBeVisible();

  for (const id of ["live-card", "view-toggle", "timeline"]) {
    const color = await page.getByTestId(id).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(isOpaqueColor(color), `${id} background ${color}`).toBeTruthy();
  }

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
