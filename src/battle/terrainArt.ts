import isoAssets from '../../public/assets/environment/isometric/isometric-manifest.json';
import type { BattleMap, Tile } from '../game/types';
import { ISO_ELEVATION } from './isometric';

export const TILE_TOP_POLYGON = [{ x: 48, y: 0 }, { x: 96, y: 24 }, { x: 48, y: 48 }, { x: 0, y: 24 }];

/** Shared art selection keeps preparation and battle terrain identical without consuming game RNG. */
export function terrainArt(tile: Tile, x: number, y: number) {
  const height = 72 + tile.height * 20;
  if (tile.kind !== 'plain') return {
    texture: `iso-${tile.kind}-h${tile.height}-96px`,
    url: isoAssets.tiles[tile.kind][tile.height],
    height,
  };
  const variation = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 11;
  const style = tile.surface ?? (variation < 3 ? 'speckled' : variation === 3 ? 'moss' : 'grass');
  return { texture: `iso-forest-${style}-h${tile.height}`, url: isoAssets.forestTiles[style][tile.height], height };
}

export function forestCliffArt(tile: Tile) {
  return { texture: `iso-forest-cliff-h${tile.height}`, url: isoAssets.forestCliffs[tile.height], height: 72 + tile.height * 20 };
}

/** Adjacent tops bury the lower soil: only exposed front faces can occlude actors. */
export function forestCliffFaces(map: BattleMap, x: number, y: number) {
  const tile = map.tiles[y][x];
  const exposed = (neighbor?: Tile) => neighbor ? Math.max(0, tile.height - neighbor.height) * ISO_ELEVATION : 22 + tile.height * ISO_ELEVATION;
  const left = exposed(map.tiles[y + 1]?.[x]), right = exposed(map.tiles[y]?.[x + 1]);
  return {
    key: `${tile.height}-${left}-${right}`,
    polygons: [
      ...(left ? [[{ x: 0, y: 24 }, { x: 48, y: 48 }, { x: 48, y: 48 + left }, { x: 0, y: 24 + left }]] : []),
      ...(right ? [[{ x: 48, y: 48 }, { x: 96, y: 24 }, { x: 96, y: 24 + right }, { x: 48, y: 48 + right }]] : []),
    ],
  };
}
