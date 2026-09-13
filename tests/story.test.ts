import { describe, expect, it } from "vitest";
import { LETTER, STATIONS, FINALE, BETWEEN, stationGeometry } from "../src/story";
import { haversineDistance } from "../src/lib/geo";

/**
 * 配准闸门。
 *
 * 这一组断言的价值在于**抄错坐标时先炸**，而不是等当天解锁点落在马路对面。
 * 历史上真出过一次：南门偏了 262 米，而解锁半径只有 30 米。
 */

// 活动范围：成都高新西区一带。经纬写反、少一位、误抄别的城市，都会掉出这个框。
const AREA = { north: 30.79, south: 30.72, east: 103.96, west: 103.89 };

describe("站点坐标", () => {
  it("三站都落在活动范围内", () => {
    for (const station of STATIONS) {
      expect(station.location.latitude, `${station.place} 纬度`).toBeGreaterThan(AREA.south);
      expect(station.location.latitude, `${station.place} 纬度`).toBeLessThan(AREA.north);
      expect(station.location.longitude, `${station.place} 经度`).toBeGreaterThan(AREA.west);
      expect(station.location.longitude, `${station.place} 经度`).toBeLessThan(AREA.east);
    }
  });

  it("起点也落在活动范围内，且与本站不是同一个点", () => {
    for (const station of STATIONS) {
      expect(station.approach.latitude).toBeGreaterThan(AREA.south);
      expect(station.approach.latitude).toBeLessThan(AREA.north);
      expect(station.approach.longitude).toBeGreaterThan(AREA.west);
      expect(station.approach.longitude).toBeLessThan(AREA.east);
      expect(haversineDistance(station.approach, station.location)).toBeGreaterThan(20);
    }
  });

  it("站点 id 唯一，半径是能走到的量级", () => {
    const ids = STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const station of STATIONS) {
      expect(station.radiusM).toBeGreaterThanOrEqual(10);
      expect(station.radiusM).toBeLessThanOrEqual(60);
    }
  });
});

describe("地图几何（由坐标推导，不手写）", () => {
  const plate = { width: 800, height: 500 };
  const safe = { left: 344, right: 22, top: 74, bottom: 26 };

  it("目标点落在画布的安全框里——不能被任务卡压住", () => {
    for (const station of STATIONS) {
      const geom = stationGeometry(station, plate, safe);
      expect(geom.goal.x, `${station.place} goal.x`).toBeGreaterThanOrEqual(safe.left);
      expect(geom.goal.x, `${station.place} goal.x`).toBeLessThanOrEqual(plate.width - safe.right);
      expect(geom.goal.y, `${station.place} goal.y`).toBeGreaterThanOrEqual(safe.top);
      expect(geom.goal.y, `${station.place} goal.y`).toBeLessThanOrEqual(plate.height - safe.bottom);
    }
  });

  it("起点与目标不重合，路线是有效路径", () => {
    for (const station of STATIONS) {
      const geom = stationGeometry(station, plate, safe);
      const gap = Math.hypot(geom.goal.x - geom.start.x, geom.goal.y - geom.start.y);
      expect(gap, `${station.place} 起终点距离`).toBeGreaterThan(20);
      expect(geom.path.startsWith("M")).toBe(true);
      expect(geom.path).toContain("L");
    }
  });

  it("往北走的站，目标在起点上方（纬度大 = y 小）", () => {
    for (const station of STATIONS) {
      const geom = stationGeometry(station, plate, safe);
      if (station.location.latitude > station.approach.latitude + 0.0005) {
        expect(geom.goal.y, `${station.place} 应当在上方`).toBeLessThan(geom.start.y);
      }
    }
  });

  it("换一个画布比例（手机竖屏）依然成立", () => {
    const tall = { width: 390, height: 720 };
    const tallSafe = { left: 18, right: 18, top: 62, bottom: 360 };
    for (const station of STATIONS) {
      const geom = stationGeometry(station, tall, tallSafe);
      expect(geom.goal.x).toBeGreaterThanOrEqual(tallSafe.left);
      expect(geom.goal.x).toBeLessThanOrEqual(tall.width - tallSafe.right);
      expect(geom.goal.y).toBeGreaterThanOrEqual(tallSafe.top);
      expect(geom.goal.y).toBeLessThanOrEqual(tall.height - tallSafe.bottom);
    }
  });
});

describe("文案", () => {
  it("三站都有线索、解锁语和拍照要求", () => {
    for (const station of STATIONS) {
      expect(station.clue.length, station.place).toBeGreaterThan(10);
      expect(station.unlockLine.length).toBeGreaterThan(5);
      expect(station.pose.length).toBeGreaterThan(5);
      expect(station.relicName.length).toBeGreaterThan(0);
    }
  });

  it("翻页过渡少于站点数（最后一站之后直接进终章）", () => {
    expect(BETWEEN.length).toBeLessThan(STATIONS.length);
  });

  it("年岁与日期只写在 LETTER / FINALE 里", () => {
    expect(LETTER.opening).toContain("二十七");
    expect(FINALE.body).toContain("二十七岁");
    expect(FINALE.body).toContain("公主");
    expect(LETTER.footer).toContain("OCT 9");
  });
});
