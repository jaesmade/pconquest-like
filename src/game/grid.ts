import type { Battle, BattleMap, GridPoint, Mobility, Unit } from './types';
import { canCrossElevation } from './elevation';
import { objectBlocksMovement, objectBlocksSight } from '../content/terrainObjects';

export type MovementPath = { cost: number; points: GridPoint[] };
type Node = { x: number; y: number; steps: number; cost: number; key: string };

class MinHeap {
  private data: Node[] = [];
  get size() { return this.data.length; }
  push(node: Node) {
    const data = this.data;
    data.push(node);
    for (let i = data.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (data[parent].cost <= data[i].cost) break;
      [data[parent], data[i]] = [data[i], data[parent]];
      i = parent;
    }
  }
  pop(): Node | undefined {
    const data = this.data;
    if (!data.length) return undefined;
    const first = data[0], last = data.pop()!;
    if (data.length) {
      data[0] = last;
      for (let i = 0;;) {
        const left = i * 2 + 1, right = left + 1;
        if (left >= data.length) break;
        const child = right < data.length && data[right].cost < data[left].cost ? right : left;
        if (data[i].cost <= data[child].cost) break;
        [data[i], data[child]] = [data[child], data[i]];
        i = child;
      }
    }
    return first;
  }
}

const directions: GridPoint[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const occupiedTiles = (battle: Battle) => new Set(battle.units.filter(unit => unit.hp > 0).map(unit => `${unit.x},${unit.y}`));
const pathFrom = (key: string, start: string, previous: Map<string, string>): GridPoint[] => {
  const points: GridPoint[] = [];
  while (key !== start) {
    const [x, y] = key.split(',').map(Number);
    points.push([x, y]);
    const parent = previous.get(key);
    if (!parent) throw new Error(`Missing path predecessor for ${key}`);
    key = parent;
  }
  return points.reverse();
};

/** Static movement rule shared by battle navigation and authored-map checks. */
export function canTraverseTerrain(map: BattleMap, mobility: Pick<Mobility, 'canFly' | 'canSwim'>, x: number, y: number, fromX: number, fromY: number): boolean {
  const tile = map.tiles[y]?.[x], previous = map.tiles[fromY]?.[fromX];
  if (!tile || !previous || tile.kind === 'wall' || objectBlocksMovement(tile)) return false;
  if (tile.kind === 'water' && !mobility.canSwim && !mobility.canFly) return false;
  return canCrossElevation(previous, tile, x - fromX, y - fromY, mobility.canFly);
}

/** Occupancy-free reachability for map and encounter validation; AP is not a route limit. */
export function terrainReachable(map: BattleMap, start: GridPoint, mobility: Pick<Mobility, 'canFly' | 'canSwim'>): Set<string> {
  const [startX, startY] = start, startTile = map.tiles[startY]?.[startX];
  const seen = new Set<string>();
  if (!startTile || startTile.kind === 'wall' || objectBlocksMovement(startTile)
    || (startTile.kind === 'water' && !mobility.canSwim && !mobility.canFly)) return seen;
  const frontier: GridPoint[] = [start];
  seen.add(`${startX},${startY}`);
  for (let index = 0; index < frontier.length; index++) {
    const [x, y] = frontier[index];
    for (const [dx, dy] of directions) {
      const nextX = x + dx, nextY = y + dy, key = `${nextX},${nextY}`;
      if (seen.has(key) || !canTraverseTerrain(map, mobility, nextX, nextY, x, y)) continue;
      seen.add(key);
      frontier.push([nextX, nextY]);
    }
  }
  return seen;
}

export function canEnter(battle: Battle, unit: Unit, x: number, y: number, fromX = unit.x, fromY = unit.y, occupied = occupiedTiles(battle)): boolean {
  return !occupied.has(`${x},${y}`) && canTraverseTerrain(battle.map, unit.mobility, x, y, fromX, fromY);
}

/** Soft route weight for attack-position search; terrain never changes the AP price of movement. */
export function navigationCost(battle: Battle, unit: Unit, x: number, y: number, fromX: number, fromY: number): number {
  const tile = battle.map.tiles[y][x], previous = battle.map.tiles[fromY][fromX];
  return 1 + (unit.mobility.canFly ? 0 : Math.max(0, tile.height - previous.height))
    + (!unit.mobility.canFly && tile.mudUntil && tile.mudUntil > battle.time ? 1 : 0);
}

/** The Movement stat caps tiles per command; a valid command costs one AP. */
function searchReachable(battle: Battle, unit: Unit) {
  const start = `${unit.x},${unit.y},0`;
  const best = new Map<string, number>([[start, 0]]);
  const previous = new Map<string, string>();
  const destinations = new Map<string, { cost: number; key: string }>();
  if (unit.movedThisTurn || unit.ap < 1) return { start, previous, destinations };
  const occupied = occupiedTiles(battle);
  const frontier = new MinHeap();
  frontier.push({ x: unit.x, y: unit.y, steps: 0, cost: 0, key: start });
  while (frontier.size) {
    const node = frontier.pop()!;
    if (node.cost !== best.get(node.key)) continue;
    if (node.steps >= unit.stats[6]) continue;
    for (const [dx, dy] of directions) {
      const x = node.x + dx, y = node.y + dy;
      if (!canEnter(battle, unit, x, y, node.x, node.y, occupied)) continue;
      const cost = node.cost + 1;
      const steps = node.steps + 1, stateKey = `${x},${y},${steps}`, tileKey = `${x},${y}`;
      if (cost >= (best.get(stateKey) ?? Infinity)) continue;
      best.set(stateKey, cost);
      previous.set(stateKey, node.key);
      if (cost < (destinations.get(tileKey)?.cost ?? Infinity)) destinations.set(tileKey, { cost, key: stateKey });
      frontier.push({ x, y, steps, cost, key: stateKey });
    }
  }
  return { start, previous, destinations };
}

export function reachable(battle: Battle, unit: Unit): Map<string, MovementPath> {
  const { start, previous, destinations } = searchReachable(battle, unit);
  const result = new Map<string, MovementPath>();
  for (const [tile, route] of destinations) result.set(tile, { cost: 1, points: pathFrom(route.key, start, previous) });
  return result;
}

/** Board highlights need destinations, not a copied route for every tile. */
export function reachableTiles(battle: Battle, unit: Unit): Set<string> {
  return new Set(searchReachable(battle, unit).destinations.keys());
}

export function routeTo(battle: Battle, unit: Unit, x: number, y: number): MovementPath | undefined {
  const { start, previous, destinations } = searchReachable(battle, unit);
  const destination = destinations.get(`${x},${y}`);
  return destination && { cost: 1, points: pathFrom(destination.key, start, previous) };
}

/** Derived search state can be resumed across animation frames; it never changes the battle or RNG. */
export class AttackPositionSearch {
  private readonly start: string;
  private readonly best: Map<string, number>;
  private readonly previous = new Map<string, string>();
  private readonly occupied: Set<string>;
  private readonly frontier = new MinHeap();

  constructor(private readonly battle: Battle, private readonly unit: Unit, private readonly canAttackFrom: (x: number, y: number) => boolean) {
    this.start = `${unit.x},${unit.y}`;
    this.best = new Map([[this.start, 0]]);
    this.occupied = occupiedTiles(battle);
    this.frontier.push({ x: unit.x, y: unit.y, steps: 0, cost: 0, key: this.start });
  }

  advance(maxNodes: number): { done: false } | { done: true; path: GridPoint[] } {
    let processed = 0;
    while (this.frontier.size && processed < maxNodes) {
      const node = this.frontier.pop()!;
      processed++;
      if (node.cost !== this.best.get(node.key)) continue;
      if (this.canAttackFrom(node.x, node.y)) return { done: true, path: pathFrom(node.key, this.start, this.previous) };
      for (const [dx, dy] of directions) {
        const x = node.x + dx, y = node.y + dy;
        if (!canEnter(this.battle, this.unit, x, y, node.x, node.y, this.occupied)) continue;
        const cost = node.cost + navigationCost(this.battle, this.unit, x, y, node.x, node.y), key = `${x},${y}`;
        if (cost >= (this.best.get(key) ?? Infinity)) continue;
        this.best.set(key, cost);
        this.previous.set(key, node.key);
        this.frontier.push({ x, y, steps: node.steps + 1, cost, key });
      }
    }
    return this.frontier.size ? { done: false } : { done: true, path: [] };
  }
}

/** Supercover line prevents shots through walls and diagonal wall corners. */
export function hasLineOfSight(battle: Battle, from: GridPoint, to: GridPoint): boolean {
  const source = battle.map.tiles[from[1]]?.[from[0]], target = battle.map.tiles[to[1]]?.[to[0]];
  if (!source || !target) return false;
  // A wall or solid object cannot be used as an area move's aim point.
  if (target.kind === 'wall' || objectBlocksSight(target)) return false;
  const ceiling = Math.max(source.height, target.height);
  const blocks = (x: number, y: number) => {
    const tile = battle.map.tiles[y]?.[x];
    return !tile || tile.kind === 'wall' || objectBlocksSight(tile) || tile.height > ceiling || !!(tile.coverUntil && tile.coverUntil > battle.time);
  };
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  let x = from[0], y = from[1], ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    const choice = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;
    if (choice === 0) {
      if (blocks(x + sx, y) && blocks(x, y + sy)) return false;
      x += sx; y += sy; ix++; iy++;
    } else if (choice < 0) { x += sx; ix++; }
    else { y += sy; iy++; }
    if ((x !== to[0] || y !== to[1]) && blocks(x, y)) return false;
  }
  return true;
}
