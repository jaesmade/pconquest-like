import type { TerrainObjectId, Tile } from '../game/types';

type TerrainObject = { asset: string; width: number; height: number; category: 'obstacle' | 'foliage' | 'detail'; blocksMovement: boolean; blocksSight: boolean; tall: boolean };

export const TERRAIN_OBJECTS: Record<TerrainObjectId, TerrainObject> = {
  tree: { asset: 'tree', width: 96, height: 104, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  rock: { asset: 'rock', width: 48, height: 40, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  bush: { asset: 'bush', width: 48, height: 42, category: 'foliage', blocksMovement: false, blocksSight: false, tall: true },
  flower: { asset: 'flower', width: 32, height: 24, category: 'detail', blocksMovement: false, blocksSight: false, tall: false },
  'grass-tuft': { asset: 'grass-tuft', width: 24, height: 24, category: 'detail', blocksMovement: false, blocksSight: false, tall: false },
};

export const objectBlocksMovement = (tile?: Tile): boolean => !!tile?.object && TERRAIN_OBJECTS[tile.object].blocksMovement;
export const objectBlocksSight = (tile?: Tile): boolean => !!tile?.object && TERRAIN_OBJECTS[tile.object].blocksSight;
