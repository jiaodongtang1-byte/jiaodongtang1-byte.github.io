"use client";

import { beepIntervalMs, radarStrength, relativeBearingDeg } from "@/src/lib/radar";

type Props = {
  distanceM: number;
  bearingDeg: number | null;
  headingDeg: number | null;
  unlockRadiusM: number;
  arrived: boolean;
  hasFix: boolean;
  muted: boolean;
};

/**
 * The proximity radar: a needle pointing at the next gift relative to where the
 * explorer is facing, wrapped in a pulse whose tempo matches the beep.
 */
export function RadarPanel({
  distanceM,
  bearingDeg,
  headingDeg,
  unlockRadiusM,
  arrived,
  hasFix,
  muted,
}: Props) {
  const interval = beepIntervalMs(distanceM);
  const strength = arrived ? 1 : radarStrength(distanceM, unlockRadiusM);
  const relative =
    bearingDeg !== null && headingDeg !== null
      ? relativeBearingDeg(bearingDeg, headingDeg)
      : null;

  const state = arrived
    ? "已经抵达"
    : !hasFix
      ? "等待定位"
      : muted
        ? "已静音，看针"
        : relative === null
          ? "方位待校准"
          : "越近，滴声越急";

  return (
    <div
      className={`radar-panel ${arrived ? "is-arrived" : ""} ${muted ? "is-muted" : ""}`}
      data-radar-state={arrived ? "arrived" : hasFix ? "tracking" : "waiting"}
      data-radar-interval={interval || 0}
      data-radar-relative={relative === null ? "" : Math.round(relative)}
    >
      <div className="radar-dial" aria-hidden="true">
        <span className="radar-ring radar-ring-outer" />
        <span className="radar-ring radar-ring-inner" />
        {!arrived && hasFix && interval > 0 && !muted && (
          <span className="radar-pulse" style={{ animationDuration: `${interval}ms` }} />
        )}
        {relative === null ? (
          <span className="radar-core" style={{ opacity: 0.35 + strength * 0.65 }} />
        ) : (
          <span
            className="radar-needle"
            style={{ transform: `rotate(${relative}deg)`, opacity: 0.45 + strength * 0.55 }}
          />
        )}
      </div>
      <div className="radar-readout">
        <span className="radar-eyebrow">下一个礼物</span>
        <b className="radar-distance">
          {arrived ? "已抵达" : hasFix ? `${Math.max(0, Math.round(distanceM))} 米` : "—"}
        </b>
        <small>{state}</small>
      </div>
    </div>
  );
}
