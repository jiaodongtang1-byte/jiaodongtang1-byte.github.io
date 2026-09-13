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

// 三站的文案是我代笔的走查稿（作者定稿时直接改这里即可）。
type DryRunInput = {
  id: string;
  label: string;
  location: LatLng;
  clue: string;
  unlockCopy: string;
  photoPrompt: string;
};

const dryRunCheckpoint = (input: DryRunInput): CheckpointInput => ({
  ...input,
  giftType: "sound",
  referenceImage: "/references/sound.svg",
  passScore: DRY_RUN_PASS_SCORE,
});

export const chengduZones: ExplorationZone[] = [
  defineZone({
    id: "xi-er-men",
    order: 1,
    title: "玻璃鞋 · 西二门",
    subtitle: "第一件信物",
    mysteryTitle: "第一件信物",
    mysterySubtitle: "答案还在星雾里",
    accent: "#274554",
    start: {
      label: "占位起点：水杉路一侧",
      location: { latitude: 30.7538, longitude: 103.9225 },
    },
    checkpoints: [
      dryRunCheckpoint({
        id: "cd-1",
        label: "玻璃鞋的落点",
        location: { latitude: 30.754716, longitude: 103.921708 },
        clue: "回家的路，从最不起眼的一道门开始。学校西北的那道门口，门外是热闹的街，门里是水杉路——玻璃鞋就藏在门牌附近。",
        unlockCopy: "你在这里进出过很多次，却从不知道这扇门为你留了这么久。第一件信物，玻璃鞋，收好了。",
        photoPrompt: "站在门牌旁边，拍一张能看清门头和街景的照片，人要在画面里。",
      }),
    ],
  }),
  defineZone({
    id: "zhu-lou",
    order: 2,
    title: "魔镜 · 主楼",
    subtitle: "第二件信物",
    mysteryTitle: "第二件信物",
    mysterySubtitle: "答案还在星雾里",
    accent: "#3f354a",
    start: {
      label: "占位起点：中轴线北段",
      location: { latitude: 30.7504, longitude: 103.9254 },
    },
    checkpoints: [
      dryRunCheckpoint({
        id: "cd-2",
        label: "魔镜的落点",
        location: { latitude: 30.749015, longitude: 103.925404 },
        clue: "第二件信物在中轴线上——那栋远远就能看见屋顶的大楼。走到它正前方，面朝台阶站定。魔镜会告诉你，你真正的样子。",
        unlockCopy: "魔镜说，你一直都是公主，只是今天才有人告诉你。第二件信物，魔镜，收好了。",
        photoPrompt: "站上台阶，竖构图，让整栋楼和你一起入镜。",
      }),
    ],
  }),
  defineZone({
    id: "nan-men",
    order: 3,
    title: "王国的钥匙 · 南门",
    subtitle: "第三件信物",
    mysteryTitle: "第三件信物",
    mysterySubtitle: "答案还在星雾里",
    accent: "#4c5636",
    start: {
      label: "占位起点：校区南段",
      location: { latitude: 30.75, longitude: 103.9211 },
    },
    checkpoints: [
      dryRunCheckpoint({
        id: "cd-3",
        label: "钥匙的落点",
        location: { latitude: 30.74832, longitude: 103.921109 },
        clue: "最后一件信物在南门。出这道门就是西源大道，回头能看见整片校园的轮廓——钥匙，就在你回头的方向。",
        unlockCopy: "三件信物都齐了。星图已经亮起，乐园的门在等你。",
        photoPrompt: "站在门口回身拍一张校园方向的照片。",
      }),
    ],
  }),
];

// 翻页屏文案（杭州版是自驾口径：停车、下车、翻页）。成都版三片街区之间自走或短途，
// 这里先给一版通用说法，具体措辞等策划定稿。
export const chengduFogCopy = {
  eyebrow: "TURNING THE PAGE",
  body: "这一段路已经收好。往下一站走，星图会亮起来。",
  button: "我到了，翻开下一页",
  messages: [
    "第一件信物已经收好。下一站在中轴线上，星图会告诉你。",
    "两件信物都收好了。最后一件，在你回头的方向。",
  ],
};

/** 引路人暗门：走投无路时的后门 PIN。游戏词汇，与地点无关，从杭州版沿用。 */
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
