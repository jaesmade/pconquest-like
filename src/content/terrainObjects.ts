import type { TerrainObjectId, Tile } from '../game/types';

type TerrainObject = { asset: string; width: number; height: number; category: 'obstacle' | 'foliage' | 'detail'; blocksMovement: boolean; blocksSight: boolean; tall: boolean };

export const TERRAIN_OBJECTS: Record<TerrainObjectId, TerrainObject> = {
  'ancient-tree': { asset: 'ancient-tree', width: 144, height: 176, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  'standing-stone': { asset: 'standing-stone', width: 48, height: 64, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  tree: { asset: 'tree', width: 96, height: 104, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  'pine-tree': { asset: 'pine-tree', width: 80, height: 120, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  rock: { asset: 'rock', width: 48, height: 40, category: 'obstacle', blocksMovement: true, blocksSight: true, tall: true },
  bush: { asset: 'bush', width: 48, height: 42, category: 'foliage', blocksMovement: false, blocksSight: false, tall: true },
  'fallen-log': { asset: 'fallen-log', width: 80, height: 40, category: 'obstacle', blocksMovement: true, blocksSight: false, tall: true },
  'tree-stump': { asset: 'tree-stump', width: 56, height: 40, category: 'obstacle', blocksMovement: true, blocksSight: false, tall: true },
  fern: { asset: 'fern', width: 40, height: 32, category: 'foliage', blocksMovement: false, blocksSight: false, tall: false },
  mushrooms: { asset: 'mushrooms', width: 32, height: 28, category: 'detail', blocksMovement: false, blocksSight: false, tall: false },
  flower: { asset: 'flower', width: 32, height: 24, category: 'detail', blocksMovement: false, blocksSight: false, tall: false },
  'grass-tuft': { asset: 'grass-tuft', width: 24, height: 24, category: 'detail', blocksMovement: false, blocksSight: false, tall: false },
};

export const objectBlocksMovement = (tile?: Tile): boolean => !!tile?.object && TERRAIN_OBJECTS[tile.object].blocksMovement;
export const objectBlocksSight = (tile?: Tile): boolean => !!tile?.object && TERRAIN_OBJECTS[tile.object].blocksSight;
