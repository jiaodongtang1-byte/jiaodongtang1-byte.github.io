// 一次性终检：直接打线上地址，手机/平板走一遍，确认能正常显示与交互。用完即删。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = "https://jiaodongtang1-byte.github.io/";
const out = "design/线上终检-20260913";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const problems = [];

for (const [name, viewport] of [
  ["手机", { width: 390, height: 844 }],
  ["平板", { width: 1024, height: 768 }],
  ["平板竖屏", { width: 768, height: 1024 }],
]) {
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 1.4, locale: "zh-CN",
    permissions: ["geolocation"],
    geolocation: { latitude: 30.754716, longitude: 103.921708, accuracy: 12 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(base, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-01-封面.png` });

  // 平板竖屏被旋转墙挡在前面，短片根本不会出现
  if (viewport.height > viewport.width && viewport.width >= 600) {
    await page.locator(".rotate-notice").waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}-00-旋转墙.png` });
    console.log(name, "→ 竖屏旋转墙（设计如此）", errors.length ? `错误 ${errors.length}: ${errors[0]}` : "无报错");
    if (errors.length) problems.push([name, errors.slice(0, 3)]);
    await context.close();
    continue;
  }

  await page.getByRole("button", { name: /开始接收邀请/ }).click();
  await page.waitForTimeout(11000);
  await page.screenshot({ path: `${out}/${name}-02-绘本.png` });

  const skip = page.locator(".intro-film-skip");
  if (await skip.count()) await skip.click();
  await page.getByRole("button", { name: "开启地图" }).waitFor({ timeout: 20000 });

  if (viewport.height > viewport.width && viewport.width >= 600) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}-03-旋转墙.png` });
    console.log(name, "→ 竖屏旋转墙（设计如此）", errors.length ? `错误 ${errors.length}` : "无报错");
    if (errors.length) problems.push([name, errors.slice(0, 3)]);
    await context.close();
    continue;
  }

  await page.screenshot({ path: `${out}/${name}-03-信封.png` });
  await page.getByRole("button", { name: "开启地图" }).click();
  await page.getByRole("button", { name: "我已到达，开始探索" }).click();
  await page.locator(".quest-card.floating-quest-card").waitFor({ timeout: 20000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${name}-04-地图.png` });
  console.log(name, errors.length ? `错误 ${errors.length}: ${errors[0]}` : "无报错");
  if (errors.length) problems.push([name, errors.slice(0, 3)]);
  await context.close();
}
await browser.close();
console.log(problems.length ? `\n有问题：\n${JSON.stringify(problems, null, 2)}` : "\n三种设备线上均无 JS 报错");
