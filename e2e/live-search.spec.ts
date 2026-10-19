import { expect, test } from "@playwright/test";
import type { LiveSetlist } from "../src/lib/live-setlist/types";

test.use({ locale: "zh-CN" });

const live: LiveSetlist = {
  eventernoteEventId: 900000001,
  title: "回归测试 LIVE",
  eventDate: "2026-09-01",
  venue: "测试会场",
  performingBands: [{ slug: "roselia", name: "Roselia" }],
  entries: [{
    position: 1, title: "Fixture Song", songId: 900000001,
    category: "original", bandSlug: "roselia", firstReleaseDate: "2026-01-01",
    isFirstPerformance: true,
  }],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/default-user-stats", route => route.fulfill({ json: {
    state: "config-error", userId: "fixture", message: "示例统计在此测试中停用。",
  } }));
});

test("searches, opens a setlist, preserves it across tabs, and clears the search", async ({ page }) => {
  let detailRequests = 0;
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.route("**/api/live-setlists?*", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has("eventernoteEventId")) {
      detailRequests++;
      return route.fulfill({ json: { live } });
    }
    return route.fulfill({ json: params.has("q") ? { candidates: [live] } : { events: [] } });
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "活动", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "活动标题或日期" });
  await input.fill("回归测试");
  await page.getByRole("list", { name: "活动搜索候选" }).getByRole("button").click();
  await expect(page).toHaveURL(/\/events\/900000001$/);
  await expect(page.getByText("Fixture Song", { exact: true })).toBeVisible();

  await page.getByRole("radio", { name: "用户", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("radio", { name: "活动", exact: true }).click();
  await expect(page.getByText("Fixture Song", { exact: true })).toBeVisible();
  expect(detailRequests).toBe(1);

  await page.getByRole("button", { name: "清空搜索条件" }).click();
  await expect(input).toHaveValue("");
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByText("Fixture Song", { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("saves the opened setlist card as an image", async ({ page }) => {
  await page.route("**/api/live-setlists?*", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has("eventernoteEventId")) {
      return route.fulfill({ json: { live } });
    }
    return route.fulfill({ json: params.has("q") ? { candidates: [live] } : { events: [] } });
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "活动", exact: true }).click();
  await page.getByRole("searchbox", { name: "活动标题或日期" }).fill("回归测试");
  await page.getByRole("list", { name: "活动搜索候选" }).getByRole("button").click();
  await expect(page.getByText("Fixture Song", { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存为图片" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^bdrsongs-setlist-900000001-\d{8}\.jpg$/,
  );
});

test("recovers from a failed candidate request on the next search", async ({ page }) => {
  await page.route("**/api/live-setlists?*", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("q") === "失败") {
      return route.fulfill({ status: 503, json: { error: "unavailable" } });
    }
    return route.fulfill({ json: params.has("q") ? { candidates: [live] } : { events: [] } });
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "活动", exact: true }).click();
  const input = page.getByRole("searchbox", { name: "活动标题或日期" });
  await input.fill("失败");
  await expect(page.getByText("活动搜索失败，请稍后再试。", { exact: true })).toBeVisible();
  await input.fill("恢复");
  await expect(page.getByRole("list", { name: "活动搜索候选" })).toContainText(live.title);
  await expect(page.getByText("活动搜索失败，请稍后再试。", { exact: true })).toHaveCount(0);
});
