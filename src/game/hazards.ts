import { setTileEffects } from './clone';
import type { Battle, GridPoint, HazardZone } from './types';

function syncHazardTiles(battle: Battle, points: GridPoint[]) {
  const unique = new Map<string, GridPoint>(points.map(([x, y]): [string, GridPoint] => [`${x},${y}`, [x, y]]));
  const byExpiry = new Map<number | undefined, GridPoint[]>();
  for (const [x, y] of unique.values()) {
    const until = battle.hazardZones.reduce<number | undefined>((latest, zone) =>
      zone.until > battle.time && zone.tiles.some(([zx, zy]) => zx === x && zy === y)
        ? Math.max(latest ?? 0, zone.until) : latest, undefined);
    const group = byExpiry.get(until) ?? [];
    group.push([x, y]);
    byExpiry.set(until, group);
  }
  for (const [until, group] of byExpiry) setTileEffects(battle, group, 'hazardUntil', until);
}

/** One active zone per caster and move. The tile field is a derived overlap cache. */
export function placeHazardZone(battle: Battle, sourceId: string, moveId: string, tiles: GridPoint[], until: number) {
  const replaced = battle.hazardZones.filter(zone => zone.sourceId === sourceId && zone.moveId === moveId);
  battle.hazardZones = battle.hazardZones.filter(zone => zone.until > battle.time && !(zone.sourceId === sourceId && zone.moveId === moveId));
  const zone: HazardZone = { id: `${sourceId}:${moveId}:${battle.round}`, sourceId, moveId, tiles: tiles.map(([x, y]) => [x, y]), until };
  battle.hazardZones.push(zone);
  syncHazardTiles(battle, [...replaced.flatMap(old => old.tiles), ...zone.tiles]);
}

export function expireHazardZones(battle: Battle) {
  const expired = battle.hazardZones.filter(zone => zone.until <= battle.time);
  if (!expired.length) return;
  battle.hazardZones = battle.hazardZones.filter(zone => zone.until > battle.time);
  syncHazardTiles(battle, expired.flatMap(zone => zone.tiles));
}

/** Rebuild the cached tile expiry after loading either owned zones or legacy tiles. */
export function rebuildHazardTiles(battle: Battle) {
  const points: GridPoint[] = [];
  for (const change of Object.values(battle.tileChanges)) if (change.hazardUntil !== undefined) points.push([change.x, change.y]);
  for (const zone of battle.hazardZones) points.push(...zone.tiles);
  battle.hazardZones = battle.hazardZones.filter(zone => zone.until > battle.time);
  syncHazardTiles(battle, points);
}
