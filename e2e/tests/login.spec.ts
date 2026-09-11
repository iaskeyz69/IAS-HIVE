import { expect, test } from "@playwright/test";
import { hiveCreds, signIn } from "./helpers";

test("login page shows operator form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.getByLabel("Operator")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toHaveText("Sign in");
});

test("bad password stays on the form and clears the stored token", async ({ page }) => {
  const { user } = hiveCreds();
  await page.goto("/");
  await page.getByTestId("login-user").fill(user);
  await page.getByTestId("login-pass").fill("wrong-password-for-hive");
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("login-error")).toHaveText("Wrong user or password");
  await expect(page.getByTestId("login-form")).toBeVisible();
  const stored = await page.evaluate(() => sessionStorage.getItem("hive_auth"));
  expect(stored).toBeNull();
});

test("good password reaches the Hive shell", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("sensor-rail")).toBeVisible();
  await expect(page.getByTestId("view-toggle")).toBeVisible();
});
