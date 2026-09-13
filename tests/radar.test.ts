import { describe, expect, it } from "vitest";
import {
  beepHz,
  beepIntervalMs,
  radarStrength,
  relativeBearingDeg,
} from "@/src/lib/radar";

describe("proximity radar curve", () => {
  it("beeps fastest inside the unlock ring and slowest beyond the far range", () => {
    expect(beepIntervalMs(0)).toBe(200);
    expect(beepIntervalMs(30)).toBe(200);
    expect(beepIntervalMs(500)).toBe(2600);
    expect(beepIntervalMs(900)).toBe(2600);
  });

  it("never slows down while the explorer walks toward the target", () => {
    let previous = 0;
    for (let distance = 1_000; distance >= 5; distance -= 5) {
      const interval = beepIntervalMs(distance);
      expect(interval).toBeLessThanOrEqual(previous || Number.POSITIVE_INFINITY);
      previous = interval;
    }
    expect(previous).toBe(200);
  });

  it("raises the pitch as the explorer closes in", () => {
    expect(beepHz(30)).toBeGreaterThan(beepHz(200));
    expect(beepHz(200)).toBeGreaterThan(beepHz(500));
    expect(beepHz(30)).toBe(1240);
    expect(beepHz(500)).toBe(720);
    expect(beepHz(4_000)).toBe(720);
  });

  it("stays silent instead of throwing when the fix is unusable", () => {
    expect(beepIntervalMs(Number.POSITIVE_INFINITY)).toBe(0);
    expect(beepIntervalMs(Number.NaN)).toBe(0);
    expect(beepHz(Number.POSITIVE_INFINITY)).toBe(0);
    expect(beepHz(Number.NaN)).toBe(0);
  });

  it("points the needle at the shortest turn to the target", () => {
    expect(relativeBearingDeg(0, 0)).toBe(0);
    expect(relativeBearingDeg(90, 0)).toBe(90);
    expect(relativeBearingDeg(10, 350)).toBe(20);
    expect(relativeBearingDeg(350, 10)).toBe(-20);
    // The exact antipode resolves to -180; the needle rotation is identical to
    // +180, so the convention is pinned rather than special-cased.
    expect(relativeBearingDeg(0, 180)).toBe(-180);
    expect(relativeBearingDeg(270, 90)).toBe(-180);
  });

  it("scales ring strength from the unlock ring outward", () => {
    expect(radarStrength(30, 30)).toBe(1);
    expect(radarStrength(265, 30)).toBeCloseTo(0.5, 2);
    expect(radarStrength(500, 30)).toBe(0);
    expect(radarStrength(Number.POSITIVE_INFINITY, 30)).toBe(0);
  });
});
