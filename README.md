# 魔法城堡

给公主的生日寻宝。成都三站自走 —— **龙湖时代天街 → 成都合院 → 电子科技大学·主楼**，
用手机 GPS 靠近 30 米解锁，按提示拍一张照片，收下玻璃鞋、魔镜、王冠三件信物，
最后回到城堡看烟花。

## 怎么用

线上地址：**https://jiaodongtang1-byte.github.io/**

第一次打开会要**定位**和**相机**权限。到了起点附近点「我已到达，开始探索」，
跟着雷达走（越近滴得越急），进 30 米就出现拍照任务，拍完收下信物。

安卓安装包（手机浏览器拿不到定位时用这个，内置原生定位）：
**https://github.com/jiaodongtang1-byte/jiaodongtang1-byte.github.io/releases/download/apk-latest/ExplorationAtlas.apk**

现场读坐标：`https://jiaodongtang1-byte.github.io/geo-test.html`

## 开发

```bash
npm install
npm run dev                        # 本地开发
npm run build && npm run preview    # 预览（有 .certs 时走 https）
npm run lint && npm test           # tsc + 单测 + 构建 + PWA 契约
```

跑端到端测试前先把 `.certs/` 挪走（否则 preview 走 https、playwright 连不上），跑完挪回来：

```bash
npx playwright test
```

## 内容在哪

`src/story.ts` 是**唯一的内容源**：三站的坐标、线索、解锁语、拍照要求，以及年岁与日期。
几何（地图范围 / 路线 / 锚点）全部由坐标推导，不手写——手抄错一个数就会让解锁点落到马路对面。

坐标取自 OpenStreetMap 实名地物（WGS-84）。**出发前请用 `geo-test.html` 在三处各站一次**，
社区测绘不等同于现场实测。

## 兜底

长按地图右下角的四芒星 **3 秒**，输入 `1104` 进引路人控制台：强制抵达、强制收下、跳站、重置。

照片和进度只存在当前设备的 IndexedDB 里，不会上传。

## 插画

`public/assets/art/` 下两张公主插画为 Edmund Dulac 的公版作品，来源与授权见同目录 `CREDITS.json`。
