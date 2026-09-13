import { mercatorLatitude, projectLocationToBounds } from "@/src/lib/geo";
import type { LatLng, MapBounds } from "@/src/types";
import type { RelicKind } from "@/src/kit/Relic";

/**
 * 故事内容（2026-09-13 从头重写）。
 *
 * 这里只有**数据**：三站走哪儿、说什么、拍什么姿势。几何全部由坐标推导，
 * 手不写边界框——抄错一个数就会让解锁点落到马路对面，而推导出来的对不上从来不会。
 *
 * 坐标取自 OpenStreetMap 实名地物（WGS-84，与运行时同一坐标系）。
 * ⚠️ OSM 是社区测绘，**出发前用 geo-test.html 在三处各站一次**才算数。
 */

export type Station = {
  id: string;
  /** 信物名 */
  relic: RelicKind;
  relicName: string;
  /** 地点名，卡片标题用 */
  place: string;
  /** 这一站之前从哪儿走过来（地图起点，也是路线第一段） */
  approach: LatLng;
  location: LatLng;
  clue: string;
  unlockLine: string;
  pose: string;
  radiusM: number;
};

/** 收件人专属文案。改这里就能换人称、年岁与日期。 */
export const LETTER = {
  eyebrow: "A LETTER FROM THE CASTLE",
  title: "城堡的灯一直亮着",
  opening: "这封信走了二十七年。",
  body: "你不是普通人——你是被寄养在人间的公主。<br/>城堡的灯没有熄过，只差三件信物，就能全部点亮。",
  button: "打开信封 · 出发",
  footer: "OCT 9 · 2026 · FOR THE PRINCESS",
} as const;

export const STATIONS: Station[] = [
  {
    id: "glass-slipper",
    relic: "slipper",
    relicName: "玻璃鞋",
    place: "龙湖时代天街",
    approach: { latitude: 30.7556, longitude: 103.9196 },
    location: { latitude: 30.754618, longitude: 103.920084 }, // OSM 购物广场 way/543806921
    clue: "从最热闹的地方开始。天街的灯比别处亮，因为那是通往城堡的第一段路。站到广场中间、能一眼看完整条天街的位置——玻璃鞋就留在那儿。",
    unlockLine: "第一件信物，玻璃鞋。穿得上它的人，本来就该回家。",
    pose: "站在广场中间，拍一张能看见天街招牌和你自己的照片。",
    radiusM: 30,
  },
  {
    id: "magic-mirror",
    relic: "mirror",
    relicName: "魔镜",
    place: "成都合院",
    approach: { latitude: 30.7502, longitude: 103.9185 },
    location: { latitude: 30.746403, longitude: 103.918538 }, // OSM 成都合院 way/543052123
    clue: "第二件在一条安静得多的街上。合院门口没有灯，但魔镜不需要灯——它会告诉你，你真正的样子。走到院门口站定。",
    unlockLine: "魔镜说，你一直都是公主，只是今天才有人当着你的面讲出来。",
    pose: "站在院门口，回身面向来路拍一张。",
    radiusM: 30,
  },
  {
    id: "royal-crown",
    relic: "crown",
    relicName: "王冠",
    place: "电子科技大学 · 主楼",
    approach: { latitude: 30.7512, longitude: 103.9222 },
    location: { latitude: 30.749073, longitude: 103.925117 }, // OSM 主楼 way/687370083
    clue: "最后一件在主楼前。穿过校门往中轴线走，那栋远远就能看见屋顶的大楼就是。走到它正前方，面朝台阶站定。",
    unlockLine: "三件信物齐了。城堡的灯，全亮了。",
    pose: "站上台阶，竖构图，让整栋楼和你一起入镜。",
    radiusM: 30,
  },
];

export const FINALE = {
  eyebrow: "YOU ARE HOME",
  title: "城堡的灯，全亮了",
  body: "你到家了。<br/>城堡的灯为你亮起来的时候，所有的星星都排好了队。<br/>从今天起，你可以去任何想去的地方——因为公主本来就该被这样对待。<br/><b>二十七岁生日快乐，我的公主。</b>",
  footer: "THE CASTLE WILL REMEMBER",
} as const;

/** 翻页过渡（两站之间的路上） */
export const BETWEEN = [
  { eyebrow: "KEEP WALKING", body: "第一件信物收好了。下一站在一条安静的街上，星图会指给你。", button: "我到了，继续" },
  { eyebrow: "ALMOST THERE", body: "只剩最后一件了。往学校的中轴线走，城堡的灯已经亮了大半。", button: "我到了，继续" },
] as const;

/** 引路人暗门：走投无路时的后门 PIN。 */
export const GUIDE_PIN = "1104";

/* ---------- 几何：只从坐标推导，不手写 ---------- */

export type Plate = { width: number; height: number };
/** 内容必须落进的安全框（画布坐标），挡住任务卡压住的那一侧。 */
export type SafeBox = { left: number; right: number; top: number; bottom: number };

// 点位过于集中时防止画面缩到失真：保底约 400 米视野。
const MIN_SPAN_M = 400;
const EARTH_R = 6_371_000;

function inverseMercator(mercator: number) {
  return ((2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) * 180) / Math.PI;
}

/**
 * 把 route 上的点撑满安全框。
 * 画布比例是跟着容器走的（手机是竖的、平板是横的），所以不能写死 800×500——
 * 那正是旧版在竖屏手机上把地图切成一条的原因。
 */
function deriveBounds(points: LatLng[], plate: Plate, safe: SafeBox): MapBounds {
  const usableW = Math.max(60, plate.width - safe.left - safe.right);
  const usableH = Math.max(60, plate.height - safe.top - safe.bottom);

  const lngs = points.map((p) => p.longitude);
  const mercs = points.map((p) => mercatorLatitude(p.latitude));
  const meanLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const degPerM = 1 / (EARTH_R * (Math.PI / 180) * Math.cos((meanLat * Math.PI) / 180));
  const mercPerM = 1 / (EARTH_R * Math.cos((meanLat * Math.PI) / 180));

  const west0 = Math.min(...lngs);
  const lngSpan = Math.max(Math.max(...lngs) - west0, MIN_SPAN_M * degPerM);
  const north0 = Math.max(...mercs);
  const mercSpan = Math.max(north0 - Math.min(...mercs), MIN_SPAN_M * mercPerM);

  const width = (lngSpan * plate.width) / usableW;
  const height = (mercSpan * plate.height) / usableH;
  const west = west0 - (safe.left / plate.width) * width;
  const north = north0 + (safe.top / plate.height) * height;
  return {
    west,
    east: west + width,
    north: inverseMercator(north),
    south: inverseMercator(north - height),
  };
}

export type StationGeometry = {
  station: Station;
  bounds: MapBounds;
  plate: Plate;
  /** 上一站走过来的起点 */
  start: { x: number; y: number };
  /** 目标点 */
  goal: { x: number; y: number };
  path: string;
};

/** 每站单独一张图：视野只框住"上一站走过来 → 本站"。 */
export function stationGeometry(station: Station, plate: Plate, safe: SafeBox): StationGeometry {
  const route = [station.approach, station.location];
  const bounds = deriveBounds(route, plate, safe);
  const project = (p: LatLng) => {
    const { x, y } = projectLocationToBounds(p, bounds, plate.width, plate.height);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  };
  const start = project(station.approach);
  const goal = project(station.location);
  return { station, bounds, plate, start, goal, path: `M${start.x} ${start.y} L${goal.x} ${goal.y}` };
}

/** 存档用。 */
export const STORY = {
  stations: STATIONS,
  firstId: STATIONS[0].id,
} as const;
