import assets from '../../public/assets/environment/top-down/top-down-manifest.json';
import type { BattleMap, Tile } from '../game/types';
import { TILE_SIZE } from './topDown';

export { assets as terrainAssets };

/** Shared art selection keeps preparation and battle terrain identical without consuming game RNG. */
export function terrainArt(tile: Tile, x: number, y: number) {
  if (tile.kind === 'plain' && tile.slope) {
    const surface = tile.surface === 'stone' ? 'stone' : 'path';
    return { texture: `ground-ramp-${surface}-${tile.slope}`, url: assets.ramps[tile.slope][surface], height: TILE_SIZE };
  }
  const variation = ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 11;
  const style = tile.kind !== 'plain' ? tile.kind : tile.surface ?? (variation < 3 ? 'speckled' : variation === 3 ? 'moss' : 'grass');
  return { texture: `ground-${style}-h${tile.height}`, url: assets.tiles[style][tile.height], height: TILE_SIZE };
}

/** Borders occupy their owning square; ledges never obscure neighboring cells. */
export function terrainEdges(map: BattleMap, x: number, y: number) {
  const tile = map.tiles[y][x];
  const edges: Array<{ texture: string; url: string }> = [];
  const neighbors = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] } as const;
  for (const [direction, [dx, dy]] of Object.entries(neighbors)) {
    const neighbor = map.tiles[y + dy]?.[x + dx];
    let kind: 'ledge' | 'bank' | 'trail' | undefined;
    if (tile.kind === 'water' && (!neighbor || neighbor.kind !== 'water')) kind = 'bank';
    else if (neighbor && tile.height > neighbor.height && tile.slope !== direction) kind = 'ledge';
    else if (tile.kind === 'plain' && tile.surface === 'path' && neighbor?.kind === 'plain' && neighbor.surface !== 'path' && !neighbor.slope) kind = 'trail';
    if (kind) {
      const key = `${kind}-${direction}` as keyof typeof assets.edges;
      edges.push({ texture: `ground-${key}`, url: assets.edges[key] });
    }
  }
  return edges;
}
