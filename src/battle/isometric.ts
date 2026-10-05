import type { BattleMap, GridPoint, Tile } from '../game/types';
import { mapHeight, mapWidth } from '../content/maps';

export const ISO_HALF_WIDTH = 48;
export const ISO_HALF_HEIGHT = 24;
export const ISO_ELEVATION = 20;
const MARGIN = 96;

export function isoWorldSize(map: BattleMap) {
  return {
    width: (mapWidth(map) + mapHeight(map)) * ISO_HALF_WIDTH + MARGIN * 2,
    height: (mapWidth(map) + mapHeight(map)) * ISO_HALF_HEIGHT + MARGIN * 2 + 44,
  };
}

/** Local top corners; a ramp's downhill edge reaches the next elevation plane. */
export function isoTileTopPolygon(tile: Tile) {
  const corners = [{ x: 48, y: 0 }, { x: 96, y: 24 }, { x: 48, y: 48 }, { x: 0, y: 24 }];
  const lowerCorners = { north: [0, 1], east: [1, 2], south: [2, 3], west: [3, 0] };
  if (tile.slope) for (const index of lowerCorners[tile.slope]) corners[index].y += ISO_ELEVATION;
  return corners;
}

/** Art origin remains on the higher plane even when the ramp center descends. */
export function isoTileOrigin(map: BattleMap, x: number, y: number) {
  return {
    x: MARGIN + mapHeight(map) * ISO_HALF_WIDTH + (x - y) * ISO_HALF_WIDTH - ISO_HALF_WIDTH,
    y: MARGIN + ISO_ELEVATION * 2 + (x + y) * ISO_HALF_HEIGHT - map.tiles[y][x].height * ISO_ELEVATION - ISO_HALF_HEIGHT,
  };
}

export function isoTileTopPoints(map: BattleMap, x: number, y: number) {
  const origin = isoTileOrigin(map, x, y);
  return isoTileTopPolygon(map.tiles[y][x]).map(point => ({ x: point.x + origin.x, y: point.y + origin.y }));
}

export function isoTileCenter(map: BattleMap, x: number, y: number) {
  const origin = isoTileOrigin(map, x, y);
  return { x: origin.x + ISO_HALF_WIDTH, y: origin.y + ISO_HALF_HEIGHT + (map.tiles[y][x].slope ? ISO_ELEVATION / 2 : 0) };
}

/** Sort by the grid footprint; lifting the drawing point must not move an actor in front of a cliff. */
export function isoTileDepth(_map: BattleMap, x: number, y: number) {
  return MARGIN + ISO_ELEVATION * 2 + (x + y) * ISO_HALF_HEIGHT;
}

/** Match the last painted flat or sloping top, then the closest tile for cliff-face clicks. */
export function isoGridAtWorld(map: BattleMap, worldX: number, worldY: number): GridPoint | undefined {
  let top: { point: GridPoint; order: number } | undefined;
  let closest: { point: GridPoint; distance: number } | undefined;
  for (let y = 0; y < mapHeight(map); y++) for (let x = 0; x < mapWidth(map); x++) {
    const center = isoTileCenter(map, x, y);
    const distance = Math.abs(worldX - center.x) / ISO_HALF_WIDTH + Math.abs(worldY - center.y) / ISO_HALF_HEIGHT;
    const points = map.tiles[y][x].slope ? isoTileTopPoints(map, x, y) : undefined;
    const inside = points ? points.every((point, index) => {
      const next = points[(index + 1) % points.length];
      return (next.x - point.x) * (worldY - point.y) - (next.y - point.y) * (worldX - point.x) >= -0.25 * Math.hypot(next.x - point.x, next.y - point.y);
    }) : distance <= 1.01;
    if (inside && (!top || x + y >= top.order)) top = { point: [x, y], order: x + y };
    if (!closest || distance < closest.distance) closest = { point: [x, y], distance };
  }
  return top?.point ?? (closest && closest.distance <= 2.2 ? closest.point : undefined);
}
