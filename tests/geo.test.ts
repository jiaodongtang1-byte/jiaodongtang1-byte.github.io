import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  formatDistance,
  haversineDistance,
  holdLastReliablePosition,
  isInsideCheckpoint,
  matchPositionToRoute,
  medianSample,
  mercatorLatitude,
  projectLocationToBounds,
  smoothPositionSample,
} from "../src/lib/geo";

// 夹具坐标只是成都一带的整数，不代表任何真实地点：真实点位在 src/story.ts，
// 由 tests/story.test.ts 把关。
const route = [
  { latitude: 30.657, longitude: 104.0657 },
  { latitude: 30.657, longitude: 104.0667 },
  { latitude: 30.657, longitude: 104.0677 },
];

describe("距离与方位", () => {
  it("算出可信的米数", () => {
    const distance = haversineDistance(route[0], route[1]);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(100);
  });

  it("正北是 0 度、正东是 90 度", () => {
    const origin = { latitude: 30.657, longitude: 104.0657 };
    expect(bearingDegrees(origin, { latitude: 30.667, longitude: 104.0657 })).toBeCloseTo(0, 0);
    expect(bearingDegrees(origin, { latitude: 30.657, longitude: 104.0757 })).toBeCloseTo(90, 0);
  });

  it("墨卡托纬度随纬度单调递增", () => {
    expect(mercatorLatitude(31)).toBeGreaterThan(mercatorLatitude(30));
  });
});

describe("路线匹配", () => {
  it("把旁边走过的点吸附到路线进度上", () => {
    const match = matchPositionToRoute({ latitude: 30.65702, longitude: 104.0667 }, route, route[2]);
    expect(match.progress).toBeGreaterThan(0.45);
    expect(match.progress).toBeLessThan(0.55);
    expect(match.distanceFromRouteM).toBeLessThan(4);
  });

  it("到目标的距离用的是直线距离，不绕路", () => {
    const here = { latitude: 30.657, longitude: 104.0657 };
    const match = matchPositionToRoute(here, route, route[2]);
    expect(match.distanceToCheckpointM).toBeCloseTo(haversineDistance(here, route[2]), 5);
  });
});

describe("解锁判定", () => {
  it("半径内才算到", () => {
    expect(isInsideCheckpoint(12, 8, 30, 120)).toBe(true);
    expect(isInsideCheckpoint(45, 8, 30, 120)).toBe(false);
  });

  it("定位太差一律不算到，哪怕距离是 0", () => {
    expect(isInsideCheckpoint(0, 500, 30, 120)).toBe(false);
  });

  it("精度只放宽一点边，不会把 30 米变成大范围地理围栏", () => {
    // 放宽量 = min(10, accuracy × 0.2)：精度 40 米时放宽 8 米，边界落在 38 米。
    expect(isInsideCheckpoint(37, 40, 30, 120)).toBe(true);
    expect(isInsideCheckpoint(39, 40, 30, 120)).toBe(false);
    // 精度再差也只放宽 10 米，不会滚成一个大围栏。
    expect(isInsideCheckpoint(40, 110, 30, 120)).toBe(true);
    expect(isInsideCheckpoint(41, 110, 30, 120)).toBe(false);
  });

  it("非法数值不通过", () => {
    expect(isInsideCheckpoint(Number.NaN, 5, 30)).toBe(false);
    expect(isInsideCheckpoint(5, Number.NaN, 30)).toBe(false);
    expect(isInsideCheckpoint(5, -1, 30)).toBe(false);
  });
});

describe("采样处理", () => {
  it("中位数取三轴各自的中位，不是取中间那个样本", () => {
    const median = medianSample([
      { latitude: 1, longitude: 9, accuracy: 30, timestamp: 1 },
      { latitude: 3, longitude: 5, accuracy: 5, timestamp: 2 },
      { latitude: 2, longitude: 7, accuracy: 20, timestamp: 3 },
    ]);
    expect(median).toMatchObject({ latitude: 2, longitude: 7, accuracy: 20, timestamp: 3 });
  });

  it("空数组返回 null", () => {
    expect(medianSample([])).toBeNull();
  });

  it("真正走动的点直接采用，亚米级抖动才平滑", () => {
    const previous = { latitude: 30.657, longitude: 104.0657, accuracy: 8, timestamp: 1000 };
    const walked = { latitude: 30.6571, longitude: 104.0657, accuracy: 8, timestamp: 2000 };
    expect(smoothPositionSample(previous, walked).latitude).toBeCloseTo(walked.latitude, 6);

    const jitter = { latitude: 30.657002, longitude: 104.0657, accuracy: 8, timestamp: 3000 };
    const smoothed = smoothPositionSample(previous, jitter);
    expect(smoothed.latitude).toBeGreaterThan(previous.latitude);
    expect(smoothed.latitude).toBeLessThan(jitter.latitude);
  });

  it("精度崩掉时保留上一个可信点，只更新精度", () => {
    const previous = { latitude: 30.657, longitude: 104.0657, accuracy: 8, timestamp: 1000 };
    const rejected = { latitude: 30.7, longitude: 104.1, accuracy: 300, timestamp: 2000 };
    const held = holdLastReliablePosition(previous, rejected);
    expect(held?.latitude).toBe(previous.latitude);
    expect(held?.accuracy).toBe(300);
    expect(holdLastReliablePosition(null, rejected)).toBeNull();
  });
});

describe("投影", () => {
  const bounds = { north: 30.76, south: 30.74, east: 103.94, west: 103.90 };

  it("西北角落在左上、东南角落在右下", () => {
    const nw = projectLocationToBounds({ latitude: bounds.north, longitude: bounds.west }, bounds);
    const se = projectLocationToBounds({ latitude: bounds.south, longitude: bounds.east }, bounds);
    expect(nw.x).toBeLessThan(se.x);
    expect(nw.y).toBeLessThan(se.y);
  });

  it("画布尺寸可换，竖屏画布同样成立", () => {
    const tall = projectLocationToBounds({ latitude: 30.75, longitude: 103.92 }, bounds, 390, 720);
    expect(tall.x).toBeGreaterThanOrEqual(0);
    expect(tall.x).toBeLessThanOrEqual(390);
    expect(tall.y).toBeGreaterThanOrEqual(0);
    expect(tall.y).toBeLessThanOrEqual(720);
  });
});

describe("距离文案", () => {
  it("一公里以内说米，以上说公里", () => {
    expect(formatDistance(0)).toBe("0 米");
    expect(formatDistance(840)).toBe("840 米");
    expect(formatDistance(2400)).toBe("2.4 公里");
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe("等待定位");
  });
});
