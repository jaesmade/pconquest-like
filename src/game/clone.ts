import type { Battle, GridPoint, Tile } from './types';

// A command owns its units and event arrays, but shares the read-only map until a tile changes.
export function cloneBattleForCommand(battle: Battle): Battle {
  return {
    ...battle,
    tileChanges: Object.fromEntries(Object.entries(battle.tileChanges).filter(([, change]) =>
      change.kind !== undefined || change.height !== undefined
      || (change.hazardUntil ?? 0) > battle.time || (change.coverUntil ?? 0) > battle.time || (change.mudUntil ?? 0) > battle.time)),
    units: battle.units.map(unit => ({
      ...unit,
      types: [...unit.types],
      stats: [...unit.stats] as typeof unit.stats,
      moves: [...unit.moves],
      mobility: { ...unit.mobility },
      status: { ...unit.status },
      stages: { ...unit.stages },
      visualPath: unit.visualPath?.map(([x, y]): GridPoint => [x, y]),
    })),
    turnOrder: [...battle.turnOrder],
    log: [...battle.log],
    visualEvents: battle.visualEvents.map(event => ({
      ...event, from: [...event.from], to: [...event.to],
      tiles: event.tiles.map(([x, y]): GridPoint => [x, y]),
      targetIds: [...event.targetIds],
    })),
  };
}

export function setTileEffects(battle: Battle, points: GridPoint[], field: 'coverUntil' | 'mudUntil' | 'hazardUntil', until: number) {
  const rows = new Map<number, Tile[]>();
  const tiles = [...battle.map.tiles];
  for (const [x, y] of points) {
    let row = rows.get(y);
    if (!row) { row = [...tiles[y]]; rows.set(y, row); tiles[y] = row; }
    row[x] = { ...row[x], [field]: until };
    const key = `${x},${y}`;
    battle.tileChanges[key] = { ...battle.tileChanges[key], x, y, [field]: until };
  }
  battle.map = { ...battle.map, tiles };
}
