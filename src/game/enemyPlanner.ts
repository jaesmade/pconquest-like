import { itemBlocksMove, mapHeight, mapWidth, MOVES } from '../content/data';
import { active, affectedTiles, canHitWithMove, canUseMove, damagePreview, inMoveRange, type EnemyAction } from './engine';
import { AttackPositionSearch, stepCost } from './grid';
import type { Battle, GridPoint, Unit } from './types';

type Pursuit = { target: Unit; moveIds: string[] };
type Decision = { action: EnemyAction } | { pursuit?: Pursuit };
export type PlanningResult = { pending: true } | { pending: false; action: EnemyAction };
const distance = (a: Unit, b: Unit) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Each yield follows one damage evaluation, target tile, or Status move. No RNG is used. */
function* chooseImmediateAction(battle: Battle): Generator<void, Decision, void> {
  const enemy = active(battle);
  const targets = battle.units.filter(unit => unit.side === 'player' && unit.hp > 0).sort((a, b) => distance(enemy, a) - distance(enemy, b));
  const viable: { target: Unit; moves: { moveId: string; damage: number }[] }[] = [];
  for (const target of targets) {
    const moves: { moveId: string; damage: number }[] = [];
    for (const moveId of enemy.moves) {
      const damage = MOVES[moveId]?.power ? damagePreview(battle, enemy, target, moveId).damage : 0;
      if (damage > 0) moves.push({ moveId, damage });
      yield;
    }
    if (moves.length) viable.push({ target, moves: moves.sort((a, b) => b.damage - a.damage) });
  }

  if (!enemy.attackedThisTurn) for (const { target, moves } of viable) for (const { moveId } of moves) {
    const move = MOVES[moveId];
    if (enemy.ap < move.apCost) continue;
    const radiusX = move.area?.width ?? 1, radiusY = move.area?.height ?? 1;
    for (let y = Math.max(0, target.y - radiusY); y <= Math.min(mapHeight(battle.map) - 1, target.y + radiusY); y++)
      for (let x = Math.max(0, target.x - radiusX); x <= Math.min(mapWidth(battle.map) - 1, target.x + radiusX); x++) {
        const valid = canUseMove(battle, enemy, moveId, x, y)
          && affectedTiles(battle.map, moveId, x, y).some(([px, py]) => px === target.x && py === target.y);
        yield;
        if (valid) return { action: { kind: 'move-use', moveId, x, y } };
      }
  }

  if (!enemy.attackedThisTurn) for (const moveId of enemy.moves) {
    const move = MOVES[moveId];
    if (!move || move.category !== 'Status' || enemy.ap < move.apCost || itemBlocksMove(enemy, move)) { yield; continue; }
    if (move.effects?.some(effect => effect.kind === 'weather' && effect.weather === battle.weather)) { yield; continue; }
    if (move.target === 'self' && canUseMove(battle, enemy, moveId)) {
      const area = affectedTiles(battle.map, moveId, enemy.x, enemy.y);
      const stages = (move.effects ?? []).filter(effect => effect.kind === 'stage');
      let useful = !stages.length;
      for (const effect of stages) for (const unit of battle.units) {
        const applicable = unit.hp > 0 && area.some(([tx, ty]) => unit.x === tx && unit.y === ty)
          && (effect.recipients === 'self' ? unit.id === enemy.id : effect.recipients === 'allies' ? unit.side === enemy.side : unit.side !== enemy.side)
          && (effect.delta > 0 ? unit.stages[effect.stat] < 6 : unit.stages[effect.stat] > -6);
        yield;
        if (applicable) useful = true;
      }
      yield;
      if (useful) return { action: { kind: 'move-use', moveId, x: enemy.x, y: enemy.y } };
    } else if (move.target === 'tile') {
      let target: Unit | undefined;
      for (const candidate of targets) {
        const inRange = inMoveRange(battle, enemy, moveId, candidate.x, candidate.y);
        yield;
        if (inRange) { target = candidate; break; }
      }
      const useful = target && canUseMove(battle, enemy, moveId, target.x, target.y)
        && !move.effects?.some(effect => effect.kind === 'tile' && (battle.map.tiles[target.y][target.x][effect.field] ?? 0) > battle.time);
      yield;
      if (useful && target) return { action: { kind: 'move-use', moveId, x: target.x, y: target.y } };
    } else yield;
  }

  const first = viable[0];
  return { pursuit: first && enemy.ap >= 1 ? { target: first.target, moveIds: first.moves.map(candidate => candidate.moveId) } : undefined };
}

function navigationKey(battle: Battle, enemy: Unit, { target, moveIds }: Pursuit): string {
  const otherUnits = battle.units.filter(unit => unit.id !== enemy.id && unit.hp > 0)
    .map(unit => `${unit.id}:${unit.x},${unit.y}:${unit.hp}:${unit.ability}`).join('|');
  return `${battle.map.id}:${battle.time}:${battle.weather}:${enemy.id}:${enemy.mobility.canFly}:${enemy.mobility.canSwim}:${target.id}:${moveIds.join(',')}:${otherUnits}`;
}

function movementPrefix(battle: Battle, enemy: Unit, route: GridPoint[]): GridPoint[] {
  const points: GridPoint[] = [];
  let x = enemy.x, y = enemy.y, cost = 0;
  for (const [nextX, nextY] of route) {
    const nextCost = stepCost(battle, enemy, nextX, nextY, x, y);
    if (points.length >= enemy.stats[6] || cost + nextCost > enemy.ap) break;
    points.push([nextX, nextY]);
    cost += nextCost; x = nextX; y = nextY;
  }
  return points;
}

/** Keeps only derived, disposable planning state; the saved Battle remains authoritative. */
export class EnemyPlanner {
  private battle?: Battle;
  private decision?: Generator<void, Decision, void>;
  private pursuit?: Pursuit;
  private search?: AttackPositionSearch;
  private route?: GridPoint[];
  private routeKey?: string;

  reset() {
    this.battle = undefined; this.decision = undefined; this.pursuit = undefined; this.search = undefined;
    this.route = undefined; this.routeKey = undefined;
  }

  plan(battle: Battle, budget = 32): PlanningResult {
    if (battle.result || active(battle).side !== 'enemy') return { pending: false, action: { kind: 'pass' } };
    if (this.battle !== battle) {
      this.battle = battle;
      this.decision = chooseImmediateAction(battle);
      this.pursuit = undefined;
      this.search = undefined;
    }
    const enemy = active(battle);
    let remaining = Math.max(1, Math.floor(budget));
    while (this.decision && remaining > 0) {
      const result = this.decision.next();
      remaining--;
      if (!result.done) continue;
      this.decision = undefined;
      if ('action' in result.value) return { pending: false, action: result.value.action };
      this.pursuit = result.value.pursuit;
    }
    if (this.decision) return { pending: true };
    if (!this.pursuit) return { pending: false, action: { kind: 'pass' } };
    const key = navigationKey(battle, enemy, this.pursuit);
    if (this.routeKey !== key) { this.route = undefined; this.routeKey = key; this.search = undefined; }
    if (!this.route) {
      if (!this.search) {
        const { target, moveIds } = this.pursuit;
        this.search = new AttackPositionSearch(battle, enemy, (x, y) => moveIds.some(moveId => canHitWithMove(battle, { ...enemy, x, y }, moveId, target)));
      }
      const result = this.search.advance(Math.max(1, remaining));
      if (!result.done) return { pending: true };
      this.route = result.path;
      this.search = undefined;
    }
    const points = movementPrefix(battle, enemy, this.route);
    return { pending: false, action: points.length ? { kind: 'move', points } : { kind: 'pass' } };
  }

  afterCommit(action: EnemyAction, acted: boolean) {
    if (action.kind === 'move' && acted && this.route) this.route = this.route.slice(action.points.length);
    else { this.route = undefined; this.routeKey = undefined; }
    this.battle = undefined; this.decision = undefined; this.pursuit = undefined; this.search = undefined;
  }
}
