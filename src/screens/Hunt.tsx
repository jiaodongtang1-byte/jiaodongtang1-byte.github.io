import { useEffect, useMemo, useRef, useState } from "react";
import { Dial } from "@/src/kit/Dial";
import { RELICS } from "@/src/kit/Relic";
import { bearingDegrees, formatDistance, projectLocationToBounds } from "@/src/lib/geo";
import { chooseTileZoom, tilesForBounds } from "@/src/lib/tiles";
import { useRadarBeeps } from "@/src/hooks/useRadarBeeps";
import { stationGeometry, STATIONS, type Plate, type SafeBox } from "@/src/story";
import type { PositionSample } from "@/src/types";

type Props = {
  index: number;
  position: PositionSample | null;
  /** 定位是否可信（精度够、不是冻结的旧点） */
  reliable: boolean;
  arrived: boolean;
  started: boolean;
  heading: number | null;
  muted: boolean;
  distanceM: number;
  onStart: () => void;
  onOpenCapture: () => void;
  onRetry: () => void;
};

/** 容器尺寸：地图画布跟着容器比例走，竖屏手机上才不会被压成一条。 */
function useBoxSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<Plate>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export function Hunt({
  index, position, reliable, arrived, started, heading, muted, distanceM,
  onStart, onOpenCapture, onRetry,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const size = useBoxSize(mapRef);
  const [folded, setFolded] = useState(false);

  const station = STATIONS[index];
  const narrow = size.width > 0 && size.width < 600;

  // 任务卡压住哪一侧，内容就避开哪一侧。
  // 边距里要算上标记自身的半径（目标圈 r=46），否则圈会被顶栏切掉一半。
  const safe: SafeBox = useMemo(
    () => (narrow
      ? { left: 58, right: 58, top: 116, bottom: Math.round(size.height * 0.52) }
      : { left: 396, right: 62, top: 126, bottom: 62 }),
    [narrow, size.height],
  );

  const geom = useMemo(
    () => (size.width > 40 ? stationGeometry(station, size, safe) : null),
    [station, size, safe],
  );

  const tiles = useMemo(() => {
    if (!geom) return [];
    return tilesForBounds(geom.bounds, "amap", chooseTileZoom(geom.bounds, 40), geom.plate.width, geom.plate.height);
  }, [geom]);

  const you = useMemo(() => {
    if (!geom || !position || !reliable) return null;
    // 边距 = 标记外圈的半径，站在画布外时整枚点仍然完整可见
    return projectLocationToBounds(position, geom.bounds, geom.plate.width, geom.plate.height, 16);
  }, [geom, position, reliable]);

  const bearing = position ? bearingDegrees(position, station.location) : 0;
  useRadarBeeps({ active: started && !arrived, distanceM, muted });

  const status = arrived ? "已经抵达" : !started ? "等待开始" : !reliable ? "定位在云雾中" : "星图已定位";

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">
          <b>{station.place}</b>
          <span>STATION {index + 1} OF {STATIONS.length}</span>
        </div>
        <div className="topbar-dots" aria-hidden="true">
          {STATIONS.map((item, i) => <i key={item.id} className={i <= index ? "is-on" : ""} />)}
        </div>
        <span className="chip">{status}</span>
      </header>

      <div className="hunt-map" ref={mapRef}>
        {geom && (
          <svg viewBox={`0 0 ${geom.plate.width} ${geom.plate.height}`} aria-label={`${station.place} 地图`}>
            <defs>
              <radialGradient id="mapGlowGold" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffc46b" stopOpacity=".85" />
                <stop offset="45%" stopColor="#ff9ec9" stopOpacity=".38" />
                <stop offset="100%" stopColor="#ff9ec9" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="mapGlowViolet" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#a06fdc" stopOpacity=".55" />
                <stop offset="100%" stopColor="#a06fdc" stopOpacity="0" />
              </radialGradient>
              {/* color 混合只取这张渐变的色相与饱和，所以 stop 必须不透明——
                  带 alpha 的话会被当成普通半透明覆盖，瓦片自己的绿色就透上来了。 */}
              <linearGradient id="mapWash" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#cbb6ff" />
                <stop offset="50%" stopColor="#ffe6f2" />
                <stop offset="100%" stopColor="#ffbcd8" />
              </linearGradient>
              <radialGradient id="mapVignette" cx="50%" cy="46%" r="78%">
                <stop offset="68%" stopColor="#e7d3ee" stopOpacity="0" />
                <stop offset="100%" stopColor="#e7d3ee" stopOpacity=".42" />
              </radialGradient>
            </defs>

            <g className="hunt-tile">
              {tiles.map((tile) => (
                <image
                  key={tile.key}
                  href={tile.url}
                  x={tile.x}
                  y={tile.y}
                  width={tile.width}
                  height={tile.height}
                  preserveAspectRatio="none"
                />
              ))}
            </g>

            {/* 洗色 + 暗角：把高德的绿灰橙统一成粉紫，边缘化进奶油底，
                免得瓦片在屏幕边上硬切一刀。 */}
            <rect className="hunt-wash" width={geom.plate.width} height={geom.plate.height} fill="url(#mapWash)" />
            <rect className="hunt-vignette" width={geom.plate.width} height={geom.plate.height} fill="url(#mapVignette)" />

            <path className="hunt-route-halo" d={geom.path} />
            <path className="hunt-route" d={geom.path} />

            {/* 出发点：走过的起点，低调 */}
            <g className="hunt-start" transform={`translate(${geom.start.x} ${geom.start.y})`}>
              <circle r="7" />
              <text className="hunt-caption" y="24">出发点</text>
            </g>

            {/* 目标：会呼吸的信物信标 */}
            <g className="hunt-goal" transform={`translate(${geom.goal.x} ${geom.goal.y})`}>
              <circle className="goal-glow" r="62" fill="url(#mapGlowGold)" />
              <circle className="goal-ping" r="17" />
              <circle className="goal-ping is-late" r="17" />
              <circle className="goal-disc" r="14" />
              <path className="goal-star" d="M0-8.5 2.1-2.1 8.5 0 2.1 2.1 0 8.5-2.1 2.1-8.5 0-2.1-2.1Z" />
            </g>

            {you && (
              <g className="hunt-you" transform={`translate(${you.x} ${you.y})`}>
                <circle className="you-glow" r="34" fill="url(#mapGlowViolet)" />
                <circle className="you-core" r="6.5" />
                <circle className="you-ring" r="11.5" />
              </g>
            )}
          </svg>
        )}
      </div>

      <aside className={`quest ${folded ? "is-folded" : ""} ${arrived ? "is-arrived" : ""}`}>
        <button className="quest-toggle" type="button" aria-expanded={!folded} onClick={() => setFolded((v) => !v)}>
          {folded ? "看线索" : "收起"}
        </button>
        <span className="eyebrow">{arrived ? "FOUND" : "THE NEXT HEIRLOOM"}</span>
        <h2>
          {arrived ? station.relicName : "还没找到的信物"}
          <small>{arrived ? station.place : "答案在星雾里"}</small>
        </h2>

        {!folded && <div className="quest-relic">{RELICS[station.relic]}</div>}
        {!folded && <p className="hint">{station.clue}</p>}

        <div className="dial-block">
          <Dial bearingDeg={bearing} headingDeg={heading} arrived={arrived} muted={muted} />
          <div className="dial-read">
            <span className="k">{arrived ? "已经抵达" : "距离下一个信物"}</span>
            <span className="v">{arrived ? "到了" : started ? formatDistance(distanceM) : "—"}</span>
            <span className="s">{position ? `精度 ±${Math.round(position.accuracy)}m` : "等待定位"}</span>
          </div>
        </div>

        <div className="quest-meta">
          <span>{reliable || !started ? "目标" : "信号弱"}</span>
          <b>{station.relicName}</b>
        </div>

        {!started ? (
          <button className="btn is-wide" type="button" onClick={onStart}>我已到达，开始探索</button>
        ) : arrived ? (
          <button className="btn is-wide" type="button" onClick={onOpenCapture}>开启照片复刻</button>
        ) : (
          <button className="btn is-wide is-quiet" type="button" onClick={onRetry}>重新定位</button>
        )}
      </aside>
    </>
  );
}
