import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("sign out returns to the login form", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("sign-out").click();
  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toHaveText("Sign in");
});
