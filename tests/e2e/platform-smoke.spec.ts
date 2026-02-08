import { expect, test } from "@playwright/test";

test("public smoke: home and pricing render", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ReditFast/i);
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Pricing" }),
  ).toBeVisible();

  await page.goto("/pricing");
  await expect(page.getByText(/\$39/i)).toBeVisible();
  await expect(page.getByText(/\$129/i)).toBeVisible();
});
