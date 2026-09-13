import { expect, test } from "@playwright/test";

/** 首页停在封面，先跳过开场绘本再进寻宝页。 */
async function intoHunt(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /打开信封/ }).click();
  await page.getByRole("button", { name: "接收邀请" }).click();
  await page.getByRole("button", { name: "跳过" }).click();
  await page.getByRole("button", { name: "我已到达，开始探索" }).waitFor({ timeout: 15_000 });
}

test("竖屏手机直接进入封面，不会被旋转墙拦住", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "城堡的灯一直亮着" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /打开信封/ })).toBeVisible();
  await expect(page.getByText("请将屏幕横过来")).toHaveCount(0);
});

test("开场绘本可以翻页，也可以跳过", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /打开信封/ }).click();
  await page.getByRole("button", { name: "接收邀请" }).click();
  await expect(page.getByRole("heading", { name: "这封信走了二十七年" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "跳过" }).click();
  await expect(page.getByRole("button", { name: "我已到达，开始探索" })).toBeVisible({ timeout: 15_000 });
});

test("竖屏任务卡贴在底部，点收起后不挡住地图", async ({ page }) => {
  const viewport = page.viewportSize()!;
  await intoHunt(page);
  const card = page.locator(".quest");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.y).toBeGreaterThan(viewport.height * 0.35);
  await page.getByRole("button", { name: "收起" }).click();
  await expect(card).toHaveClass(/is-folded/);
});

test("地图画布跟着容器比例走，竖屏不是一条横带", async ({ page }) => {
  await intoHunt(page);
  const map = page.locator(".hunt-map");
  const box = await map.boundingBox();
  expect(box!.height).toBeGreaterThan(box!.width * 0.8);
});

test("引路人暗门：长按指南针输口令可以强制收下信物", async ({ page }) => {
  await intoHunt(page);
  const compass = page.getByRole("button", { name: "指南针" });
  await compass.dispatchEvent("pointerdown");
  await page.waitForTimeout(3_300);
  await compass.dispatchEvent("pointerup");
  await page.locator("input[inputmode='numeric']").fill("1104");
  await page.getByRole("button", { name: "进入" }).click();
  await expect(page.getByRole("heading", { name: "引路人控制台" })).toBeVisible();
  await page.getByRole("button", { name: "强制收下" }).click();
  await expect(page.getByRole("heading", { name: "玻璃鞋" })).toBeVisible({ timeout: 10_000 });
});

test("定位自检页随构建一起发出", async ({ page }) => {
  // 现场读坐标的唯一工具，必须真的进 dist，否则人到点上了才发现没工具。
  await page.goto("/geo-test.html");
  await expect(page.getByRole("heading", { name: "定位自检（Exploration Atlas）" })).toBeVisible({ timeout: 7_000 });
});
