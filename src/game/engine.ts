import { abilityAbsorption, abilityContactReaction, abilityDamageMultiplier, abilityHitChance, abilitySpeedMultiplier, ENCOUNTERS, itemBlocksMove, itemCanEquip, itemFor, itemPeriodicHeal, itemSpecial, itemThresholdHeal, MAPS, mapHeight, mapWidth, MAX_EQUIPPED_MOVES, megaFormFor, MOVES, RECRUITS, SPECIES, STARTING_BAG, STARTING_HELD_ITEMS, tmMoveFor } from '../content/data';
import { MAX_RUN_POKEMON, STARTING_PARTY_POINTS, partyDraftCost } from '../content/roster';
import type { AttackVisualEvent, Battle, BattleMap, GridPoint, PartyMon, Run, Tile, Unit, Weather } from './types';
import type { ItemId } from '../content/items';
import { canEnter, hasLineOfSight, routeTo } from './grid';
import { newSeed, random } from './rng';
import { mobilityFor, syncMobility } from './mobility';
import { calculateDamage, damageRange } from './damage';
import { expireHazardZones } from './hazards';
import { emptyStageExpiry, expireStages } from './stages';
import { hasMoveTag } from '../content/moves';
import { resolveMoveEffects } from './moveEffects';
import { canDeploy, chooseEnemyDeployment, resolvePlayerDeployment } from './deployment';
import { createMap } from '../content/maps';
import { SHOP_STOCK } from '../content/shop';
import { availableRouteNodes, createRoute, routeNode, ROUTE_COLUMNS } from './route';
import type { Encounter } from './types';
import { ACTION_VALUE_PER_CYCLE, actionInterval, toActionValueDuration } from './actionValue';

export { reachable, reachableTiles } from './grid';

const max = (n: number) => Math.max(1, Math.ceil(n));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const log = (battle: Battle, message: string) => { battle.log = [message, ...battle.log].slice(0, 24); };
const feedback = (battle: Battle, kind: 'ability' | 'item', key: string, unit: Unit) => {
  battle.feedbackEvents = [...(battle.feedbackEvents ?? []), { id: crypto.randomUUID(), kind, key, unitId: unit.id }].slice(-24);
};
const hpFeedback = (battle: Battle, unit: Unit, kind: 'damage' | 'heal', amount: number, visual?: AttackVisualEvent, duringMove = false) => {
  if (amount <= 0) return;
  battle.hpEvents = [...(battle.hpEvents ?? []), { id: crypto.randomUUID(), unitId: unit.id, kind, amount, hpAfter: unit.hp, x: unit.x, y: unit.y, attackId: visual?.id, duringMove: duringMove || undefined }].slice(-48);
};
const alive = (unit: Unit) => unit.hp > 0;
export const MAX_LEVEL = 100;
export const RUN_START_LEVEL = 10;
export function encounterDefinition(run: Run): Encounter {
  const node = routeNode(run.route, run.currentNodeId);
  const template = node?.kind === 'boss' ? ENCOUNTERS.at(-1)! : ENCOUNTERS.find(encounter => encounter.id === run.encounterId) ?? ENCOUNTERS[0];
  if (!node) return template;
  if (node.kind === 'boss') return { ...template, enemies: ['lapras', 'geodude', 'pikachu', 'charmander'], enemyLevel: 21, xp: 100 };
  const level = 9 + Math.floor((node.column - 1) * 0.8) + (node.kind === 'elite' ? 3 : 0);
  return { ...template, enemies: node.kind === 'elite' ? [...template.enemies, RECRUITS[node.column % RECRUITS.length]] : template.enemies,
    enemyLevel: level, xp: node.kind === 'elite' ? 85 : 65, objective: 'defeat' };
}
export const unitAt = (battle: Battle, x: number, y: number) => battle.units.find(unit => alive(unit) && unit.x === x && unit.y === y);
export const active = (battle: Battle) => battle.units.find(unit => unit.id === battle.current)!;
export const effectiveSpeed = (unit: Unit, battle: Battle) => Math.max(0.5, unit.stats[5] * abilitySpeedMultiplier(unit, battle.weather) * (unit.status.paralyzed > battle.time ? 0.5 : 1));
export const apGain = (_unit: Unit, _battle: Battle) => 3;
const scaleStats = (stats: Unit['stats'], level: number) => stats.map((base, index) =>
  index === 6 ? base : Math.floor(2 * base * level / 100) + (index === 0 ? level + 10 : 5)) as Unit['stats'];
export const statsAtLevel = (species: string, level: number) => scaleStats(SPECIES[species].stats, level);
export const xpForLevel = (level: number) => (level - 1) * 65;
export const learnedAtLevel = (species: string, level: number) => [...new Set([...SPECIES[species].moves, ...Object.entries(SPECIES[species].learn).filter(([required]) => Number(required) <= level).map(([, move]) => move)])];
export const defaultLoadoutAtLevel = (species: string, level: number) => {
  const starting = SPECIES[species].moves;
  const recent = learnedAtLevel(species, level).filter(id => !starting.includes(id)).reverse();
  return [...new Set([...starting.slice(0, 2), ...recent, ...starting.slice(2)])].slice(0, MAX_EQUIPPED_MOVES);
};
const makePartyMon = (species: string, level = RUN_START_LEVEL, item: ItemId = 'None'): PartyMon => ({ id: crypto.randomUUID(), species, level, xp: xpForLevel(level), hp: statsAtLevel(species, level)[0], learned: learnedAtLevel(species, level), equipped: defaultLoadoutAtLevel(species, level), item });
const recruitLevel = (run: Run) => Math.max(RUN_START_LEVEL, ...run.party.map(mon => mon.level));
export function newRun(selectedSpecies: string[], unlocks = 0): Run {
  const draft = [...new Set(selectedSpecies)];
  if (!draft.length || draft.length > MAX_RUN_POKEMON || draft.some(id => !SPECIES[id] || SPECIES[id].form?.kind === 'mega')
    || partyDraftCost(draft) > STARTING_PARTY_POINTS) throw new Error('Choose a valid starting party within the available points.');
  const seed = newSeed(), rng = { rngState: seed };
  const party = draft.map((id, i) => makePartyMon(id, RUN_START_LEVEL, STARTING_HELD_ITEMS[i] ?? 'None'));
  return { phase: 'route', party, selected: party.slice(0, 6).map(p => p.id), deployment: {}, bag: [...STARTING_BAG], pendingMoves: [], coins: 20, encounter: 0, encounterId: ENCOUNTERS[0].id, seed, rngState: rng.rngState, route: createRoute(seed), routeChoice: 'rest', report: [], unlocks };
}
function makeUnit(mon: PartyMon, side: Unit['side'], x: number, y: number, tile: Tile): Unit {
  const species = SPECIES[mon.species];
  const stats = statsAtLevel(mon.species, mon.level);
  return { id: crypto.randomUUID(), partyId: side === 'player' ? mon.id : undefined, side, species: mon.species, name: species.name, level: mon.level, types: species.types, moves: [...mon.equipped], mobility: mobilityFor(species, tile), ability: species.ability, stats, hp: Math.min(mon.hp, stats[0]), maxHp: stats[0], x, y, facing: side === 'player' ? 3 : 0, ap: 0, maxAp: 0, movedThisTurn: false, attackedThisTurn: false, nextAction: 0, nextActionShift: 0, scheduledSpeed: stats[5], status: {}, stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0 }, stageUntil: emptyStageExpiry(), item: mon.item, itemAttackMultiplier: 1 };
}
export function startBattle(run: Run, enemyDeployment?: GridPoint[]): Run {
  const next = { ...run };
  const definition = encounterDefinition(next);
  const map = structuredClone(MAPS[definition.mapId]);
  const selected = next.selected.map(id => next.party.find(mon => mon.id === id)).filter((mon): mon is PartyMon => !!mon && mon.hp > 0).slice(0, 6);
  if (!selected.length) return { ...next, phase: 'result', result: 'loss' };
  const deployment = resolvePlayerDeployment(next, map);
  if (selected.some(mon => !deployment[mon.id])) throw new Error(`Map ${map.id}: no legal ally deployment for the selected team.`);
  next.deployment = deployment;
  const players = selected.map(mon => { const [x, y] = deployment[mon.id]; return makeUnit(mon, 'player', x, y, map.tiles[y][x]); });
  const battle: Battle = { map, tileChanges: {}, hazardZones: [], objective: definition.objective, units: players, weather: map.weather, weatherUntil: map.weather === 'clear' ? 0 : 3 * ACTION_VALUE_PER_CYCLE, time: 0, round: 1, turnOrder: [], turnIndex: 0, current: '', rngState: next.rngState, log: [`${map.name}: defeat the opposing team${definition.objective === 'defeat-and-capture' ? ' and hold the capture tile' : ''}.`], visualEvents: [], feedbackEvents: [], hpEvents: [], captureHeld: false, encounterId: definition.id };
  const occupied = new Set(players.map(unit => `${unit.x},${unit.y}`));
  if (enemyDeployment && enemyDeployment.length !== definition.enemies.length) throw new Error(`Map ${map.id}: enemy deployment count does not match the team.`);
  for (const [index, id] of definition.enemies.entries()) {
    const chosen = enemyDeployment?.[index];
    if (enemyDeployment && !chosen) throw new Error(`Map ${map.id}: missing enemy-zone placement for ${id}.`);
    if (chosen && (!canDeploy(map, id, chosen, 'enemy') || occupied.has(`${chosen[0]},${chosen[1]}`))) throw new Error(`Map ${map.id}: invalid enemy-zone placement for ${id}.`);
    const point = chosen ?? chooseEnemyDeployment(map, id, occupied, battle);
    if (!point) throw new Error(`Map ${map.id}: no legal enemy deployment for ${id}.`);
    const [x, y] = point;
    occupied.add(`${x},${y}`);
    battle.units.push(makeUnit(makePartyMon(id, definition.enemyLevel), 'enemy', x, y, map.tiles[y][x]));
  }
  next.battle = battle;
  next.phase = 'battle';
  for (const unit of battle.units) unit.scheduledSpeed = effectiveSpeed(unit, battle);
  activateNext(battle, true);
  return next;
}
function nextSpeedExpiry(battle: Battle) {
  const expiries = battle.units.filter(alive).map(unit => unit.status.paralyzed).filter(until => until > battle.time);
  if (battle.weather !== 'clear' && battle.weatherUntil > battle.time) expiries.push(battle.weatherUntil);
  return expiries.length ? Math.min(...expiries) : Number.POSITIVE_INFINITY;
}
function refreshTurnOrder(battle: Battle) {
  const previous = new Map(battle.turnOrder.map((id, index) => [id, index]));
  const ordered = battle.units.filter(alive).sort((a, b) => a.nextAction - b.nextAction
    || (previous.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (previous.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  if (battle.current && ordered[0]?.id !== battle.current) {
    const currentIndex = ordered.findIndex(unit => unit.id === battle.current);
    if (currentIndex >= 0) ordered.unshift(...ordered.splice(currentIndex, 1));
  }
  battle.turnOrder = ordered.map(unit => unit.id);
  battle.turnIndex = 0;
}
function rescheduleForSpeedChanges(battle: Battle) {
  for (const unit of battle.units.filter(alive)) {
    const oldSpeed = unit.scheduledSpeed;
    const newSpeed = effectiveSpeed(unit, battle);
    if (oldSpeed > 0 && Math.abs(oldSpeed - newSpeed) > 1e-9 && unit.id !== battle.current && unit.nextAction > battle.time) {
      const remaining = unit.nextAction - battle.time;
      unit.nextAction = battle.time + remaining * oldSpeed / newSpeed;
    }
    unit.scheduledSpeed = newSpeed;
  }
}
function processCycle(battle: Battle) {
  battle.round++;
  expireHazardZones(battle);
  for (const unit of battle.units) expireStages(unit, battle.time);
  for (const unit of battle.units.filter(alive)) {
    if (battle.weather === 'sandstorm' && !unit.types.some(type => ['Rock', 'Steel', 'Ground'].includes(type))) hit(battle, unit, max(unit.maxHp / 16), 'sandstorm');
    if (alive(unit) && unit.status.burned >= battle.time) hit(battle, unit, max(unit.maxHp / 16), 'Burn');
    if (alive(unit)) { const fraction = itemPeriodicHeal(unit); if (fraction) heal(battle, unit, max(unit.maxHp * fraction), unit.item); }
    if (alive(unit) && battle.map.tiles[unit.y][unit.x].kind === 'lava' && !unit.mobility.canFly) hit(battle, unit, max(unit.maxHp / 10), 'lava');
  }
  checkResult(battle);
}
function processTimedEventsAtCurrentTime(battle: Battle) {
  while (battle.round * ACTION_VALUE_PER_CYCLE <= battle.time + 1e-9 && !battle.result) processCycle(battle);
  expireHazardZones(battle);
  for (const unit of battle.units) expireStages(unit, battle.time);
  if (battle.weather !== 'clear' && battle.weatherUntil <= battle.time) { battle.weather = 'clear'; log(battle, 'The weather cleared.'); }
  rescheduleForSpeedChanges(battle);
}

export type LabConfig = { allySpecies: string; enemySpecies: string; allyLevel: number; enemyLevel: number; allyItem: ItemId; enemyItem: ItemId; weather: Weather; seed: number };

/** Disposable 1v1 battle. It shares the campaign's unit, turn, damage, and effect rules. */
export function createLabBattle(config: LabConfig): Battle {
  for (const id of [config.allySpecies, config.enemySpecies]) if (!SPECIES[id]) throw new Error(`Unknown lab species ${id}`);
  for (const level of [config.allyLevel, config.enemyLevel]) if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new Error('Lab levels must be 1–100.');
  if (!itemCanEquip(config.allyItem, config.allySpecies) || !itemCanEquip(config.enemyItem, config.enemySpecies)) throw new Error('Invalid lab held item.');
  const map = createMap({ id: 'battle-lab', name: 'Battle Lab', weather: config.weather,
    terrain: Array(5).fill('.....'), elevation: Array(5).fill('00000'), zones: ['EEEEE', 'EEEEE', 'NNNNN', 'AAAAA', 'AAAAA'],
    playerSpawns: [[2, 3]], enemySpawns: [[2, 1]] });
  const ally = makeUnit(makePartyMon(config.allySpecies, config.allyLevel, config.allyItem), 'player', 2, 3, map.tiles[3][2]);
  const enemy = makeUnit(makePartyMon(config.enemySpecies, config.enemyLevel, config.enemyItem), 'enemy', 2, 1, map.tiles[1][2]);
  // The lab uses each level's default four-move loadout, including newly learned moves.
  const battle: Battle = { map, tileChanges: {}, hazardZones: [], objective: 'defeat', units: [ally, enemy], weather: config.weather,
    weatherUntil: config.weather === 'clear' ? 0 : 3 * ACTION_VALUE_PER_CYCLE, time: 0, round: 1, turnOrder: [], turnIndex: 0,
    current: '', rngState: config.seed >>> 0 || 1, log: [`Battle Lab · seed ${config.seed >>> 0 || 1}. Control both Pokémon.`],
    visualEvents: [], feedbackEvents: [], hpEvents: [], captureHeld: false, encounterId: 'battle-lab' };
  for (const unit of battle.units) unit.scheduledSpeed = effectiveSpeed(unit, battle);
  activateNext(battle, true);
  return battle;
}
function activateNext(battle: Battle, initial = false) {
  while (!battle.result) {
    const living = battle.units.filter(alive);
    if (!living.length) { checkResult(battle); refreshTurnOrder(battle); return; }
    const nextTime = Math.min(...living.map(unit => unit.nextAction));
    const cycleTime = battle.round * ACTION_VALUE_PER_CYCLE;
    const speedExpiry = nextSpeedExpiry(battle);
    const eventTime = Math.min(cycleTime, speedExpiry);
    if (eventTime <= nextTime + 1e-9 && eventTime > battle.time + 1e-9) {
      battle.time = eventTime;
      processTimedEventsAtCurrentTime(battle);
      if (battle.result) { refreshTurnOrder(battle); return; }
      continue;
    }
    battle.time = Math.max(battle.time, nextTime);
    processTimedEventsAtCurrentTime(battle);
    if (battle.result) { refreshTurnOrder(battle); return; }
    const due = living.filter(unit => Math.abs(unit.nextAction - nextTime) <= 1e-9);
    const previousOrder = new Map(battle.turnOrder.map((id, index) => [id, index]));
    const dueOrder = [...due];
    if (dueOrder.length > 1) {
      if (dueOrder.every(candidate => previousOrder.has(candidate.id))) dueOrder.sort((a, b) => previousOrder.get(a.id)! - previousOrder.get(b.id)!);
      else for (let index = dueOrder.length - 1; index > 0; index--) {
        const swap = Math.floor(random(battle) * (index + 1));
        [dueOrder[index], dueOrder[swap]] = [dueOrder[swap], dueOrder[index]];
      }
    }
    const tieOrder = new Map(dueOrder.map((candidate, index) => [candidate.id, index]));
    const queue = living.sort((a, b) => a.nextAction - b.nextAction
      || (tieOrder.get(a.id) ?? previousOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER)
        - (tieOrder.get(b.id) ?? previousOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    const unit = dueOrder[0];
    battle.turnOrder = queue.map(candidate => candidate.id);
    battle.turnIndex = 0;
    battle.current = unit.id;
    unit.maxAp = apGain(unit, battle);
    if (abilitySpeedMultiplier(unit, battle.weather) > 1) feedback(battle, 'ability', unit.ability, unit);
    const bankedAp = unit.ap;
    unit.ap = Math.min(Number.MAX_SAFE_INTEGER, bankedAp + unit.maxAp);
    unit.movedThisTurn = false;
    unit.attackedThisTurn = false;
    if (initial) log(battle, `Action timeline started · ${unit.name} acts first.`);
    log(battle, `${unit.name}'s turn · ${unit.ap} AP (${bankedAp} banked + ${unit.maxAp} gained) · AV ${Math.floor(battle.time)}`);
    return;
  }
}
function endCurrentTurn(battle: Battle) {
  if (battle.result) return;
  rescheduleForSpeedChanges(battle);
  const unit = battle.units.find(candidate => candidate.id === battle.current);
  if (unit && alive(unit)) {
    unit.scheduledSpeed = effectiveSpeed(unit, battle);
    unit.nextAction = Math.max(battle.time, battle.time + actionInterval(unit.scheduledSpeed) + unit.nextActionShift);
    unit.nextActionShift = 0;
  }
  battle.current = '';
  activateNext(battle);
}
function hit(battle: Battle, unit: Unit, amount: number, source: string, visual?: AttackVisualEvent, duringMove = false) {
  if (!alive(unit)) return;
  const lost = Math.min(unit.hp, amount);
  unit.hp = Math.max(0, unit.hp - amount);
  hpFeedback(battle, unit, 'damage', lost, visual, duringMove);
  unit.visual = unit.hp ? 'hurt' : 'faint'; unit.visualNonce = (unit.visualNonce ?? 0) + 1;
  log(battle, `${unit.name} took ${amount} damage from ${source}${unit.hp ? '.' : ' and fainted!'}`);
  const thresholdHeal = itemThresholdHeal(unit);
  if (thresholdHeal) { const item = unit.item; if (thresholdHeal.consume) unit.item = 'None'; heal(battle, unit, max(unit.maxHp * thresholdHeal.fraction), item, visual, duringMove); }
}
function heal(battle: Battle, unit: Unit, amount: number, source: string, visual?: AttackVisualEvent, duringMove = false) {
  if (!alive(unit)) return;
  const restored = Math.min(amount, unit.maxHp - unit.hp);
  if (restored > 0) { unit.hp += restored; hpFeedback(battle, unit, 'heal', restored, visual, duringMove); unit.visual = 'buff'; unit.visualNonce = (unit.visualNonce ?? 0) + 1; log(battle, `${unit.name} recovered ${restored} HP with ${source}.`); if (itemFor(source)) feedback(battle, 'item', source, unit); }
}
function checkResult(battle: Battle) {
  const wasHeld = battle.captureHeld;
  battle.captureHeld = !!battle.map.capture && battle.units.some(unit => alive(unit) && unit.side === 'player' && unit.x === battle.map.capture![0] && unit.y === battle.map.capture![1]);
  if (battle.captureHeld && !wasHeld) log(battle, 'Capture point secured!');
  if (!battle.captureHeld && wasHeld) log(battle, 'Capture point lost.');
  if (!battle.units.some(u => u.side === 'player' && alive(u))) battle.result = 'loss';
  else if (!battle.units.some(u => u.side === 'enemy' && alive(u))) {
    if (battle.objective === 'defeat' || battle.captureHeld) battle.result = 'win';
  }
}
function applyTileEntry(battle: Battle, unit: Unit, visual?: AttackVisualEvent, duringMove = false) {
  const tile = battle.map.tiles[unit.y][unit.x];
  if (tile.kind === 'lava' && !unit.mobility.canFly) hit(battle, unit, max(unit.maxHp / 10), 'lava', visual, duringMove);
  if (alive(unit) && tile.hazardUntil && tile.hazardUntil > battle.time) hit(battle, unit, max(unit.maxHp / 8), 'Stealth Rock', visual, duringMove);
  checkResult(battle);
}
export function moveUnit(battle: Battle, x: number, y: number): string | undefined {
  const unit = battle.units.find(candidate => candidate.id === battle.current);
  if (battle.result || !unit || !alive(unit) || !Number.isInteger(x) || !Number.isInteger(y)) return 'Movement is unavailable.';
  if (unit.movedThisTurn) return 'This Pokémon has already moved this turn.';
  if (unit.ap < 1) return 'Movement needs 1 AP.';
  const route = routeTo(battle, unit, x, y);
  if (!route) return 'Tile is out of reach.';
  travelPath(battle, unit, route.points);
}
function travelPath(battle: Battle, unit: Unit, points: GridPoint[]) {
  unit.ap -= 1;
  unit.movedThisTurn = true;
  unit.visualFrom = [unit.x, unit.y];
  const travelled: GridPoint[] = [];
  for (const [nextX, nextY] of points) {
    unit.facing = nextX > unit.x ? 2 : nextX < unit.x ? 1 : nextY < unit.y ? 3 : 0;
    unit.x = nextX; unit.y = nextY;
    syncMobility(unit, battle.map.tiles[nextY][nextX]);
    travelled.push([nextX, nextY]);
    applyTileEntry(battle, unit, undefined, true);
    if (!alive(unit) || battle.result) break;
  }
  unit.visualPath = travelled;
  unit.visual = 'move'; unit.visualNonce = (unit.visualNonce ?? 0) + 1;
  log(battle, `${unit.name} moved to ${unit.x + 1}, ${unit.y + 1} for 1 AP.`);
}
function moveUnitAlongPath(battle: Battle, unit: Unit, points: GridPoint[]): boolean {
  if (unit.movedThisTurn || unit.ap < 1 || !points.length || points.length > unit.stats[6]) return false;
  let x = unit.x, y = unit.y;
  for (const [nextX, nextY] of points) {
    if (distance({ x, y }, { x: nextX, y: nextY }) !== 1 || !canEnter(battle, unit, nextX, nextY, x, y)) return false;
    x = nextX; y = nextY;
  }
  travelPath(battle, unit, points);
  return true;
}
export function damagePreview(battle: Battle, source: Unit, target: Unit, moveId: string) {
  return damageRange(battle, source, target, MOVES[moveId]);
}
export function inMoveRange(battle: Battle, unit: Unit, moveId: string, x: number, y: number) {
  const move = MOVES[moveId];
  if (!move) return false;
  if (move.target === 'self') return x === unit.x && y === unit.y;
  const tile = battle.map.tiles[y]?.[x]; if (!tile) return false;
  const range = move.range + (battle.map.tiles[unit.y][unit.x].height > tile.height ? 1 : 0);
  return distance(unit, { x, y }) <= range && hasLineOfSight(battle, [unit.x, unit.y], [x, y]);
}
export function affectedTiles(map: BattleMap, moveId: string, x: number, y: number): [number, number][] {
  const area = MOVES[moveId]?.area;
  const width = area?.width ?? 1, height = area?.height ?? 1;
  const startX = x - (area?.anchor === 'center' ? Math.floor(width / 2) : 0);
  const startY = y - (area?.anchor === 'center' ? Math.floor(height / 2) : 0);
  const positions: [number, number][] = [];
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
    const px = startX + dx, py = startY + dy;
    if (px >= 0 && px < mapWidth(map) && py >= 0 && py < mapHeight(map)) positions.push([px, py]);
  }
  return positions;
}
export function canHitAtTarget(battle: Battle, unit: Unit, moveId: string, x: number, y: number, target: Unit) {
  const move = MOVES[moveId];
  if (!move?.power || target.side === unit.side || !alive(target) || !inMoveRange(battle, unit, moveId, x, y)) return false;
  if (move.target === 'unit') return target.x === x && target.y === y;
  return move.target === 'tile'
    && affectedTiles(battle.map, moveId, x, y).some(([tx, ty]) => tx === target.x && ty === target.y)
    && hasLineOfSight(battle, [unit.x, unit.y], [target.x, target.y]);
}
export function canHitWithMove(battle: Battle, unit: Unit, moveId: string, target: Unit) {
  const move = MOVES[moveId];
  if (!move || !move.power || target.side === unit.side || !alive(target)) return false;
  if (move.target === 'unit') return canHitAtTarget(battle, unit, moveId, target.x, target.y, target);
  if (move.target !== 'tile') return false;
  const radiusX = move.area?.width ?? 1, radiusY = move.area?.height ?? 1;
  for (let y = Math.max(0, target.y - radiusY); y <= Math.min(mapHeight(battle.map) - 1, target.y + radiusY); y++)
    for (let x = Math.max(0, target.x - radiusX); x <= Math.min(mapWidth(battle.map) - 1, target.x + radiusX); x++) {
    if (canHitAtTarget(battle, unit, moveId, x, y, target)) return true;
  }
  return false;
}
function validTarget(battle: Battle, unit: Unit, moveId: string, x: number, y: number) {
  const move = MOVES[moveId];
  if (!inMoveRange(battle, unit, moveId, x, y)) return false;
  if (move.target === 'unit') { const target = unitAt(battle, x, y); return !!target && target.side !== unit.side; }
  return true;
}
export function canUseMove(battle: Battle, unit: Unit, moveId: string, x = unit.x, y = unit.y) {
  const move = MOVES[moveId];
  if (!move || !unit.moves.includes(moveId) || unit.ap < move.apCost || unit.attackedThisTurn || !alive(unit) || battle.result || battle.current !== unit.id) return false;
  if (itemBlocksMove(unit, move)) return false;
  return validTarget(battle, unit, moveId, x, y);
}
function applyDamage(battle: Battle, source: Unit, target: Unit, moveId: string, visual: AttackVisualEvent, secondary?: { damageFraction: number }) {
  const move = MOVES[moveId];
  const hitChance = abilityHitChance(target.ability, battle.weather);
  const miss = hitChance < 1 && random(battle) >= hitChance;
  if (miss) { feedback(battle, 'ability', target.ability, target); log(battle, `${source.name}'s ${move.name} missed ${target.name}.`); return; }
  const absorption = abilityAbsorption(target.ability, move.type);
  if (absorption?.kind === 'heal') { feedback(battle, 'ability', target.ability, target); heal(battle, target, max(target.maxHp * (absorption.healFraction ?? 0)), target.ability, visual); return; }
  if (absorption?.kind === 'charge') { feedback(battle, 'ability', target.ability, target); if (absorption.status) target.status[absorption.status] = 1; log(battle, `${target.name} absorbed ${move.type} with ${target.ability}.`); return; }
  const preview = damagePreview(battle, source, target, moveId);
  if (!preview.type) { log(battle, `${target.name} is immune to ${move.type}.`); return; }
  const critical = random(battle) < 1 / 24;
  const randomPercent = 85 + Math.floor(random(battle) * 16);
  const baseDamage = calculateDamage(battle, source, target, move, { critical, randomPercent });
  const damage = secondary ? max(baseDamage * secondary.damageFraction) : baseDamage;
  if (!visual.abilityTriggered && abilityDamageMultiplier(source, move) > 1) {
    feedback(battle, 'ability', source.ability, source);
    visual.abilityTriggered = true;
  }
  visual.targetIds.push(target.id);
  hit(battle, target, damage, `${move.name}${secondary ? ' chain' : ''}${critical ? ' (critical)' : ''} · ${preview.type}×`, visual);
  // A chain is a separate damage-only hit: it rolls against this defender, but cannot
  // repeat the primary hit's contact reactions, status effects, or further chains.
  if (secondary) return;
  if (!alive(target)) return;
  const reaction = hasMoveTag(move, 'contact') && abilityContactReaction(target.ability);
  if (reaction && random(battle) < reaction.chance) { feedback(battle, 'ability', target.ability, target); source.status[reaction.status] = battle.time + toActionValueDuration(reaction.duration); log(battle, `${source.name} was ${reaction.status} by ${target.ability}.`); }
  resolveMoveEffects('hit', move.effects, { battle, source, target, move, moveId, tiles: visual.tiles, visual,
    log: message => log(battle, message), enterTile: unit => applyTileEntry(battle, unit, visual),
    chainHit: (unit, fraction) => applyDamage(battle, source, unit, moveId, visual, { damageFraction: fraction }) });
}
export function useMove(battle: Battle, moveId: string, x: number, y: number): string | undefined {
  const unit = battle.units.find(candidate => candidate.id === battle.current), move = MOVES[moveId];
  if (battle.result || !unit || !move || !Number.isInteger(x) || !Number.isInteger(y)) return 'Move unavailable or target out of range.';
  if (!canUseMove(battle, unit, moveId, x, y)) return 'Move unavailable or target out of range.';
  unit.facing = x > unit.x ? 2 : x < unit.x ? 1 : y < unit.y ? 3 : 0;
  unit.ap -= move.apCost;
  unit.attackedThisTurn = true;
  unit.visual = move.category === 'Status' ? 'buff' : 'attack'; unit.visualNonce = (unit.visualNonce ?? 0) + 1;
  const tiles = affectedTiles(battle.map, moveId, x, y);
  const visualTiles = move.power && move.target === 'tile'
    ? tiles.filter(([tx, ty]) => hasLineOfSight(battle, [unit.x, unit.y], [tx, ty])) : tiles;
  const visual: AttackVisualEvent = { id: crypto.randomUUID(), moveId, sourceId: unit.id, from: [unit.x, unit.y], to: [x, y], tiles: [...visualTiles], targetIds: [] };
  battle.visualEvents.push(visual);
  // Recent presentation cues are disposable; battle rules, RNG, and log live elsewhere.
  battle.visualEvents = battle.visualEvents.slice(-24);
  log(battle, `${unit.name} used ${move.name} for ${move.apCost} AP.`);
  resolveMoveEffects('cast', move.effects, { battle, source: unit, move, moveId, tiles, visual,
    log: message => log(battle, message), enterTile: other => applyTileEntry(battle, other, visual),
    chainHit: (other, fraction) => applyDamage(battle, unit, other, moveId, visual, { damageFraction: fraction }) });
  if (move.power) for (const target of battle.units.filter(other => canHitAtTarget(battle, unit, moveId, x, y, other))) applyDamage(battle, unit, target, moveId, visual);
  if (visual.targetIds.length) visual.hpAfter = Object.fromEntries(visual.targetIds.map(id => [id, battle.units.find(target => target.id === id)!.hp]));
  checkResult(battle);
}
export function useSpecial(battle: Battle): string | undefined {
  const unit = battle.units.find(candidate => candidate.id === battle.current);
  if (battle.result || !unit || !alive(unit)) return 'No usable Special action.';
  const special = itemSpecial(unit);
  if (!special) return 'No usable Special action or insufficient AP.';
  const form = special.kind === 'mega-evolve' ? megaFormFor(unit.species, unit.item) : undefined;
  if (special.kind === 'mega-evolve' && !form) return 'No compatible Mega form.';
  const usedItem = unit.item;
  unit.ap -= special.apCost;
  if (special.kind === 'attack-boost') { unit.itemAttackMultiplier = special.attackMultiplier; if (special.consume) unit.item = 'None'; log(battle, `${unit.name}'s Attack is now ×${special.attackMultiplier}.`); }
  else if (form) {
    const oldMax = unit.maxHp;
    unit.species = form.id; unit.name = form.species.name; unit.types = [...form.species.types]; unit.ability = form.species.ability;
    unit.mobility = mobilityFor(form.species, battle.map.tiles[unit.y][unit.x]);
    unit.stats = statsAtLevel(form.id, unit.level); unit.maxHp = unit.stats[0]; unit.hp += unit.maxHp - oldMax;
    log(battle, `${unit.name} Mega Evolved!`);
  }
  unit.visual = 'special'; unit.visualNonce = (unit.visualNonce ?? 0) + 1;
  feedback(battle, 'item', usedItem, unit);
}
export type EnemyAction = { kind: 'move'; points: GridPoint[] } | { kind: 'move-use'; moveId: string; x: number; y: number } | { kind: 'pass' };

/** Commit exactly one enemy action. Planning and animation never consume the battle RNG. */
export function commitEnemyAction(battle: Battle, action: EnemyAction): boolean {
  if (battle.result || active(battle).side !== 'enemy') return false;
  const unit = active(battle), before = unit.ap;
  let acted = false;
  if (action.kind === 'move-use') acted = !useMove(battle, action.moveId, action.x, action.y);
  else if (action.kind === 'move') acted = moveUnitAlongPath(battle, unit, action.points);
  if (battle.result) { refreshTurnOrder(battle); return acted; }
  if (!acted || !alive(unit) || unit.ap < 1) endCurrentTurn(battle);
  else {
    rescheduleForSpeedChanges(battle);
    refreshTurnOrder(battle);
    if (unit.ap >= before) throw new Error(`Enemy ${unit.id} acted without spending AP.`);
  }
  return acted;
}
export function finishTurn(battle: Battle) {
  if (battle.result) { refreshTurnOrder(battle); return; }
  rescheduleForSpeedChanges(battle);
  refreshTurnOrder(battle);
  if (!alive(active(battle)) || active(battle).ap < 1) endCurrentTurn(battle);
}
export function passTurn(battle: Battle) { if (!battle.result) endCurrentTurn(battle); }
export function upcoming(battle: Battle) {
  const remaining = battle.turnOrder.map(id => battle.units.find(unit => unit.id === id)).filter((unit): unit is Unit => !!unit && alive(unit));
  return remaining.slice(0, 6);
}
export function completeBattle(run: Run): Run {
  if (!run.battle?.result) return run;
  const battle = run.battle;
  const next: Run = { ...run, party: run.party.map(mon => ({ ...mon, learned: [...mon.learned], equipped: [...mon.equipped] })), pendingMoves: [] };
  next.rngState = battle.rngState;
  for (const mon of next.party) { const unit = battle.units.find(u => u.partyId === mon.id); if (unit) { mon.hp = Math.min(unit.hp, statsAtLevel(mon.species, mon.level)[0]); mon.item = unit.item; } }
  if (battle.result === 'loss') { next.phase = 'result'; next.result = 'loss'; next.battle = undefined; return next; }
  const report: string[] = [];
  const node = routeNode(next.route, next.currentNodeId);
  const earnedXp = encounterDefinition(next).xp;
  next.coins += node?.kind === 'boss' ? 30 : node?.kind === 'elite' ? 20 : 12;
  report.push(`Earned ${node?.kind === 'boss' ? 30 : node?.kind === 'elite' ? 20 : 12} coins.`);
  for (const mon of next.party) {
    const previousLevel = mon.level;
    mon.xp += earnedXp; report.push(`${SPECIES[mon.species].name} gained ${earnedXp} XP.`);
    while (mon.level < MAX_LEVEL && mon.xp >= xpForLevel(mon.level + 1)) {
      const oldMax = statsAtLevel(mon.species, mon.level)[0]; mon.level++;
      if (mon.hp > 0) mon.hp += statsAtLevel(mon.species, mon.level)[0] - oldMax;
      report.push(`${SPECIES[mon.species].name} reached level ${mon.level}.`);
    }
    mon.xp = Math.min(mon.xp, xpForLevel(MAX_LEVEL));
    for (const [level, move] of Object.entries(SPECIES[mon.species].learn)) if (Number(level) > previousLevel && mon.level >= Number(level) && !mon.learned.includes(move)) {
      mon.learned.push(move);
      next.pendingMoves.push({ monId: mon.id, moveId: move });
      report.push(`${SPECIES[mon.species].name} can learn ${MOVES[move].name}.`);
    }
  }
  next.report = report; next.phase = 'intermission'; next.battle = undefined;
  return next;
}
export function evolve(run: Run, id: string) {
  if (run.phase !== 'route') return run;
  const next = structuredClone(run), mon = next.party.find(p => p.id === id);
  if (!mon) return next;
  const evolution = SPECIES[mon.species].evolves;
  if (!evolution || mon.level < evolution.level) return next;
  const hpGain = statsAtLevel(evolution.into, mon.level)[0] - statsAtLevel(mon.species, mon.level)[0];
  mon.species = evolution.into; if (mon.hp > 0) mon.hp += hpGain;
  for (const move of SPECIES[mon.species].moves) if (!mon.learned.includes(move)) mon.learned.push(move);
  for (const [level, move] of Object.entries(SPECIES[mon.species].learn)) if (mon.level >= Number(level) && !mon.learned.includes(move)) mon.learned.push(move);
  next.report.push(`Evolved into ${SPECIES[mon.species].name}!`);
  return next;
}
/** Resolve only the next saved level-up offer. Passing no slot keeps the current four moves. */
export function resolveLevelMove(run: Run, monId: string, moveId: string, replaceSlot?: number): Run {
  if (run.phase !== 'intermission' || run.pendingMoves[0]?.monId !== monId || run.pendingMoves[0]?.moveId !== moveId) return run;
  const mon = run.party.find(candidate => candidate.id === monId);
  if (!mon || !mon.learned.includes(moveId)) return run;
  if (replaceSlot !== undefined && (!Number.isInteger(replaceSlot) || replaceSlot < 0 || replaceSlot >= Math.min(MAX_EQUIPPED_MOVES, mon.equipped.length + 1))) return run;
  const next = structuredClone(run);
  const recipient = next.party.find(candidate => candidate.id === monId)!;
  if (replaceSlot !== undefined && !recipient.equipped.includes(moveId)) recipient.equipped[replaceSlot] = moveId;
  next.pendingMoves.shift();
  next.report.push(replaceSlot === undefined ? `${SPECIES[recipient.species].name} kept its current moves.` : `${SPECIES[recipient.species].name} equipped ${MOVES[moveId].name}.`);
  return next;
}
/** TMs are single-use Bag items; their compatible species and replacement slot are validated here. */
export function teachTm(run: Run, item: ItemId, monId: string, replaceSlot?: number): Run {
  if (run.phase !== 'route' || !run.bag.includes(item)) return run;
  const moveId = tmMoveFor(item);
  const mon = run.party.find(candidate => candidate.id === monId);
  if (!moveId || !MOVES[moveId] || !mon || !SPECIES[mon.species].tmMoves?.includes(moveId) || mon.equipped.includes(moveId)) return run;
  if (mon.equipped.length >= MAX_EQUIPPED_MOVES) {
    if (replaceSlot === undefined || !Number.isInteger(replaceSlot) || replaceSlot < 0 || replaceSlot >= MAX_EQUIPPED_MOVES) return run;
  } else if (replaceSlot !== undefined) return run;
  const next = structuredClone(run);
  const recipient = next.party.find(candidate => candidate.id === monId)!;
  if (!recipient.learned.includes(moveId)) recipient.learned.push(moveId);
  if (replaceSlot === undefined) recipient.equipped.push(moveId);
  else recipient.equipped[replaceSlot] = moveId;
  next.bag.splice(next.bag.indexOf(item), 1);
  next.report.push(`${SPECIES[recipient.species].name} learned ${MOVES[moveId].name} from ${item}.`);
  return next;
}
export function recruit(run: Run, species: string) {
  const next = structuredClone(run); if (next.party.length >= MAX_RUN_POKEMON || !SPECIES[species] || SPECIES[species].form?.kind === 'mega') return next;
  next.party.push(makePartyMon(species, recruitLevel(next)));
  return next;
}
export function offerRecruits(run: Run) {
  const roster = RECRUITS;
  const rotated = roster.map((_, offset) => roster[(run.encounter + offset) % roster.length]);
  const unowned = rotated.filter(id => !run.party.some(mon => mon.species === id));
  return [...unowned, ...rotated.filter(id => !unowned.includes(id))].slice(0, 3);
}
export function advanceRoute(run: Run): Run {
  if (run.phase === 'intermission' && run.pendingMoves.length) return run;
  const next = structuredClone(run);
  const node = routeNode(next.route, next.currentNodeId);
  if (!node) return next;
  next.encounter = node.column;
  next.currentNodeId = undefined;
  next.deployment = {};
  next.selected = next.selected.filter(id => next.party.some(mon => mon.id === id && mon.hp > 0));
  if (node.column === ROUTE_COLUMNS) { next.phase = 'result'; next.result = 'win'; next.unlocks++; }
  else next.phase = 'route';
  return next;
}
export function nextEncounter(run: Run): Run { return run.phase === 'intermission' ? advanceRoute(run) : run; }

export function selectRouteNode(run: Run, id: string): Run {
  if (run.phase !== 'route') return run;
  const node = availableRouteNodes(run.route).find(candidate => candidate.id === id);
  if (!node) return run;
  const next = structuredClone(run);
  next.route.visited.push(id);
  next.currentNodeId = id;
  next.encounter = node.column - 1;
  if (node.kind === 'heal') {
    for (const mon of next.party) mon.hp = statsAtLevel(mon.species, mon.level)[0];
    next.report = ['The healing spring fully restored and revived your party.'];
    return advanceRoute(next);
  }
  if (node.kind === 'store') { next.phase = 'shop'; return next; }
  if (node.kind === 'special') {
    const positive = random(next) < .75;
    if (positive) {
      const reward = Math.floor(random(next) * 3);
      next.pendingRouteEvent = reward === 0 ? { kind: 'coins', amount: 50 + Math.floor(random(next) * 6) * 10 }
        : reward === 1 ? { kind: 'heal' } : { kind: 'item', item: 'Sitrus Berry' };
    } else next.pendingRouteEvent = random(next) < .5 ? { kind: 'loss-coins' } : { kind: 'ambush' };
    next.phase = 'event'; return next;
  }
  if (node.kind === 'recruit') { next.phase = 'event'; return next; }
  next.encounterId = node.kind === 'boss' ? ENCOUNTERS.at(-1)!.id : ENCOUNTERS[(node.column - 1) % (ENCOUNTERS.length - 1)].id;
  next.phase = 'prepare';
  next.deployment = {};
  return next;
}

export function cancelPreparation(run: Run): Run {
  if (run.phase !== 'prepare' || !run.currentNodeId || run.route.visited.at(-1) !== run.currentNodeId) return run;
  return {
    ...run,
    phase: 'route',
    currentNodeId: undefined,
    deployment: {},
    route: { ...run.route, visited: run.route.visited.slice(0, -1) },
  };
}
export function buyShopItem(run: Run, item: ItemId): Run {
  const offer = SHOP_STOCK.find(stock => stock.item === item);
  if (run.phase !== 'shop' || !offer || run.coins < offer.price) return run;
  const next = structuredClone(run);
  next.coins -= offer.price;
  next.bag.push(item);
  return next;
}

export function resolveSpecial(run: Run, choice: { kind: 'recruit'; species: string; replaceId?: string } | { kind: 'claim' }): Run {
  if (run.phase !== 'event') return run;
  if (choice.kind === 'recruit') {
    const offers = routeNode(run.route, run.currentNodeId)?.kind === 'recruit' ? offerRecruits(run) : [];
    if (!offers.includes(choice.species) || run.party.length > MAX_RUN_POKEMON) return run;
    const full = run.party.length === MAX_RUN_POKEMON;
    if (full !== (choice.replaceId !== undefined)) return run;
    if (full && !run.party.some(mon => mon.id === choice.replaceId)) return run;
  }
  const next = structuredClone(run);
  if (choice.kind === 'recruit') {
    const newcomer = makePartyMon(choice.species, recruitLevel(next));
    if (choice.replaceId !== undefined) {
      const index = next.party.findIndex(mon => mon.id === choice.replaceId);
      const leaving = next.party[index];
      if (leaving.item !== 'None') next.bag.push(leaving.item);
      next.party[index] = newcomer;
      next.selected = next.selected.map(id => id === leaving.id ? newcomer.id : id);
      next.report = [`${SPECIES[leaving.species].name} left the roster; ${SPECIES[choice.species].name} joined.`,
        ...(leaving.item !== 'None' ? [`${leaving.item} was returned to your bag.`] : [])];
    } else {
      next.party.push(newcomer);
      next.report = [`${SPECIES[choice.species].name} joined your party.`];
    }
  } else {
    const event = next.pendingRouteEvent;
    if (event?.kind === 'coins') { next.coins += event.amount; next.report = [`You found ${event.amount} coins.`]; }
    else if (event?.kind === 'loss-coins') { const lost = Math.floor(next.coins / 2); next.coins -= lost; next.report = [`A trap took ${lost} coins.`]; }
    else if (event?.kind === 'item') { next.bag.push(event.item); next.report = [`You found a ${event.item}.`]; }
    else if (event?.kind === 'heal') { for (const mon of next.party) mon.hp = Math.min(statsAtLevel(mon.species, mon.level)[0], mon.hp + Math.ceil(statsAtLevel(mon.species, mon.level)[0] * .25)); next.report = ['A warm spring restored 25% HP to your whole roster.']; }
    else if (event?.kind === 'ambush') { for (const mon of next.party) mon.hp = Math.max(1, mon.hp - Math.ceil(statsAtLevel(mon.species, mon.level)[0] * .2)); next.report = ['A cave ambush hurt your roster for 20% HP.']; }
    else return run;
  }
  delete next.pendingRouteEvent;
  return advanceRoute(next);
}
export function setWeather(battle: Battle, weather: Weather) { battle.weather = weather; battle.weatherUntil = battle.time + toActionValueDuration(300); }
