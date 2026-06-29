import { expect, test } from "@playwright/test";

test("renders the search experience", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Eventernote 用户 ID" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Eventernote 用户 ID" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开始统计" })).toBeVisible();
  await expect(page.getByText(/曲库更新时间：/)).toBeVisible();
});
