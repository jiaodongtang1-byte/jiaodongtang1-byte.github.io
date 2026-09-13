# Exploration Atlas（project-037-生日探索地图）

生日探索 PWA · **只有成都版**：龙湖时代天街 / 成都合院 / 电子科技大学清水河校区三站，
自走 + GPS 30 米解锁 + 姿势/场景拍照解锁 + 靠近雷达 + 高德瓦片底图。

## 当前状态（2026-09-13）

- **结构层已是成都版**：`src/config/chengduStory.ts` 是唯一故事源。杭州版的故事、四张手绘地图、
  彩排页、相关文档与测试已全部移出，暂存在
  `C:\claude\90归档\待确认删除\project-037-杭州版-20260912\`（git 历史里也还能找回）。
- **未完成、且必须现场数据**：三站坐标目前仍是天府广场一带的**占位值**，每站只有一个
  「占位·XX某处」探点、占位文案、参考照是 `/references/sound.svg` 通用占位图。
  要能真玩，必须回传：**每站实测 WGS-84 坐标（精度 ≤15 米）+ 每站现场实拍参考照 + 每站线索/解锁文案**。
  采集方法 `docs/成都版-现场采集SOP-2026-09-08.md`，回传表 `docs/成都版-数据回传表-2026-09-08.md`。
- **收件人专属文案仍是杭州版的**（`公主`、`XXVIII→XXIX`、终章信、开场短片标题），位于
  `ExplorationApp.tsx` / `IntroFilm.tsx` / `MapCanvas.tsx`；等作者给出成都版的称呼/年岁/终章信后替换。
  替换之前别把 App 发出去。
- 玩法词汇保留：星空地图 / 麻瓜定位 / 引路人暗门（PIN **1104**，`GM_PIN`）/ 墨点已定位 / 云雾转场。

## 部署：生日当天不能依赖这台电脑

必须托管到一个**真证书的 https 地址**——浏览器只在安全上下文（https）里给定位权限，
局域网 http 下 GPS、离线缓存、罗盘全都不可用，所以「用笔记本现场起服务」这条路已经排除。
`origin` 指向的 `aaron2000dq/aaron2000dq.github.io` **不是本机能推的仓库**：基础提交作者是
`aaron2000dq`，本机凭据是 `jiaodongtang1-byte`，推送返回 403。README 里那个
`exploration-atlas-birthday.vercel.app` 备用地址已失效（实测连不上）。要发布得先定下托管位置
（自己的仓库 / Vercel / surge 等），`vercel.json` 已按本 App 配好。

## 玩法实现要点（改动前先看）

- **成都版只填经纬度与文案**：`defineZone()` 推导 mapBounds / mapRoutePoints / svgPath / mapPoint。
  配准闸门在 `tests/chengdu.test.ts`——坐标抄错（经纬写反、少一位）它先炸，而不是等到当天解锁点落在马路对面。
- 底图是**联网瓦片**（高德 `src/lib/tiles.ts`）：瓦片角点走 zone.mapBounds 的同一套 WGS-84 投影，
  所以路线/目标点/轨迹/精度圈与底图不可能错位；高德是 GCJ-02，**索引区间也要先在 GCJ 空间算**
  （否则整片网格平移约一个瓦片）。没网自动降级成线稿并提示。
- 靠近雷达：`src/lib/radar.ts`（距离→滴声间隔/音高，纯函数）+ `useRadarBeeps`（WebAudio，
  **AudioContext 必须在手势回调里创建**，iOS 才不会一直 suspended）+ `RadarPanel`（表盘指针，
  无罗盘时退化为只响不指）。随音乐静音开关一起静音。
- 存档命名空间：默认 `chengdu-formal-v1`；走查用 `?run=test`（→ `chengdu-test…`，终章多一个
  「重新彩排」按钮）。不隔离的话，上一次走查的进度和照片会被下一次读出来（存档按 checkpoint id 分键）。

## 本机走查（只用于调试与现场读坐标）

```bash
bash tools/make-dev-cert.sh        # 自签证书写进 .certs/（已 gitignore）；换网络后重跑
npm run build && npm run preview   # https://<本机IP>:4173/
```

`public/geo-test.html` → `https://<本机IP>:4173/geo-test.html`：现场读坐标的自检页，也是判断
「**华为手机能不能拿到 GPS**」的唯一实测手段（页面直接显示 isSecureContext、权限状态、精度与判定）。
本机 Windows 之外没有别的测试设备，别的推理都不算数。

## 测试环境坑（重要）

- **本机 Windows WebKit（Playwright v2311）不可信**：fixed/gm 覆盖层按钮出现"resolved 但不可见"mass-fail；
  `git stash` 基线对照证明与原版代码无关（作者 CI 是 Ubuntu/macOS）。全量 e2e 以 GitHub Actions 为准。
- 长按是真实 3000ms 定时器（`ExplorationApp.tsx` 的 `beginCompassHold`），`phone.spec.ts` 自带的
  3.3s 真长按才是对的。
- 本机验收口径：`npm run lint` + `npm test`（单测 + 构建 + PWA 契约，目前 27 项全绿）+ phone.spec。

## 运行

```bash
npm install
npm run dev        # 本地开发
npm test           # 单测 + 构建 + PWA 契约
npx playwright install webkit   # 首次
npm run test:e2e   # 完整 e2e（本机仅部分可用，见上）
```

Python 图像脚本用 `C:/claude/.venv/Scripts/python.exe`（PIL 12.2 + numpy 2.4）。
