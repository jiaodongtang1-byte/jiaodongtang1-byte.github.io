import type { LatLng, MapBounds } from "@/src/types";
import { projectLocationToBoundsUnclamped } from "./geo";
import { gcj02ToWgs84Approx, wgs84ToGcj02 } from "./coordinateTransform";

/**
 * Online base map tiles, laid into the same 800×500 plate as the route, the
 * goal and the explorer dot. Every tile corner is projected with the zone's own
 * WGS-84 `mapBounds` projection, so tiles and markers can never drift apart —
 * an offset here would put the illustrated streets next to the wrong GPS dot.
 *
 * Mainland tile services publish in GCJ-02, so their corners are converted back
 * to WGS-84 before projection (the runtime position never goes through GCJ-02).
 */
export type TileSourceId = "amap" | "osm";

type TileSource = {
  url(z: number, x: number, y: number): string;
  scheme: "gcj02" | "wgs84";
  attribution: string;
  maxZoom: number;
};

export const TILE_SOURCES: Record<TileSourceId, TileSource> = {
  amap: {
    url: (z, x, y) =>
      `https://webrd0${(x + y) % 4 + 1}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`,
    scheme: "gcj02",
    attribution: "© 高德地图",
    maxZoom: 18,
  },
  osm: {
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    scheme: "wgs84",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 18,
  },
};

/** North-west corner of a tile, in the source's own coordinate system. */
function tileCorner(x: number, y: number, zoom: number): LatLng {
  const span = 2 ** zoom;
  const longitude = (x / span) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / span;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

function toPlateSpace(
  point: LatLng,
  bounds: MapBounds,
  source: TileSource,
  plateWidth: number,
  plateHeight: number,
) {
  const wgs84 = source.scheme === "gcj02" ? gcj02ToWgs84Approx(point) : point;
  return projectLocationToBoundsUnclamped(wgs84, bounds, plateWidth, plateHeight);
}

export type PlateTile = {
  key: string;
  url: string;
  column: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function tilesForBounds(
  bounds: MapBounds,
  sourceId: TileSourceId,
  zoom: number,
  // 画布尺寸由调用方决定（手机会用竖着的画布）。写死 800×500 会让瓦片
  // 与同画布里的标记点错位——瓦片铺在中间一条，标记却散在全屏。
  plateWidth = 800,
  plateHeight = 500,
) {
  const source = TILE_SOURCES[sourceId];
  // A tile index is defined in the source's own coordinate system. Mainland
  // providers lay their grid out in GCJ-02, so the bounds must be shifted there
  // before the index range is derived — otherwise the whole grid lands about one
  // tile away from where the WGS-84 plate expects it.
  const gridBounds = source.scheme === "gcj02" ? shiftBoundsToGcj02(bounds) : bounds;
  const tiles: PlateTile[] = [];
  for (let x = tileX(gridBounds.west, zoom); x <= tileX(gridBounds.east, zoom); x += 1) {
    for (let y = tileY(gridBounds.north, zoom); y <= tileY(gridBounds.south, zoom); y += 1) {
      // Corners are computed per tile rather than by stepping a fixed pixel
      // size: the plate projection is anisotropic, so neighbouring tiles do not
      // share a constant width.
      const northWest = toPlateSpace(tileCorner(x, y, zoom), bounds, source, plateWidth, plateHeight);
      const southEast = toPlateSpace(tileCorner(x + 1, y + 1, zoom), bounds, source, plateWidth, plateHeight);
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        url: source.url(zoom, x, y),
        column: x,
        row: y,
        x: northWest.x,
        y: northWest.y,
        width: southEast.x - northWest.x,
        height: southEast.y - northWest.y,
      });
    }
  }
  return tiles;
}

function shiftBoundsToGcj02(bounds: MapBounds): MapBounds {
  const northWest = wgs84ToGcj02({ latitude: bounds.north, longitude: bounds.west });
  const southEast = wgs84ToGcj02({ latitude: bounds.south, longitude: bounds.east });
  return {
    north: northWest.latitude,
    west: northWest.longitude,
    south: southEast.latitude,
    east: southEast.longitude,
  };
}

export function tileX(longitude: number, zoom: number) {
  return Math.max(0, Math.min(2 ** zoom - 1, Math.floor(((longitude + 180) / 360) * 2 ** zoom)));
}

export function tileY(latitude: number, zoom: number) {
  const sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI) / 180);
  const value = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return Math.max(0, Math.min(2 ** zoom - 1, Math.floor(value * 2 ** zoom)));
}

/**
 * The largest zoom whose tile grid still fits the budget. Bounds of a walkable
 * area land around zoom 16-17; the cap keeps a wide zone from requesting
 * hundreds of tiles.
 */
export function chooseTileZoom(bounds: MapBounds, maxTiles = 36) {
  for (let zoom = 18; zoom >= 12; zoom -= 1) {
    const columns = tileX(bounds.east, zoom) - tileX(bounds.west, zoom) + 1;
    const rows = tileY(bounds.south, zoom) - tileY(bounds.north, zoom) + 1;
    if (columns * rows <= maxTiles) return zoom;
  }
  return 12;
}
