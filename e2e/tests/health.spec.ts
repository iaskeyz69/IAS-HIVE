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

  const toggleBg = await page.getByTestId("view-toggle").evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(isOpaqueColor(toggleBg), `view-toggle background ${toggleBg}`).toBeTruthy();

  for (const id of ["live-card", "timeline"]) {
    const paint = await page.getByTestId(id).evaluate((el) => {
      const style = getComputedStyle(el);
      return { bg: style.backgroundColor, blur: style.backdropFilter || "" };
    });
    const frosted = paint.blur !== "none" && paint.blur !== "";
    expect(frosted || isOpaqueColor(paint.bg), `${id} background ${paint.bg} blur ${paint.blur}`).toBeTruthy();
  }

  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});
