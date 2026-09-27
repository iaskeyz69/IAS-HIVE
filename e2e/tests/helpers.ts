import { expect, type Locator, type Page } from "@playwright/test";

export function hiveCreds() {
  const user = process.env.HIVE_USER;
  const password = process.env.HIVE_PASSWORD;
  if (!user || !password) {
    throw new Error("Set HIVE_USER and HIVE_PASSWORD for the live dashboard tests");
  }
  return { user, password };
}

export async function signIn(page: Page) {
  const { user, password } = hiveCreds();
  await page.goto("/");
  await expect(page.getByTestId("login-form")).toBeVisible();
  await page.getByTestId("login-user").fill(user);
  await page.getByTestId("login-pass").fill(password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("sign-out")).toBeVisible({ timeout: 20_000 });
}

export function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
}

export async function assertNoOverlap(a: Locator, b: Locator, label: string) {
  const ra = await a.boundingBox();
  const rb = await b.boundingBox();
  if (!ra || !rb) return;
  expect(boxesOverlap(ra, rb), label).toBeFalsy();
}

export function isOpaqueColor(color: string) {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color !== "transparent";
  const parts = m[1].split(",").map((s) => s.trim());
  if (parts.length < 4) return true;
  return Number(parts[3]) >= 0.85;
}

export function ignoreConsole(text: string) {
  return /mapbox|Failed to load resource|net::ERR|favicon|Download the React DevTools/i.test(text);
}
