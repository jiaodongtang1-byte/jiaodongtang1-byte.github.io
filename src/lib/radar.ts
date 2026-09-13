/**
 * Proximity radar curve. Kept pure so the cadence can be pinned by tests: the
 * beep is the only signal an explorer has while walking with the phone in a
 * pocket, so its mapping from distance must never be tuned by accident.
 */
const NEAR_M = 30;
const FAR_M = 500;
const NEAR_INTERVAL_MS = 200;
const FAR_INTERVAL_MS = 2_600;
const NEAR_HZ = 1_240;
const FAR_HZ = 720;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Silence (0) whenever there is no usable fix, otherwise 200 ms…2.6 s. */
export function beepIntervalMs(distanceM: number) {
  if (!Number.isFinite(distanceM)) return 0;
  if (distanceM <= NEAR_M) return NEAR_INTERVAL_MS;
  if (distanceM >= FAR_M) return FAR_INTERVAL_MS;
  const t = (distanceM - NEAR_M) / (FAR_M - NEAR_M);
  return Math.round(NEAR_INTERVAL_MS + (FAR_INTERVAL_MS - NEAR_INTERVAL_MS) * t ** 0.65);
}

/** Rising pitch as the explorer closes in, so the ear reads it without looking. */
export function beepHz(distanceM: number) {
  if (!Number.isFinite(distanceM)) return 0;
  const t = clamp01((distanceM - NEAR_M) / (FAR_M - NEAR_M));
  return Math.round(NEAR_HZ - (NEAR_HZ - FAR_HZ) * t);
}

/** Signed turn from where the explorer faces to the target: -180…180. */
export function relativeBearingDeg(bearingDeg: number, headingDeg: number) {
  return ((((bearingDeg - headingDeg) % 360) + 540) % 360) - 180;
}

/** 0 far → 1 at the unlock ring, for ring glow and pulse strength. */
export function radarStrength(distanceM: number, unlockRadiusM: number) {
  if (!Number.isFinite(distanceM)) return 0;
  return clamp01(1 - (distanceM - unlockRadiusM) / (FAR_M - unlockRadiusM));
}
