import { SPECIES } from '../content/species';
import { mobilityFor } from './mobility';
import { random } from './rng';
import type { BattleMap, DeploymentZone, GridPoint, PartyMon, Run } from './types';

const key = ([x, y]: GridPoint) => `${x},${y}`;

export function canDeploy(map: BattleMap, speciesId: string, point: GridPoint, zone: DeploymentZone): boolean {
  if (!Array.isArray(point) || point.length !== 2 || !Number.isInteger(point[0]) || !Number.isInteger(point[1])) return false;
  const [x, y] = point, tile = map.tiles[y]?.[x], species = SPECIES[speciesId];
  if (!species || !tile || map.zones[y]?.[x] !== zone || tile.kind === 'wall' || tile.kind === 'lava') return false;
  const mobility = mobilityFor(species, tile);
  return tile.kind !== 'water' || mobility.canFly || mobility.canSwim;
}

export function zoneCells(map: BattleMap, zone: DeploymentZone): GridPoint[] {
  const cells: GridPoint[] = [];
  for (let y = 0; y < map.zones.length; y++) for (let x = 0; x < map.zones[y].length; x++) {
    if (map.zones[y][x] === zone) cells.push([x, y]);
  }
  return cells;
}

/** Preserve chosen positions, then fill gaps from authored defaults and remaining ally cells. */
export function resolvePlayerDeployment(run: Run, map: BattleMap): Record<string, GridPoint> {
  const placements: Record<string, GridPoint> = {};
  const occupied = new Set<string>();
  const selected = run.selected.map(id => run.party.find(mon => mon.id === id)).filter((mon): mon is PartyMon => !!mon && mon.hp > 0);
  for (const mon of selected) {
    const point = run.deployment?.[mon.id];
    if (point && canDeploy(map, mon.species, point, 'ally') && !occupied.has(key(point))) {
      placements[mon.id] = [point[0], point[1]];
      occupied.add(key(point));
    }
  }
  const cells = zoneCells(map, 'ally');
  for (const [index, mon] of selected.entries()) {
    if (placements[mon.id]) continue;
    const point = [map.playerSpawns[index], ...cells].find(candidate => candidate && canDeploy(map, mon.species, candidate, 'ally') && !occupied.has(key(candidate)));
    if (!point) continue;
    placements[mon.id] = [point[0], point[1]];
    occupied.add(key(point));
  }
  return placements;
}

/** The solo opponent uses authored top-row starts, then falls back to its legal zone. */
export function chooseEnemyDeployment(map: BattleMap, speciesId: string, occupied: Set<string>, rng: { rngState: number }): GridPoint | undefined {
  const preferred = map.enemySpawns.filter(point => canDeploy(map, speciesId, point, 'enemy') && !occupied.has(key(point)));
  const candidates = preferred.length ? preferred : zoneCells(map, 'enemy').filter(point => canDeploy(map, speciesId, point, 'enemy') && !occupied.has(key(point)));
  if (!candidates.length) return;
  return candidates[Math.floor(random(rng) * candidates.length)];
}
