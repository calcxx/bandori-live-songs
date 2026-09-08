import { expect, test } from "@playwright/test";

test.use({ locale: "zh-CN" });

test("validates the user search before allowing navigation", async ({ page }) => {
  // The search form must work even when the optional demo data is unavailable.
  await page.route("**/api/default-user-stats", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "Demo data unavailable in this test" }),
  }));
  await page.route("**/api/live-setlists?*", route => route.fulfill({ json: { events: [] } }));
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Eventernote ID", exact: true })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Eventernote 用户名" });
  const validation = page.locator("form").filter({ has: input }).getByRole("alert");
  const submit = page.getByRole("button", { name: "开始统计", exact: true });
  await expect(input).toBeVisible();
  await expect(submit).toBeDisabled();

  await input.fill("invalid/user");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(validation).toBeVisible();
  await submit.click();
  await expect(page).toHaveURL(/\/$/);

  await input.fill("sample_user");
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await expect(validation).toHaveCount(0);
  await expect(submit).toBeEnabled();
});
