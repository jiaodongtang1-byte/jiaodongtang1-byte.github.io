# 魔法城堡（project-037-生日探索地图）

给作者对象的生日寻宝 PWA。成都三站自走：**龙湖时代天街 → 成都合院 → 电子科技大学·主楼**，
每站用 GPS 靠近解锁（30 米）+ 按提示拍一张照片，收下一件信物（玻璃鞋 / 魔镜 / 王冠），
最后回到城堡看烟花。收件人称「公主」，27 岁，生日 **10 月 9 日**。

**2026-09-13 从头重写**：旧版是「羊皮纸骨架 + 夜色覆盖层 + 哈利波特元素」，已整体废弃。
**2026-09-14 改为明亮公主风**：柔光天 + 白卡片 + 深紫字（浅底深字，户外日光下更清楚）。
全套配色只在 `theme.css` 的令牌里，换风格改那一处。

## 架构：地基保留，界面层全部新写

```
src/lib/        ← 保留。现场验证过的地基，别重写
  coordinateTransform  WGS-84 ↔ GCJ-02（高德瓦片是 GCJ-02）
  geo                  距离/方位/投影/解锁判定/采样平滑
  tiles                瓦片索引与画布落位（注意 plateWidth/Height 参数）
  radar                滴声间隔与音高
  storage              IndexedDB 存档（分命名空间）
  photoMatch           照片比对（比对时可调 mediapipe 姿态）
src/hooks/      ← 保留。定位 / 罗盘 / 雷达滴声 / 背景音乐
src/styles/     ← theme.css（令牌 + 积木）+ screens.css（各屏布局）
src/kit/        ← Sky / Castle+Fireworks / Relic / Dial，纯视觉积木
src/story.ts    ← 唯一的**内容源**：站点、文案、年岁、以及几何推导
src/progress.ts ← 存档初始值
src/screens/    ← Cover / Storybook / Hunt / Capture / Reveal / Finale / Guide
android/        ← 保留。安卓壳 + 原生 GPS 注入
```

**为什么地基不重写**：国产安卓没有谷歌服务，浏览器拿不到定位，安卓壳的原生 GPS 注入是唯一解，
已经跑通并出包；瓦片坐标换算与解锁判定也是现场验证过的。重写这些换不来观感，赌的是当天能不能用。

## 玩法与关键实现

- **到达判定**：连续 **2 次**进入半径才算抵达（`ARRIVE_STREAK`），一个飘点不会把信物送出去。
  精度差于 `MAX_ACCURACY_M`（120 米）一律不算——`isInsideCheckpoint` 里精度只放宽
  `min(10, 精度×0.2)` 米，不会把 30 米变成大范围围栏。
- **地图**：画布尺寸**跟着容器走**（`stationGeometry(station, plate, safe)`），竖屏手机不会被
  压成一条。`tilesForBounds(..., plateWidth, plateHeight)` 必须传画布尺寸——它默认 800×500，
  不传就会让瓦片与标记错位。底图**不要反相**——反相是夜图做法，跟柔光天打架。
- **瓦片样式用 `webrd` + `style=7`，不要 `style=8`**。同一家高德、同一套 URL，只差一个参数：
  `style=8` 是带满 POI 图标与商户名的完整底图（火锅店、便利店、`P` 停车场图标全在上头），
  地图会密到自己的「出发点」标记被「海底捞」压住；`style=7` 是只有路网与路名的安静版本，
  正好当一张绘本地图。**别用 `contrast()` 去救它**：这套瓦片本身是高调的（像素值几乎全在
  235–255），`contrast(1.3)` 就把底色推过 255 全部削平，再经 `mix-blend-mode: color` 一染
  就成一张纯白纸——瓦片的路全没了。要提清晰度只能靠亮度与染色，不能靠对比度。
- **安全框**：内容要避开任务卡压住的那一侧，且边距里要**算上标记自身半径**（目标圈 r=46）。
- **拍照**：没有现场参考照的站只做记录、不打分（拿插画比对真人没有意义）。要开评分，
  给 `Station` 加 `referenceSrc` 即可，`Capture` 会自动走 `scorePhoto`。
- **存档命名空间**：`?run=test` 走查用，独立存档，终章多一个「重新走一遍」。

## 坐标：来自 OpenStreetMap 实名地物

WGS-84，与运行时同坐标系。**不要靠看瓦片数格子取数**——上一版南门就是这么偏了 **262 米**，
而解锁半径只有 30 米。取法：

```bash
curl -s -X POST --data-urlencode 'data=[out:json][timeout:60];
(node["name"](30.740,103.912,30.762,103.942);way["name"](30.740,103.912,30.762,103.942););out center tags;' \
  https://overpass-api.de/api/interpreter -o osm.json
```

备查：天街购物广场 30.754618,103.920084（way/543806921）／成都合院 30.746403,103.918538
（way/543052123）／主楼 30.749073,103.925117（way/687370083）。另：西二门 30.754845,103.921800
（node/2271615612）／南门 30.746551,103.922913（node/2271614699）／时间广场 30.751917,103.927456。

⚠️ OSM 是社区测绘，**出发前用 `geo-test.html` 在三处各站一次**才算数。
`tests/story.test.ts` 是配准闸门：坐标抄错（经纬写反、少一位、抄到别的城市）它先炸。

## 发布

`origin` = `jiaodongtang1-byte/jiaodongtang1-byte.github.io`，
https://jiaodongtang1-byte.github.io/ 是验收地址。
⚠️ 远端是**无历史的压缩分支**，`git push origin main` 必报 behind，正确推法：

```bash
git fetch origin
NEW=$(git commit-tree HEAD^{tree} -p origin/main -m "$(git log -1 --format=%B HEAD)")
git push origin "$NEW:refs/heads/main"
```

APK 由 GH Actions「Build Android APK」出，rolling release tag `apk-latest`。

## 本机走查与测试

```bash
npm run dev                    # 本地开发
npm run build && npm run preview   # 预览（.certs 存在时走 https）
npm run lint && npm test       # tsc + 单测 + 构建 + PWA 契约
```

- ⚠️ **跑 e2e 前先把 `.certs/` 挪走**，否则 `vite preview` 走 https、playwright 配的是
  `http://127.0.0.1:4187`，会全挂并报 `Server returned nothing`。跑完挪回来。
- 本机 Windows WebKit 多数情况可信（改版后 6/6 通过），但 CI 仍是权威。
- `public/geo-test.html` 是现场读坐标的工具，`phone.spec.ts` 里有一条断言盯着它必须进 dist。

## 踩过的坑（改前先看）

- **绝对定位的兄弟会画在静态内容上面**，不管 DOM 顺序。所以天空用**负 z-index** 沉下去
  （`.screen { isolation: isolate }` + `.sky { z-index: -4 }`），**不要**去把内容抬起来——
  给 `.screen > *` 加 `position: relative` 会把 `.hunt-map` 的 `absolute` 一起改掉，地图当场塌成一条。
  **新加的装饰层记得排进 `theme.css` 末尾那张分层表**——`.ground` 当初漏了，把城堡整个盖住了。
- **染色用 `mix-blend-mode: color`，不要盖半透明色块**。`color` 只接管色相与饱和、保留瓦片
  自己的明度，路网结构原样留住；盖半透明色会把明度一起抬平，路就糊成一片奶油色。
  用它时**渐变 stop 必须不透明**——stop 带 alpha 会被当成普通半透明覆盖，瓦片自己的绿色
  （公园、草地）就透上来了，怎么调都压不干净。
- **`opacity: 0` 对读屏和自动化都仍算「可见」**。绘本未翻到的页要 `visibility: hidden`。
- **关键帧里带 `filter` 的动画会盖掉静态 `filter`**，给元素转色时要连 `animation` 一起换。
- **玻璃鞋的 SVG 侧影试了九稿才读得出是鞋**——改 `src/kit/Relic.tsx` 里那段 path 前先单独渲染看一眼。
- **城堡的塔要宽大于高**，早先塔瘦窗大，整座城读起来像一排栅栏。
- **奶白城堡压在奶油色天上会整个化掉**。亮色主题下塔身要用比天空深一档的淡紫 +
  重描边，脚下垫一层柔坡，再加投影——不然招牌画面等于隐身。

## 插画

`public/assets/art/` 两张公主插画是 **Edmund Dulac 的公版作品**（黄金时代童话插画），
来源与授权见同目录 `CREDITS.json`。暖色调装在 `.plate` 烫金画框里当"一页彩插"。
**不要往仓库里放迪士尼角色本身的图**：仓库是公开的（Pages 免费版只能公开），公开即发布。
