import { expect, test } from "@playwright/test";

test("public smoke: home and pricing render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ReditFast/i);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Pricing" }),
  ).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: /plans built/i })).toBeVisible();
  await expect(page.getByText(/^Free$/)).toBeVisible();
  await expect(page.getByText(/^Pro$/)).toBeVisible();
  await expect(page.getByRole("link", { name: /contact sales/i })).toBeVisible();
});
