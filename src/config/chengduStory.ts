import { mercatorLatitude, projectLocationToBounds } from "@/src/lib/geo";
import type { Checkpoint, ExplorationZone, LatLng, MapBounds, StoryProgress } from "@/src/types";

/**
 * 成都版故事配置（2026-09-12 建）。
 *
 * 与杭州版的区别：这里**只写经纬度和文案**，其余几何量全部推导。
 * 杭州版每个 zone 要手填 mapBounds / mapRoutePoints / svgPath / mapPoint 四组数，
 * 一旦手抄错位，`npm test` 的配准断言就会失败（"画歪=解锁点错位"）。成都版把这些
 * 从坐标算出来，从构造上就不可能对不上：
 *
 *   mapBounds       ← 所有点 + 起点，外加让内容落进安全框（左侧不压任务卡）
 *   mapPoint        ← 该点经纬度经 mapBounds 投影
 *   mapRoutePoints  ← routeGeo 逐点投影
 *   svgPath         ← mapRoutePoints
 *
 * 坐标现状（2026-09-13）：三站是**走查用的近似值**（在高德瓦片网格上量的，误差几十米），
 * 目的是让作者能先真跑一遍流程；地点与实测坐标由作者定稿后替换 location 即可。
 * 现场读坐标的方法见 docs/成都版-现场采集SOP-2026-09-08.md。
 */

// 任务卡悬浮在画面左侧（left 22px，宽 292px），所以内容不能压到左边。
// 这几个数是「点位必须落在画布内」的安全框，单位是 800×500 画布坐标。
const SAFE_BOX = { left: 300, right: 760, top: 60, bottom: 440 };

// 点位过于集中时（比如都在同一栋楼门口）防止画面缩到失真：保底约 350 米视野。
const MIN_GROUND_SPAN_M = 350;
const EARTH_RADIUS_M = 6_371_000;

function inverseMercator(mercator: number) {
  return ((2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * 180) / Math.PI;
}

function deriveBounds(points: LatLng[]): MapBounds {
  const longitudes = points.map((point) => point.longitude);
  const mercators = points.map((point) => mercatorLatitude(point.latitude));
  const meanLatitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
  const degreePerMeter = 1 / (EARTH_RADIUS_M * (Math.PI / 180) * Math.cos((meanLatitude * Math.PI) / 180));
  const mercatorPerMeter = 1 / (EARTH_RADIUS_M * Math.cos((meanLatitude * Math.PI) / 180));

  const west0 = Math.min(...longitudes);
  const longitudeSpan = Math.max(
    Math.max(...longitudes) - west0,
    MIN_GROUND_SPAN_M * degreePerMeter,
  );
  const north0 = Math.max(...mercators);
  const mercatorSpan = Math.max(
    north0 - Math.min(...mercators),
    MIN_GROUND_SPAN_M * mercatorPerMeter,
  );

  // 让点位横向占满安全框宽度、纵向占满安全框高度，再多出来的部分留白。
  const width = (longitudeSpan * 800) / (SAFE_BOX.right - SAFE_BOX.left);
  const height = (mercatorSpan * 500) / (SAFE_BOX.bottom - SAFE_BOX.top);
  const west = west0 - (SAFE_BOX.left / 800) * width;
  const north = north0 + (SAFE_BOX.top / 500) * height;
  return {
    west,
    east: west + width,
    north: inverseMercator(north),
    south: inverseMercator(north - height),
  };
}

type CheckpointInput = Omit<Checkpoint, "mapPoint" | "unlockRadiusM" | "matchMode" | "passScore"> &
  Partial<Pick<Checkpoint, "unlockRadiusM" | "matchMode" | "passScore">>;

type ZoneInput = {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  mysteryTitle?: string;
  mysterySubtitle?: string;
  accent: string;
  /** 进入本区域的第一站（起点说明写在卡片上，不是停车位）。 */
  start: { label: string; location: LatLng };
  /** 按到访顺序排列；路线即「起点 → 各点」。 */
  checkpoints: CheckpointInput[];
  /** 现场实测后用显式边界覆盖自动推导（一般不填）。 */
  mapBounds?: MapBounds;
};

function defineZone(input: ZoneInput): ExplorationZone {
  const routeGeo = [input.start.location, ...input.checkpoints.map((item) => item.location)];
  const mapBounds = input.mapBounds ?? deriveBounds(routeGeo);
  const mapRoutePoints = routeGeo.map((point) => {
    const projected = projectLocationToBounds(point, mapBounds);
    return { x: Number(projected.x.toFixed(1)), y: Number(projected.y.toFixed(1)) };
  });
  return {
    id: input.id,
    order: input.order,
    title: input.title,
    subtitle: input.subtitle,
    mysteryTitle: input.mysteryTitle,
    mysterySubtitle: input.mysterySubtitle,
    parkingLabel: input.start.label,
    parkingMapPoint: mapRoutePoints[0],
    center: input.start.location,
    coordinateSystem: "wgs84",
    routeGeo,
    mapRoutePoints,
    svgPath: mapRoutePoints
      .map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`)
      .join(" "),
    // 城区楼间 GPS 精度明显差于空旷地带，比杭州正式版的 200m 收紧一档，
    // 避免一个粗定位就把墨点推着走。
    maxLocationAccuracyM: 120,
    accent: input.accent,
    mapKind: "city",
    mapOrientation: "north-up",
    mapBounds,
    tileMap: { source: "amap" },
    checkpoints: input.checkpoints.map((item, index) => ({
      matchMode: "pose-scene",
      passScore: 55,
      unlockRadiusM: 30,
      ...item,
      // routeGeo[0] 是起点，所以第 index 个探点对应 routeGeo[index + 1]
      mapPoint: mapRoutePoints[index + 1],
    })),
  };
}

// ⚠️ 走查用的近似坐标（2026-09-13 建）：从高德瓦片网格上量出来的，误差可能有几十米。
// 现场实测回来的真值直接换掉下面的 location 即可（配准由 defineZone 推导，不会错位）。
// 走查完把 passScore 改回 55（参考照拍好之前先不卡分数）。
const DRY_RUN_PASS_SCORE = 0;

const dryRunCheckpoint = (id: string, label: string, location: LatLng): CheckpointInput => ({
  id,
  label,
  giftType: "sound",
  location,
  clue: "占位线索：换成你要给的提示语。",
  unlockCopy: "占位解锁文案：换成真实的这一关要说什么。",
  photoPrompt: "复刻学长（制图人）的显影照片。",
  referenceImage: "/references/sound.svg",
  passScore: DRY_RUN_PASS_SCORE,
});

export const chengduZones: ExplorationZone[] = [
  defineZone({
    id: "day-tian-jie",
    order: 1,
    title: "龙湖时代天街",
    subtitle: "第一站 · 走查占位",
    mysteryTitle: "第一枚坐标",
    mysterySubtitle: "答案还在雾里",
    accent: "#274554",
    start: {
      label: "占位起点：天街南侧路面",
      location: { latitude: 30.7546, longitude: 103.9235 },
    },
    checkpoints: [
      dryRunCheckpoint("cd-1", "时代天街 · 待定到达点", {
        latitude: 30.755514,
        longitude: 103.923506,
      }),
    ],
  }),
  defineZone({
    id: "he-yuan",
    order: 2,
    title: "成都合院",
    subtitle: "第二站 · 走查占位",
    mysteryTitle: "第二枚坐标",
    mysterySubtitle: "答案还在雾里",
    accent: "#3f354a",
    start: {
      label: "占位起点：合院北侧路口",
      location: { latitude: 30.7468, longitude: 103.9201 },
    },
    checkpoints: [
      dryRunCheckpoint("cd-2", "成都合院 · 待定到达点", {
        latitude: 30.745922,
        longitude: 103.92011,
      }),
    ],
  }),
  defineZone({
    id: "qing-shui-he",
    order: 3,
    title: "电子科技大学清水河校区",
    subtitle: "第三站 · 走查占位",
    mysteryTitle: "第三枚坐标",
    mysterySubtitle: "答案还在雾里",
    accent: "#4c5636",
    start: {
      label: "占位起点：西源大道一侧",
      location: { latitude: 30.7494, longitude: 103.9268 },
    },
    checkpoints: [
      dryRunCheckpoint("cd-3", "清水河校区 · 待定到达点", {
        latitude: 30.749413,
        longitude: 103.9277,
      }),
    ],
  }),
];

// 翻页屏文案（杭州版是自驾口径：停车、下车、翻页）。成都版三片街区之间自走或短途，
// 这里先给一版通用说法，具体措辞等策划定稿。
export const chengduFogCopy = {
  eyebrow: "TURNING THE PAGE",
  body: "这一页已经收好。走到下一个入口，再让下一页从云雾中显形。",
  button: "我到了，翻开下一页",
  messages: [
    "第一站已经收好。下一个地方，地图会告诉你。",
    "两站都收好了。最后一程在同一片街区里连续显形。",
  ],
};

/** 制图人暗门：走投无路时的后门 PIN。游戏词汇，与地点无关，从杭州版沿用。 */
export const GM_PIN = "1104";

/** 存档初始值：从本文件的 zone 推导，不手写 id（改点/换点不会漏改存档）。 */
export const initialProgress: StoryProgress = {
  activeZoneId: chengduZones[0].id,
  activeCheckpointId: chengduZones[0].checkpoints[0].id,
  completedCheckpointIds: [],
  photoAttempts: {},
  capturedPhotoIds: [],
  phase: "intro",
  zoneStarted: false,
  arrivedCheckpointIds: [],
};
