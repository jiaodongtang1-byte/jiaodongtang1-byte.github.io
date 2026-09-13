import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("exploration-atlas:intro-film-played-v1", "true");
  });
});

async function openCartographer(page: import("@playwright/test").Page) {
  const compass = page.getByRole("button", { name: "指南针" });
  await compass.dispatchEvent("pointerdown");
  await page.waitForTimeout(3_300);
  await compass.dispatchEvent("pointerup");
  await page.locator("input[inputmode='numeric']").fill("1104");
  await page.getByRole("button", { name: "进入" }).click();
  await expect(page.getByRole("heading", { name: "制图人控制台" })).toBeVisible();
}

test("竖屏手机直接进入信封，不再被旋转墙拦截", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Exploration Atlas" })).toBeVisible({ timeout: 7_000 });
  await expect(page.getByRole("heading", { name: "请将屏幕横过来" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "开启地图" })).toBeVisible();
});

test("竖屏任务卡呈底部抽屉形态，点地图可收起", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开启地图" }).click();
  await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
  const card = page.locator(".quest-card.floating-quest-card");
  await expect(card).toBeVisible({ timeout: 7_000 });
  const viewport = page.viewportSize()!;
  const box = await card.boundingBox();
  expect(box!.y).toBeGreaterThan(viewport.height * 0.55);
  await page.locator(".map-stage").dispatchEvent("click");
  await expect(card).toHaveClass(/is-collapsed/);
});

test("手机跟随模式默认开启，拖动解除，按钮可恢复", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["geolocation"], { origin: new URL(baseURL!).origin });
  await context.setGeolocation({ latitude: 30.657, longitude: 104.0657, accuracy: 25 });
  await page.goto("/");
  await page.getByRole("button", { name: "开启地图" }).click();
  await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
  const map = page.getByLabel("可拖拽和双指缩放的探索地图");
  await expect(map).toBeVisible({ timeout: 7_000 });
  const follow = page.locator(".map-follow-toggle");
  await expect(follow).toHaveAttribute("data-follow", "true");
  await expect(map).not.toHaveAttribute("data-pan", "0,0");
  await map.dispatchEvent("pointerdown", { pointerId: 1, clientX: 200, clientY: 300 });
  await map.dispatchEvent("pointermove", { pointerId: 1, clientX: 260, clientY: 330 });
  await map.dispatchEvent("pointerup", { pointerId: 1, clientX: 260, clientY: 330 });
  await expect(follow).toHaveAttribute("data-follow", "false");
  await follow.click();
  await expect(follow).toHaveAttribute("data-follow", "true");
});

test("竖屏照片对比页改为上下排列", async ({ page, context, baseURL }) => {
  test.setTimeout(45_000);
  await context.grantPermissions(["geolocation"], { origin: new URL(baseURL!).origin });
  await context.setGeolocation({ latitude: 30.657, longitude: 104.0657, accuracy: 25 });
  await page.goto("/");
  await page.getByRole("button", { name: "开启地图" }).click();
  await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
  await openCartographer(page);
  await page.getByRole("button", { name: "强制抵达" }).click();
  await page.getByRole("button", { name: "开启照片复刻" }).click();
  const comparison = page.locator(".photo-comparison");
  await expect(comparison).toBeVisible({ timeout: 10_000 });
  const columnCount = await comparison.evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(columnCount).toBe(1);
  const refPanel = page.locator(".photo-panel").first();
  const capturePanel = page.locator(".photo-panel").last();
  const refBox = await refPanel.boundingBox();
  const captureBox = await capturePanel.boundingBox();
  expect(refBox!.y).toBeLessThan(captureBox!.y);
});

test("现场定位自检页随构建一起发出", async ({ page }) => {
  // 这页是现场读坐标的工具（见 docs/成都版-现场采集SOP）：它必须真的进 dist，
  // 否则人到点位上了才发现没工具。
  await page.goto("/geo-test.html");
  await expect(page.getByRole("heading", { name: "定位自检（Exploration Atlas）" })).toBeVisible({
    timeout: 7_000,
  });
  await expect(page.getByText("浏览器提供 geolocation")).toBeVisible();
});
