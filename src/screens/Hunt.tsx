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
    return projectLocationToBounds(position, geom.bounds, geom.plate.width, geom.plate.height);
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

            <path className="hunt-route" d={geom.path} />

            <g className="hunt-goal" transform={`translate(${geom.goal.x} ${geom.goal.y})`}>
              <circle className="goal-halo" r="46" />
              <circle className="goal-ring" r="13" />
              <circle className="goal-core" r="5" />
              <path className="goal-ray" d="M0-46V-32M0 46V32M-46 0H-32M46 0H32" />
            </g>

            <g className="hunt-you" transform={`translate(${geom.start.x} ${geom.start.y})`}>
              <circle className="ring" r="8" />
              <text className="hunt-caption" y="26">出发点</text>
            </g>

            {you && (
              <g className="hunt-you" transform={`translate(${you.x} ${you.y})`}>
                <circle className="halo" r="24" />
                <circle className="core" r="7" />
                <circle className="ring" r="13" />
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
