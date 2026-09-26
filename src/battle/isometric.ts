import type { BattleMap, GridPoint } from '../game/types';
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

export function isoTileCenter(map: BattleMap, x: number, y: number) {
  return {
    x: MARGIN + mapHeight(map) * ISO_HALF_WIDTH + (x - y) * ISO_HALF_WIDTH,
    y: MARGIN + ISO_ELEVATION * 2 + (x + y) * ISO_HALF_HEIGHT - map.tiles[y][x].height * ISO_ELEVATION,
  };
}

/** Match the last painted top diamond, then use the closest tile for cliff-face clicks. */
export function isoGridAtWorld(map: BattleMap, worldX: number, worldY: number): GridPoint | undefined {
  let top: { point: GridPoint; order: number } | undefined;
  let closest: { point: GridPoint; distance: number } | undefined;
  for (let y = 0; y < mapHeight(map); y++) for (let x = 0; x < mapWidth(map); x++) {
    const center = isoTileCenter(map, x, y);
    const diamond = Math.abs(worldX - center.x) / ISO_HALF_WIDTH + Math.abs(worldY - center.y) / ISO_HALF_HEIGHT;
    if (diamond <= 1.01 && (!top || x + y >= top.order)) top = { point: [x, y], order: x + y };
    const distance = Math.abs(worldX - center.x) / ISO_HALF_WIDTH + Math.abs(worldY - center.y) / ISO_HALF_HEIGHT;
    if (!closest || distance < closest.distance) closest = { point: [x, y], distance };
  }
  return top?.point ?? (closest && closest.distance <= 2.2 ? closest.point : undefined);
}
