import type { Battle, GridPoint, Tile } from './types';

// A command owns its units and event arrays, but shares the read-only map until a tile changes.
export function cloneBattleForCommand(battle: Battle): Battle {
  return {
    ...battle,
    tileChanges: Object.fromEntries(Object.entries(battle.tileChanges).filter(([, change]) =>
      change.kind !== undefined || change.height !== undefined
      || (change.hazardUntil ?? 0) > battle.time || (change.coverUntil ?? 0) > battle.time || (change.mudUntil ?? 0) > battle.time)),
    hazardZones: battle.hazardZones.map(zone => ({ ...zone, tiles: zone.tiles.map(([x, y]): GridPoint => [x, y]) })),
    units: battle.units.map(unit => ({
      ...unit,
      types: [...unit.types],
      stats: [...unit.stats] as typeof unit.stats,
      moves: [...unit.moves],
      mobility: { ...unit.mobility },
      status: { ...unit.status },
      stages: { ...unit.stages },
      stageUntil: { ...unit.stageUntil },
      visualFrom: unit.visualFrom ? [...unit.visualFrom] : undefined,
      visualPath: unit.visualPath?.map(([x, y]): GridPoint => [x, y]),
    })),
    turnOrder: [...battle.turnOrder],
    log: [...battle.log],
    visualEvents: battle.visualEvents.map(event => ({
      ...event, from: [...event.from], to: [...event.to],
      tiles: event.tiles.map(([x, y]): GridPoint => [x, y]),
      targetIds: [...event.targetIds],
      hpAfter: event.hpAfter ? { ...event.hpAfter } : undefined,
    })),
    feedbackEvents: battle.feedbackEvents?.map(event => ({ ...event })),
  };
}

export function setTileEffects(battle: Battle, points: GridPoint[], field: 'coverUntil' | 'mudUntil' | 'hazardUntil', until: number | undefined) {
  const rows = new Map<number, Tile[]>();
  const tiles = [...battle.map.tiles];
  for (const [x, y] of points) {
    let row = rows.get(y);
    if (!row) { row = [...tiles[y]]; rows.set(y, row); tiles[y] = row; }
    const tile = { ...row[x] };
    if (until === undefined) delete tile[field];
    else tile[field] = until;
    row[x] = tile;
    const key = `${x},${y}`;
    const change = { ...battle.tileChanges[key], x, y };
    if (until === undefined) delete change[field];
    else change[field] = until;
    if (Object.keys(change).length > 2) battle.tileChanges[key] = change;
    else delete battle.tileChanges[key];
  }
  battle.map = { ...battle.map, tiles };
}
