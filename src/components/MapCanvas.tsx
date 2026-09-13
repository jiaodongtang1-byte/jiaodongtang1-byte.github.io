"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { projectHeadingToMap, projectLocationToBounds, projectPositionToMap } from "@/src/lib/geo";
import { TILE_SOURCES, chooseTileZoom, tilesForBounds } from "@/src/lib/tiles";
import type { Checkpoint, ExplorationZone, PositionSample } from "@/src/types";
import { MapMagicOverlay } from "./MapMagicOverlay";

type Props = {
  zone: ExplorationZone;
  checkpoint: Checkpoint;
  position: PositionSample | null;
  locationReliable: boolean;
  arrived: boolean;
  completedIds: string[];
  heading?: number;
  showHeading?: boolean;
  onMapFocus?: () => void;
};

// 杭州那四张手绘底图已随杭州版一并删除：成都各区走高德瓦片，瓦片挂了也绝不
// 回退到别的城市（见下面 illustratedMap 取用处的注释）。

function pendingCoordinateCopy(count: number) {
  if (count <= 1) return "还藏着最后一枚坐标";
  const chinese = ["零", "一", "两", "三", "四", "五"][count] ?? String(count);
  return `还藏着${chinese}枚坐标`;
}

// 精度圈半径：把 GPS accuracy（米）换算成 800×500 地图单位。north-up 时用
// mapBounds 的纬度跨距做竖直比例（杭州 30°N，横纵差异 <5%，不必分轴）。
function accuracyRadiusInMapUnits(accuracyM: number, zone: ExplorationZone) {
  if (zone.mapOrientation === "north-up" && zone.mapBounds) {
    const verticalM = (zone.mapBounds.north - zone.mapBounds.south) * 111_320;
    return Math.max(6, Math.min(80, (accuracyM / verticalM) * 500));
  }
  return 14;
}

function AtlasFurniture() {
  return (
    <g aria-hidden="true">
      <g className="coordinate-grid">
        {Array.from({ length: 13 }).map((_, index) => <path key={`v-${index}`} d={`M${40 + index * 60} 28V472`} />)}
        {Array.from({ length: 8 }).map((_, index) => <path key={`h-${index}`} d={`M35 ${42 + index * 58}H765`} />)}
      </g>
      <g className="atlas-compass" transform="translate(738 67)">
        <circle r="31" /><circle r="24" /><path d="M0-26 6-5 26 0 6 5 0 26-6 5-26 0-6-5z" />
        <path d="M0-19 4 0 0 19-4 0z" className="compass-needle" />
        <text y="-35">N</text>
      </g>
      <g className="map-scale" transform="translate(55 456)">
        <path d="M0 0h90M0-4v8M45-4v8M90-4v8" />
        <text y="-8">0</text><text x="39" y="-8">125</text><text x="81" y="-8">250 M</text>
      </g>
    </g>
  );
}

export function MapCanvas({
  zone,
  checkpoint,
  position,
  locationReliable,
  arrived,
  completedIds,
  heading = 0,
  showHeading = true,
  onMapFocus,
}: Props) {
  const displayedTitle = arrived
    ? zone.title
    : zone.mysteryTitle ?? `XXVIII · PAGE ${String(zone.order).padStart(2, "0")}`;
  const pendingCoordinates = zone.checkpoints.filter(
    (item) => item.giftType !== "love" && !completedIds.includes(item.id),
  ).length;
  const concealedSubtitle = (zone.mysterySubtitle ?? "成为巫师的下一步 · 坐标仍在雾中").replace(
    /还藏着(?:最后)?[一二三四五六七八九十\d]+枚坐标/,
    pendingCoordinateCopy(pendingCoordinates),
  );
  const displayedSubtitle = arrived
    ? zone.subtitle
    : concealedSubtitle;
  // A tile zone must never fall back to the illustrated table: those plates are
  // hand-drawn for the Hangzhou venues, so a Chengdu zone would silently show
  // the wrong city when the tiles fail to load.
  const illustratedMap = zone.illustratedMapAsset;
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const hasIllustratedBase = Boolean(illustratedMap && failedAsset !== illustratedMap);
  const tileSourceId = zone.tileMap?.source ?? "amap";
  const tileZoom = useMemo(
    () => zone.tileMap?.zoom ?? (zone.mapBounds ? chooseTileZoom(zone.mapBounds) : 16),
    [zone.tileMap?.zoom, zone.mapBounds],
  );
  const tiles = useMemo(
    () => (zone.tileMap && zone.mapBounds ? tilesForBounds(zone.mapBounds, tileSourceId, tileZoom) : []),
    [zone.tileMap, zone.mapBounds, tileSourceId, tileZoom],
  );
  const [tileFailures, setTileFailures] = useState(0);
  // A zone switch resets the failure tally, otherwise a dead network in the
  // previous area would keep the next area's tiles hidden.
  useEffect(() => setTileFailures(0), [zone.id]);
  const tilesUsable = tiles.length > 0 && tileFailures < tiles.length * 0.6;
  const startMapPoint = useMemo(
    () => projectPositionToMap(zone.routeGeo[0] ?? zone.center, zone, checkpoint),
    [zone, checkpoint],
  );
  const goalMapPoint = useMemo(
    () => projectPositionToMap(checkpoint.location, zone, checkpoint),
    [zone, checkpoint],
  );
  const displayedRoutePath = useMemo(() => {
    if (zone.mapOrientation !== "north-up" || !zone.mapBounds) return zone.svgPath;
    return zone.routeGeo
      .map((point, index) => {
        const projected = projectLocationToBounds(point, zone.mapBounds!);
        return `${index ? "L" : "M"}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
      })
      .join(" ");
  }, [zone]);
  const [marker, setMarker] = useState(startMapPoint);
  const mappedHeading = useMemo(
    () =>
      position
        ? projectHeadingToMap(position, heading, zone, checkpoint)
        : ((heading % 360) + 360) % 360,
    [position, heading, zone, checkpoint],
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [follow, setFollow] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 1180, h: 820 });
  const [pawTrail, setPawTrail] = useState<Array<{
    id: string;
    x: number;
    y: number;
    angle: number;
    side: number;
  }>>([]);
  const lastTrailPoint = useRef(startMapPoint);
  const [trail, setTrail] = useState<Array<{ x: number; y: number }>>([]);
  const trailRef = useRef<Array<{ x: number; y: number }>>([]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    distance: 0,
    zoom: 1,
    center: { x: 0, y: 0 },
    pan: { x: 0, y: 0 },
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => setStageSize({ w: stage.clientWidth || 1180, h: stage.clientHeight || 820 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // 跟随模式：把相机平移到用户地图位置（CSS transform 原点在几何中心，
  // 故 t = zoom * (中心 - 用户像素)）。拖动手势会退出跟随，点跟随按钮恢复。
  useEffect(() => {
    if (!follow || !position || arrived) return;
    setPan({
      x: zoom * (stageSize.w / 2 - (marker.x / 800) * stageSize.w),
      y: zoom * (stageSize.h / 2 - (marker.y / 500) * stageSize.h),
    });
  }, [follow, marker.x, marker.y, zoom, stageSize.w, stageSize.h, position?.timestamp, arrived]);

  useEffect(() => {
    if (!position) return;
    const next = projectPositionToMap(position, zone, checkpoint);
    setMarker(next);
    const previous = lastTrailPoint.current;
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 9) return;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const count = Math.min(4, Math.max(1, Math.floor(distance / 18)));
    setPawTrail((current) => {
      const createdAt = `${position.timestamp}-${Math.round(next.x)}-${Math.round(next.y)}`;
      const added = Array.from({ length: count }, (_, index) => {
        const ratio = (index + 1) / (count + 1);
        return {
          id: `${createdAt}-${index}`,
          x: previous.x + dx * ratio,
          y: previous.y + dy * ratio,
          angle,
          side: current.length + index,
        };
      });
      return [...current, ...added].slice(-18);
    });
    lastTrailPoint.current = next;
    // 会话轨迹：仅记录与原轨迹末尾相距 >3 地图单位的点（滤掉 GPS 原地抖动）
    const previousTrail = trailRef.current[trailRef.current.length - 1];
    if (!previousTrail || Math.hypot(next.x - previousTrail.x, next.y - previousTrail.y) > 3) {
      trailRef.current = [...trailRef.current.slice(-400), { x: next.x, y: next.y }];
      setTrail(trailRef.current);
    }
  }, [position?.timestamp, zone, checkpoint]);

  useEffect(() => {
    setPawTrail([]);
    trailRef.current = [];
    setTrail([]);
    const start = position ? projectPositionToMap(position, zone, checkpoint) : startMapPoint;
    setMarker(start);
    lastTrailPoint.current = start;
  }, [zone.id, checkpoint.id, startMapPoint.x, startMapPoint.y]);

  function pointerCenter() {
    const values = [...pointers.current.values()];
    return {
      x: values.reduce((sum, point) => sum + point.x, 0) / values.length,
      y: values.reduce((sum, point) => sum + point.y, 0) / values.length,
    };
  }

  function pointerDistance() {
    const [first, second] = [...pointers.current.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  }

  function beginGesture(event: React.PointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic rehearsal events are not backed by a physical pointer.
      // Real iPad touch pointers still use capture so the gesture stays smooth.
    }
    setFollow(false);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = {
      distance: pointerDistance(),
      zoom,
      center: pointerCenter(),
      pan,
    };
  }

  function moveGesture(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || arrived) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const center = pointerCenter();
    if (pointers.current.size >= 2) {
      const distance = pointerDistance();
      const ratio = gesture.current.distance ? distance / gesture.current.distance : 1;
      setZoom(Math.max(0.92, Math.min(1.35, gesture.current.zoom * ratio)));
    }
    setPan({
      x: Math.max(-75, Math.min(75, gesture.current.pan.x + center.x - gesture.current.center.x)),
      y: Math.max(-50, Math.min(50, gesture.current.pan.y + center.y - gesture.current.center.y)),
    });
  }

  function endGesture(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size) {
      gesture.current = {
        distance: pointerDistance(),
        zoom,
        center: pointerCenter(),
        pan,
      };
    }
  }

  return (
    <div className="map-stage" ref={stageRef} aria-label={`${displayedTitle} 活点地图`} onClick={onMapFocus}>
      <div className="map-tools" aria-label="地图缩放">
        <button onClick={() => setZoom((value) => Math.min(1.18, value + 0.08))}>＋</button>
        <button onClick={() => setZoom((value) => Math.max(0.92, value - 0.08))}>−</button>
        <button
          className={`map-follow-toggle${follow ? " is-following" : ""}`}
          aria-label={follow ? "解除地图跟随" : "跟随我的位置"}
          aria-pressed={follow}
          data-follow={follow}
          onClick={() => setFollow((value) => !value)}
        >
          <span aria-hidden="true">⌖</span>跟随
        </button>
      </div>
      <motion.div
        className="map-camera"
        aria-label="可拖拽和双指缩放的探索地图"
        data-zoom={zoom.toFixed(2)}
        data-pan={`${Math.round(pan.x)},${Math.round(pan.y)}`}
        animate={{ scale: zoom, x: pan.x, y: pan.y }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        <svg
          viewBox="0 0 800 500"
          preserveAspectRatio={illustratedMap || tilesUsable ? "none" : "xMidYMid meet"}
          role="img"
          className={`${hasIllustratedBase ? "has-illustrated-base" : ""} ${tilesUsable ? "has-tile-base" : ""} ${zone.tileMap ? "has-tile-zone" : ""}`.trim()}
        >
          <defs>
            <filter id="roughen">
              <feTurbulence baseFrequency="0.035" numOctaves="2" seed="9" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" />
            </filter>
            <filter id="inkGlow">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {illustratedMap && !tilesUsable && (
            <image
              className="illustrated-base-map"
              href={illustratedMap}
              x="-2"
              y="-2"
              width="804"
              height="504"
              preserveAspectRatio="none"
              onError={() => setFailedAsset(illustratedMap)}
            />
          )}
          {tilesUsable && (
            <g className="tile-base-map" data-tile-zoom={tileZoom} aria-hidden="true">
              {tiles.map((tile) => (
                <image
                  key={tile.key}
                  href={tile.url}
                  x={tile.x}
                  y={tile.y}
                  width={tile.width}
                  height={tile.height}
                  preserveAspectRatio="none"
                  onError={() => setTileFailures((count) => count + 1)}
                />
              ))}
            </g>
          )}
          <AtlasFurniture />
          <path className="route-path route-path-aura" d={displayedRoutePath} aria-hidden="true" />
          <path className="route-path" d={displayedRoutePath} />
          {trail.length > 1 && (
            <polyline
              className="you-trail"
              points={trail.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ")}
              aria-hidden="true"
            />
          )}
          {pawTrail.map((point) => {
            return (
              <g
                key={point.id}
                className="paw-trail"
                transform={`translate(${point.x} ${point.y}) rotate(${point.angle}) translate(${point.side % 2 ? 3.4 : -3.4} 0)`}
              >
                <circle className="paw-ripple paw-ripple-first" r="4.5" />
                <circle className="paw-ripple paw-ripple-second" r="4.5" />
                <g className="paw-print">
                  <ellipse className="paw-pad" cy="2.2" rx="3.9" ry="3.25" />
                  <ellipse className="paw-toe" cx="-4.1" cy="-2.2" rx="1.35" ry="1.75" transform="rotate(-24 -4.1 -2.2)" />
                  <ellipse className="paw-toe" cx="-1.35" cy="-4.25" rx="1.3" ry="1.75" transform="rotate(-8 -1.35 -4.25)" />
                  <ellipse className="paw-toe" cx="1.6" cy="-4.15" rx="1.3" ry="1.75" transform="rotate(9 1.6 -4.15)" />
                  <ellipse className="paw-toe" cx="4.25" cy="-1.9" rx="1.3" ry="1.7" transform="rotate(25 4.25 -1.9)" />
                </g>
              </g>
            );
          })}
          <g
            transform={`translate(${goalMapPoint.x} ${goalMapPoint.y})`}
            className={`atlas-point goal-point ${arrived ? "arrived" : ""}`}
            data-map-x={goalMapPoint.x.toFixed(1)}
            data-map-y={goalMapPoint.y.toFixed(1)}
            role="img"
            aria-label={arrived ? `目的地 ${checkpoint.label}` : "尚未揭晓的目的地"}
          >
            {arrived && (
              <g className="goal-arrival-burst" aria-hidden="true">
                <circle r="8" className="goal-arrival-ripple ripple-one" />
                <circle r="8" className="goal-arrival-ripple ripple-two" />
                <path d="M0-25V-16M17.7-17.7l-6.4 6.4M25 0H16M17.7 17.7l-6.4-6.4M0 25V16M-17.7 17.7l6.4-6.4M-25 0h9M-17.7-17.7l6.4 6.4" />
              </g>
            )}
            <circle r="9" className="point-glow" />
            <circle r="6" className="point-ring" />
            <circle r="3.4" className="point-core" />
            <g className="goal-tag" transform="translate(0 -18)">
              <rect x="-16" y="-7" width="32" height="14" rx="7" />
              <text y="3.2">GOAL</text>
            </g>
          </g>
          {completedIds.map((id, index) => (
            <g key={id} transform={`translate(${675 + index * 24} 445)`} className="wax-dot">
              <circle r="8" /><path d="m-4 0 3 3 6-7" />
            </g>
          ))}
          <motion.g
            initial={false}
            animate={{ x: marker.x, y: marker.y }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={`atlas-point you-marker ${locationReliable ? "" : "in-fog"}`}
            data-heading={Math.round(mappedHeading)}
            data-map-x={marker.x.toFixed(1)}
            data-map-y={marker.y.toFixed(1)}
            role="img"
            aria-label="当前位置"
          >
            <g className="you-magic-orbit" aria-hidden="true">
              <circle cx="0" cy="-14" r="1.5" />
              <circle cx="11" cy="8" r="1" />
              <circle cx="-12" cy="6" r="1.2" />
              <path d="M0-14A14 14 0 0 1 11 8M11 8A14 14 0 0 1-12 6M-12 6A14 14 0 0 1 0-14" />
            </g>
            {showHeading && (
              <g className="you-heading-arrow" transform={`rotate(${mappedHeading})`}>
                <path d="M0-25 10-9 3-11 0-8-3-11-10-9Z" />
              </g>
            )}
            {position && locationReliable && (
              <circle
                className="you-accuracy"
                r={accuracyRadiusInMapUnits(position.accuracy, zone)}
                aria-hidden="true"
              />
            )}
            <circle r="9" className="point-glow" />
            <circle r="6" className="point-ring" />
            <circle r="3.4" className="point-core" />
          </motion.g>
          <g className="map-cartouche" transform="translate(42 34)">
            <path d="M0 0h330l-14 34H0l10-17z" />
            <text x="20" y="16" className="map-title">{displayedTitle}</text>
            <text x="20" y="29" className="map-subtitle">{displayedSubtitle}</text>
          </g>
        </svg>
        <MapMagicOverlay giftType={checkpoint.giftType} revealed={arrived} />
      </motion.div>
      {illustratedMap && failedAsset === illustratedMap && (
        <div className="map-illustration-fallback">高清底图暂未载入，已切换线稿模式</div>
      )}
      {tiles.length > 0 && tileFailures >= tiles.length * 0.6 && (
        <div className="map-illustration-fallback">底图瓦片未载入（可能没有网络），雷达与提示不受影响</div>
      )}
      {tilesUsable && <div className="map-tile-attribution">{TILE_SOURCES[tileSourceId].attribution}</div>}
      {!locationReliable && <div className="map-fog map-fog-local" aria-hidden="true" />}
    </div>
  );
}
