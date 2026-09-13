import { describe, expect, it } from "vitest";
import { chooseTileZoom, tileX, tileY, tilesForBounds } from "@/src/lib/tiles";
import { gcj02ToWgs84Approx, wgs84ToGcj02 } from "@/src/lib/coordinateTransform";
import { haversineDistance } from "@/src/lib/geo";
import type { MapBounds } from "@/src/types";

// 成都一带的任意范围（夹具，不代表真实点位；真实点位在 src/config/chengduStory.ts）
const bounds: MapBounds = { north: 30.6578, south: 30.6554, west: 104.0647, east: 104.0687 };

describe("web mercator tile grid", () => {
  it("matches the canonical slippy-map anchors", () => {
    // 标准锚点：z=1 时经度 0 → 列 1；纬度 0 → 行 1；极点边界落在首/末行
    expect(tileX(0, 1)).toBe(1);
    expect(tileX(-180, 1)).toBe(0);
    expect(tileX(179.999, 1)).toBe(1);
    expect(tileY(0, 1)).toBe(1);
    expect(tileY(85.0511, 18)).toBe(0);
    expect(tileY(-85.0511, 18)).toBe(2 ** 18 - 1);
    // 纬度越高行号越小（north-up 网格 y 向南增长）
    expect(tileY(31, 18)).toBeLessThan(tileY(30, 18));
    expect(tileY(30, 18)).toBeLessThan(tileY(29, 18));
  });

  it("lays tiles edge to edge across the zone so the base map has no gaps", () => {
    const zoom = 18;
    const tiles = tilesForBounds(bounds, "osm", zoom);
    expect(tiles).toHaveLength(
      (tileX(bounds.east, zoom) - tileX(bounds.west, zoom) + 1) *
        (tileY(bounds.south, zoom) - tileY(bounds.north, zoom) + 1),
    );

    // 每块瓦片宽度 = 800 × (瓦片经度跨距 / 区域经度跨距)
    const expectedWidth = (800 * (360 / 2 ** zoom)) / (bounds.east - bounds.west);
    for (const tile of tiles) {
      expect(tile.width).toBeCloseTo(expectedWidth, 1);
      expect(tile.width).toBeGreaterThan(200); // 一块瓦片应占画布约三分之一宽
      expect(tile.height).toBeGreaterThan(0);
    }

    // 同一行的相邻两列必须首尾相接（无重叠、无空隙）
    const row = tiles.filter((tile) => tile.row === tiles[0].row).sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index += 1) {
      const gap = row[index].x - (row[index - 1].x + row[index - 1].width);
      expect(Math.abs(gap)).toBeLessThan(0.01);
    }
  });

  it("derives a mainland provider's grid in GCJ-02, not in WGS-84", () => {
    const zoom = 18;
    const osm = tilesForBounds(bounds, "osm", zoom);
    const amap = tilesForBounds(bounds, "amap", zoom);
    // 高德的格网建在 GCJ-02 上，所以列/行号必然与 WGS-84 的格网不同（偏移方向随
    // 经纬度变化，这里只断言「确实错开了」）；少了这一步，整片瓦片会平移约一个
    // 瓦片（≈130 m），底图与解锁点就会对着错位。
    expect(amap[0].column !== osm[0].column || amap[0].row !== osm[0].row).toBe(true);

    // 但两者覆盖的仍应是同一片地面：转换后的画布范围必须几乎重合
    const span = (list: typeof osm) => ({
      left: Math.min(...list.map((tile) => tile.x)),
      right: Math.max(...list.map((tile) => tile.x + tile.width)),
      top: Math.min(...list.map((tile) => tile.y)),
      bottom: Math.max(...list.map((tile) => tile.y + tile.height)),
    });
    const osmSpan = span(osm);
    const amapSpan = span(amap);
    expect(Math.abs(amapSpan.left - osmSpan.left)).toBeLessThanOrEqual(amap[0].width);
    expect(Math.abs(amapSpan.top - osmSpan.top)).toBeLessThanOrEqual(amap[0].height);
    const overlapX =
      Math.min(amapSpan.right, osmSpan.right) - Math.max(amapSpan.left, osmSpan.left);
    expect(overlapX).toBeGreaterThan(amap[0].width);
  });

  it("keeps the grid within the tile budget", () => {
    const zoom = chooseTileZoom(bounds, 36);
    const columns = tileX(bounds.east, zoom) - tileX(bounds.west, zoom) + 1;
    const rows = tileY(bounds.south, zoom) - tileY(bounds.north, zoom) + 1;
    expect(columns * rows).toBeLessThanOrEqual(36);
    // 该区域足够小，应取到允许的最细一级
    expect(zoom).toBe(18);
  });

  it("round-trips a mainland GCJ-02 shift without drifting", () => {
    const wgs = { latitude: 30.657, longitude: 104.0657 };
    // 近似逆变换必须把点送回原处（1 米内），否则瓦片角点会逐年累偏
    expect(haversineDistance(gcj02ToWgs84Approx(wgs84ToGcj02(wgs)), wgs)).toBeLessThan(1);
    // 偏移量级：几百米，不是几十米也不是几公里
    const shiftM = haversineDistance(wgs84ToGcj02(wgs), wgs);
    expect(shiftM).toBeGreaterThan(100);
    expect(shiftM).toBeLessThan(1000);
  });
});
