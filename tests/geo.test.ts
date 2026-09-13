import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  haversineDistance,
  holdLastReliablePosition,
  isInsideCheckpoint,
  matchPositionToRoute,
  medianSample,
  projectHeadingToMap,
  projectPositionToMap,
  smoothPositionSample,
} from "../src/lib/geo";
import { chengduZones } from "../src/config/chengduStory";

// 夹具坐标只是成都一带的整数，不代表任何真实地点：真实点位只在
// src/config/chengduStory.ts 里，由现场实测回填（成都版的配准闸门在 chengdu.test.ts）。
const route = [
  { latitude: 30.657, longitude: 104.0657 },
  { latitude: 30.657, longitude: 104.0667 },
  { latitude: 30.657, longitude: 104.0677 },
];

describe("geographic matching", () => {
  it("computes useful meter distances", () => {
    const distance = haversineDistance(route[0], route[1]);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(100);
  });

  it("snaps a nearby position to route progress", () => {
    const match = matchPositionToRoute(
      { latitude: 30.65702, longitude: 104.0667 },
      route,
      route[2],
    );
    expect(match.progress).toBeGreaterThan(0.45);
    expect(match.progress).toBeLessThan(0.55);
    expect(match.distanceFromRouteM).toBeLessThan(4);
  });

  it("uses median values to suppress a location spike", () => {
    const sample = medianSample([
      { latitude: 30.657, longitude: 104.0657, accuracy: 20, timestamp: 1 },
      { latitude: 31.5, longitude: 121.0, accuracy: 900, timestamp: 2 },
      { latitude: 30.6571, longitude: 104.0658, accuracy: 22, timestamp: 3 },
    ]);
    expect(sample?.latitude).toBeCloseTo(30.6571);
    expect(sample?.accuracy).toBe(22);
  });

  it("keeps the 30 metre geofence tight while allowing a small accuracy edge", () => {
    expect(isInsideCheckpoint(39, 80, 30)).toBe(true);
    expect(isInsideCheckpoint(41, 80, 30)).toBe(false);
    expect(isInsideCheckpoint(0, 500, 30, 200)).toBe(false);
    expect(isInsideCheckpoint(0, Number.NaN, 30, 200)).toBe(false);
  });

  it("derives a geographic walking direction when GPS has no compass heading", () => {
    expect(bearingDegrees(route[0], route[1])).toBeCloseTo(90, 1);
    expect(
      bearingDegrees(route[0], {
        latitude: route[0].latitude + 0.001,
        longitude: route[0].longitude,
      }),
    ).toBeCloseTo(0, 1);
  });

  it("freezes at the last reliable coordinate when a coarse sample arrives", () => {
    const previous = { latitude: 30.657, longitude: 104.0657, accuracy: 24, timestamp: 1 };
    const held = holdLastReliablePosition(previous, {
      latitude: 30.66,
      longitude: 104.09,
      accuracy: 500,
      timestamp: 2,
    });
    expect(held?.latitude).toBe(previous.latitude);
    expect(held?.longitude).toBe(previous.longitude);
    expect(held?.accuracy).toBe(500);
    expect(held?.timestamp).toBe(2);
    expect(holdLastReliablePosition(null, { ...previous, accuracy: 500 })).toBeNull();
  });

  it("responds immediately to meaningful movement without a five-sample freeze", () => {
    const previous = { latitude: 30.657, longitude: 104.0657, accuracy: 35, timestamp: 1, heading: 180 };
    const next = { latitude: 30.6572, longitude: 104.0657, accuracy: 35, timestamp: 2 };
    const smoothed = smoothPositionSample(previous, next);
    expect(smoothed.latitude).toBe(next.latitude);
    expect(smoothed.timestamp).toBe(2);
    expect(smoothed.heading).toBe(180);
  });
});

describe("chengdu zone projection", () => {
  it("projects every WGS route anchor onto its derived map anchor", () => {
    for (const zone of chengduZones) {
      const checkpoint = zone.checkpoints[0];
      zone.routeGeo.forEach((anchor, index) => {
        const point = projectPositionToMap(anchor, zone, checkpoint);
        // 锚点存的是 toFixed(1) 的结果，所以容差就是那半步（0.05 画布像素）
        expect(Math.abs(point.x - zone.mapRoutePoints![index].x)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(point.y - zone.mapRoutePoints![index].y)).toBeLessThanOrEqual(0.05);
      });
    }
  });

  it("keeps north-up on the live projection: 往北走，画布上往上走", () => {
    for (const zone of chengduZones) {
      const checkpoint = zone.checkpoints[0];
      const here = checkpoint.location;
      const north = { latitude: here.latitude + 0.0005, longitude: here.longitude };
      const east = { latitude: here.latitude, longitude: here.longitude + 0.0005 };
      const herePoint = projectPositionToMap(here, zone, checkpoint);
      expect(projectPositionToMap(north, zone, checkpoint).y).toBeLessThan(herePoint.y);
      expect(projectPositionToMap(east, zone, checkpoint).x).toBeGreaterThan(herePoint.x);
    }
  });

  it("keeps every zone a north-up WGS-84 map with one anchor per route point", () => {
    for (const zone of chengduZones) {
      expect(zone.coordinateSystem).toBe("wgs84");
      expect(zone.mapOrientation).toBe("north-up");
      expect(zone.mapRoutePoints).toHaveLength(zone.routeGeo.length);
    }
  });

  it("keeps compass bearings literal on every north-up map", () => {
    for (const zone of chengduZones) {
      const checkpoint = zone.checkpoints[0];
      expect(projectHeadingToMap(zone.routeGeo[0], 0, zone, checkpoint)).toBe(0);
      expect(projectHeadingToMap(zone.routeGeo[0], 90, zone, checkpoint)).toBe(90);
      expect(projectHeadingToMap(zone.routeGeo[0], 180, zone, checkpoint)).toBe(180);
      expect(projectHeadingToMap(zone.routeGeo[0], 270, zone, checkpoint)).toBe(270);
    }
  });
});
