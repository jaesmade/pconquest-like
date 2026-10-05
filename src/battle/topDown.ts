import type { BattleMap, GridPoint } from '../game/types';
import { mapHeight, mapWidth } from '../content/maps';

export const TILE_SIZE = 64;
export const MAP_MARGIN = 64;

export function worldSize(map: BattleMap) {
  return { width: mapWidth(map) * TILE_SIZE + MAP_MARGIN * 2, height: mapHeight(map) * TILE_SIZE + MAP_MARGIN * 2 };
}

/** Elevation is tactical metadata; every floor occupies one unshifted square. */
export function tileOrigin(_map: BattleMap, x: number, y: number) {
  return { x: MAP_MARGIN + x * TILE_SIZE, y: MAP_MARGIN + y * TILE_SIZE };
}

export function tileCenter(map: BattleMap, x: number, y: number) {
  const origin = tileOrigin(map, x, y);
  return { x: origin.x + TILE_SIZE / 2, y: origin.y + TILE_SIZE / 2 };
}

export function tileTopPoints(map: BattleMap, x: number, y: number) {
  const origin = tileOrigin(map, x, y);
  return [{ x: origin.x, y: origin.y }, { x: origin.x + TILE_SIZE, y: origin.y },
    { x: origin.x + TILE_SIZE, y: origin.y + TILE_SIZE }, { x: origin.x, y: origin.y + TILE_SIZE }];
}

/** Row depth lets actors pass behind trees without raising or skewing the floor. */
export function tileDepth(_map: BattleMap, _x: number, y: number) { return MAP_MARGIN + y * TILE_SIZE; }

export function gridAtWorld(map: BattleMap, worldX: number, worldY: number): GridPoint | undefined {
  const x = Math.floor((worldX - MAP_MARGIN) / TILE_SIZE), y = Math.floor((worldY - MAP_MARGIN) / TILE_SIZE);
  return x >= 0 && y >= 0 && x < mapWidth(map) && y < mapHeight(map) ? [x, y] : undefined;
}
