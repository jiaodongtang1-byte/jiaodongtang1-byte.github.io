import { describe, expect, it } from "vitest";
import { chengduFogCopy, chengduZones } from "@/src/config/chengduStory";
import { haversineDistance, projectPositionToMap } from "@/src/lib/geo";
import { chooseTileZoom, tilesForBounds } from "@/src/lib/tiles";

/**
 * 成都版是「只填坐标」的配置，几何全部推导。这些断言就是那道闸门：
 * 现场回传的经纬度一旦填错（抄错一位、纬度经度写反），这里会先炸，
 * 而不是等到生日当天解锁点落在马路对面。
 */
describe("chengdu story derivation", () => {
  it("keeps the route as start → every checkpoint, in order", () => {
    for (const zone of chengduZones) {
      expect(zone.coordinateSystem).toBe("wgs84");
      expect(zone.mapOrientation).toBe("north-up");
      expect(zone.routeGeo).toHaveLength(zone.checkpoints.length + 1);
      expect(haversineDistance(zone.routeGeo[0], zone.center)).toBe(0);
      // 路线最后一点必须落在最后一个探点上（与杭州版同一约定）
      const last = zone.checkpoints.at(-1)!;
      expect(haversineDistance(zone.routeGeo.at(-1)!, last.location)).toBeLessThan(0.5);
    }
  });

  it("projects every checkpoint exactly onto its derived map anchor", () => {
    for (const zone of chengduZones) {
      for (const checkpoint of zone.checkpoints) {
        const projected = projectPositionToMap(checkpoint.location, zone, checkpoint);
        expect(projected.x).toBeCloseTo(checkpoint.mapPoint.x, 0);
        expect(projected.y).toBeCloseTo(checkpoint.mapPoint.y, 0);
        // 每个探点都必须是路线锚点之一（mapPoint 直接取自锚点）
        expect(zone.mapRoutePoints).toContainEqual(checkpoint.mapPoint);
      }
    }
  });

  it("keeps the content inside the plate and clear of the floating quest card", () => {
    for (const zone of chengduZones) {
      for (const point of zone.mapRoutePoints!) {
        expect(point.x).toBeGreaterThanOrEqual(260);
        expect(point.x).toBeLessThanOrEqual(790);
        expect(point.y).toBeGreaterThanOrEqual(10);
        expect(point.y).toBeLessThanOrEqual(490);
      }
    }
  });

  it("gives every zone a tile base map that fits the tile budget", () => {
    for (const zone of chengduZones) {
      expect(zone.tileMap?.source).toBe("amap");
      const bounds = zone.mapBounds!;
      expect(bounds.north).toBeGreaterThan(bounds.south);
      expect(bounds.east).toBeGreaterThan(bounds.west);
      const zoom = zone.tileMap?.zoom ?? chooseTileZoom(bounds);
      const tiles = tilesForBounds(bounds, zone.tileMap!.source!, zoom);
      expect(tiles.length).toBeGreaterThan(0);
      expect(tiles.length).toBeLessThanOrEqual(36);
      for (const tile of tiles) {
        expect(Number.isFinite(tile.width)).toBe(true);
        expect(tile.width).toBeGreaterThan(0);
      }
    }
  });

  it("ships one fog message per zone transition", () => {
    expect(chengduFogCopy.messages).toHaveLength(chengduZones.length - 1);
    expect(chengduZones.map((zone) => zone.order)).toEqual(
      chengduZones.map((_, index) => index + 1),
    );
  });
});
