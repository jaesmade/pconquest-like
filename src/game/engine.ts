import { abilityAbsorption, abilityContactReaction, abilityDamageMultiplier, abilityHitChance, abilitySpeedMultiplier, ENCOUNTERS, itemBlocksMove, itemCanEquip, itemFor, itemPeriodicHeal, itemSpecial, itemThresholdHeal, MAPS, mapHeight, mapWidth, megaFormFor, MOVES, RECRUITS, SPECIES, STARTERS, STARTING_BAG, STARTING_HELD_ITEMS } from '../content/data';
import type { AttackVisualEvent, Battle, BattleMap, GridPoint, PartyMon, Run, Tile, Unit, Weather } from './types';
import type { ItemId } from '../content/items';
import { canEnter, hasLineOfSight, routeTo, stepCost } from './grid';
import { newSeed, random } from './rng';
import { mobilityFor, syncMobility } from './mobility';
import { calculateDamage, damageRange } from './damage';
import { setTileEffects } from './clone';
import { hasMoveTag } from '../content/moves';
import { canDeploy, chooseEnemyDeployment, resolvePlayerDeployment } from './deployment';
import { createMap } from '../content/maps';

export { reachable, reachableTiles } from './grid';

const max = (n: number) => Math.max(1, Math.ceil(n));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const log = (battle: Battle, message: string) => { battle.log = [message, ...battle.log].slice(0, 24); };
const feedback = (battle: Battle, kind: 'ability' | 'item', key: string, unit: Unit) => {
  battle.feedbackEvents = [...(battle.feedbackEvents ?? []), { id: crypto.randomUUID(), kind, key, unitId: unit.id }].slice(-24);
};
const alive = (unit: Unit) => unit.hp > 0;
export const MAX_LEVEL = 100;
export const RUN_START_LEVEL = 10;
const encounterFor = (run: Run) => ENCOUNTERS.find(encounter => encounter.id === run.encounterId);
export const unitAt = (battle: Battle, x: number, y: number) => battle.units.find(unit => alive(unit) && unit.x === x && unit.y === y);
export const active = (battle: Battle) => battle.units.find(unit => unit.id === battle.current)!;
export const effectiveSpeed = (unit: Unit, battle: Battle) => Math.max(0.5, unit.stats[5] * abilitySpeedMultiplier(unit, battle.weather) * (unit.status.paralyzed > battle.time ? 0.5 : 1));
export const apGain = (unit: Unit, battle: Battle) => Math.max(1, Math.floor(effectiveSpeed(unit, battle)));
const scaleStats = (stats: Unit['stats'], level: number) => stats.map((base, index) =>
  index === 6 ? base : Math.floor(2 * base * level / 100) + (index === 0 ? level + 10 : 5)) as Unit['stats'];
export const statsAtLevel = (species: string, level: number) => scaleStats(SPECIES[species].stats, level);
export const xpForLevel = (level: number) => (level - 1) * 65;
const learnedAtLevel = (species: string, level: number) => [...new Set([...SPECIES[species].moves, ...Object.entries(SPECIES[species].learn).filter(([required]) => Number(required) <= level).map(([, move]) => move)])];
const makePartyMon = (species: string, level = RUN_START_LEVEL, item: ItemId = 'None'): PartyMon => ({ id: crypto.randomUUID(), species, level, xp: xpForLevel(level), hp: statsAtLevel(species, level)[0], learned: learnedAtLevel(species, level), equipped: learnedAtLevel(species, level).slice(0, 2), item });
const recruitLevel = (run: Run) => Math.max(RUN_START_LEVEL, ...run.party.map(mon => mon.level));
export function newRun(starter: string, unlocks = 0): Run {
  const seed = newSeed(), rng = { rngState: seed };
  const companions = STARTERS.filter(id => id !== starter);
  for (let i = companions.length - 1; i > 0; i--) { const j = Math.floor(random(rng) * (i + 1)); [companions[i], companions[j]] = [companions[j], companions[i]]; }
  const party = [starter, ...companions.slice(0, 2)].map((id, i) => makePartyMon(id, RUN_START_LEVEL, STARTING_HELD_ITEMS[i]));
  return { phase: 'route', party, selected: party.map(p => p.id), deployment: {}, bag: [...STARTING_BAG], encounter: 0, encounterId: ENCOUNTERS[0].id, seed, rngState: rng.rngState, routeChoice: 'rest', report: [], unlocks };
}
function makeUnit(mon: PartyMon, side: Unit['side'], x: number, y: number, tile: Tile): Unit {
  const species = SPECIES[mon.species];
  const stats = statsAtLevel(mon.species, mon.level);
  return { id: crypto.randomUUID(), partyId: side === 'player' ? mon.id : undefined, side, species: mon.species, name: species.name, level: mon.level, types: species.types, mobility: mobilityFor(species, tile), ability: species.ability, stats, moves: side === 'player' ? [...mon.equipped] : [...mon.learned], hp: Math.min(mon.hp, stats[0]), maxHp: stats[0], x, y, facing: side === 'player' ? 3 : 0, ap: 0, maxAp: 0, attackedThisTurn: false, status: {}, stages: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0 }, item: mon.item, itemAttackMultiplier: 1 };
}
export function startBattle(run: Run, enemyDeployment?: GridPoint[]): Run {
  const next = { ...run };
  const definition = encounterFor(next);
  if (!definition) throw new Error(`Unknown encounter ${next.encounterId}`);
  const map = structuredClone(MAPS[definition.mapId]);
  const selected = next.selected.map(id => next.party.find(mon => mon.id === id)).filter((mon): mon is PartyMon => !!mon && mon.hp > 0).slice(0, 3);
  if (!selected.length) return { ...next, phase: 'result', result: 'loss' };
  const deployment = resolvePlayerDeployment(next, map);
  if (selected.some(mon => !deployment[mon.id])) throw new Error(`Map ${map.id}: no legal ally deployment for the selected team.`);
  next.deployment = deployment;
  const players = selected.map(mon => { const [x, y] = deployment[mon.id]; return makeUnit(mon, 'player', x, y, map.tiles[y][x]); });
  const battle: Battle = { map, tileChanges: {}, objective: definition.objective, units: players, weather: map.weather, weatherUntil: map.weather === 'clear' ? 0 : 300, time: 0, round: 1, turnOrder: [], turnIndex: 0, current: '', rngState: next.rngState, log: [`${map.name}: defeat the opposing team${definition.objective === 'defeat-and-capture' ? ' and hold the capture tile' : ''}.`], visualEvents: [], feedbackEvents: [], captureHeld: false, encounterId: definition.id };
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
  beginRound(battle, true);
  return next;
}
function beginRound(battle: Battle, initial = false) {
  if (!initial) {
    battle.round++;
    battle.time += 100;
    for (const unit of battle.units.filter(alive)) {
      if (battle.weather === 'sandstorm' && !unit.types.some(type => ['Rock', 'Steel', 'Ground'].includes(type))) hit(battle, unit, max(unit.maxHp / 16), 'sandstorm');
      if (alive(unit) && unit.status.burned >= battle.time) hit(battle, unit, max(unit.maxHp / 16), 'Burn');
      if (alive(unit)) { const fraction = itemPeriodicHeal(unit); if (fraction) heal(battle, unit, max(unit.maxHp * fraction), unit.item); }
      if (alive(unit) && battle.map.tiles[unit.y][unit.x].kind === 'lava' && !unit.mobility.canFly) hit(battle, unit, max(unit.maxHp / 10), 'lava');
    }
    if (battle.weather !== 'clear' && battle.time >= battle.weatherUntil) { battle.weather = 'clear'; log(battle, 'The weather cleared.'); }
    checkResult(battle);
    if (battle.result) return;
  }
  battle.turnOrder = battle.units.filter(alive).map(unit => ({ unit, tie: random(battle) }))
    .sort((a, b) => effectiveSpeed(b.unit, battle) - effectiveSpeed(a.unit, battle) || a.tie - b.tie)
    .map(entry => entry.unit.id);
  battle.turnIndex = 0;
  activateNext(battle);
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
  // The lab exposes every level-eligible move, including moves normally left out of two campaign slots.
  ally.moves = learnedAtLevel(config.allySpecies, config.allyLevel);
  enemy.moves = learnedAtLevel(config.enemySpecies, config.enemyLevel);
  const battle: Battle = { map, tileChanges: {}, objective: 'defeat', units: [ally, enemy], weather: config.weather,
    weatherUntil: config.weather === 'clear' ? 0 : 300, time: 0, round: 1, turnOrder: [], turnIndex: 0,
    current: '', rngState: config.seed >>> 0 || 1, log: [`Battle Lab · seed ${config.seed >>> 0 || 1}. Control both Pokémon.`],
    visualEvents: [], feedbackEvents: [], captureHeld: false, encounterId: 'battle-lab' };
  beginRound(battle, true);
  return battle;
}
function activateNext(battle: Battle) {
  while (!battle.result) {
    if (battle.turnIndex >= battle.turnOrder.length) { beginRound(battle); return; }
    const unit = battle.units.find(candidate => candidate.id === battle.turnOrder[battle.turnIndex]);
    if (!unit || !alive(unit)) { battle.turnIndex++; continue; }
    battle.current = unit.id;
    unit.maxAp = apGain(unit, battle);
    if (abilitySpeedMultiplier(unit, battle.weather) > 1) feedback(battle, 'ability', unit.ability, unit);
    const bankedAp = unit.ap;
    unit.ap = Math.min(Number.MAX_SAFE_INTEGER, bankedAp + unit.maxAp);
    unit.attackedThisTurn = false;
    log(battle, `${unit.name}'s turn · ${unit.ap} AP (${bankedAp} banked + ${unit.maxAp} gained)`);
    return;
  }
}
function endCurrentTurn(battle: Battle) {
  if (battle.result) return;
  battle.turnIndex++;
  activateNext(battle);
}
function hit(battle: Battle, unit: Unit, amount: number, source: string) {
  if (!alive(unit)) return;
  unit.hp = Math.max(0, unit.hp - amount);
  unit.visual = unit.hp ? 'hurt' : 'faint'; unit.visualNonce = (unit.visualNonce ?? 0) + 1;
  log(battle, `${unit.name} took ${amount} damage from ${source}${unit.hp ? '.' : ' and fainted!'}`);
  const thresholdHeal = itemThresholdHeal(unit);
  if (thresholdHeal) { const item = unit.item; if (thresholdHeal.consume) unit.item = 'None'; heal(battle, unit, max(unit.maxHp * thresholdHeal.fraction), item); }
}
function heal(battle: Battle, unit: Unit, amount: number, source: string) {
  if (!alive(unit)) return;
  const restored = Math.min(amount, unit.maxHp - unit.hp);
  if (restored > 0) { unit.hp += restored; unit.visual = 'buff'; unit.visualNonce = (unit.visualNonce ?? 0) + 1; log(battle, `${unit.name} recovered ${restored} HP with ${source}.`); if (itemFor(source)) feedback(battle, 'item', source, unit); }
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
function applyTileEntry(battle: Battle, unit: Unit) {
  const tile = battle.map.tiles[unit.y][unit.x];
  if (tile.kind === 'lava' && !unit.mobility.canFly) hit(battle, unit, max(unit.maxHp / 10), 'lava');
  if (alive(unit) && tile.hazardUntil && tile.hazardUntil > battle.time) hit(battle, unit, max(unit.maxHp / 8), 'Stealth Rock');
  checkResult(battle);
}
export function moveUnit(battle: Battle, x: number, y: number): string | undefined {
  const unit = battle.units.find(candidate => candidate.id === battle.current);
  if (battle.result || !unit || !alive(unit) || !Number.isInteger(x) || !Number.isInteger(y)) return 'Movement is unavailable.';
  const route = routeTo(battle, unit, x, y);
  if (!route) return 'Tile is out of reach or costs too much AP.';
  travelPath(battle, unit, route.points);
}
function travelPath(battle: Battle, unit: Unit, points: GridPoint[]) {
  const travelled: GridPoint[] = [];
  let spent = 0;
  for (const [nextX, nextY] of points) {
    const cost = stepCost(battle, unit, nextX, nextY, unit.x, unit.y);
    unit.ap -= cost; spent += cost;
    unit.facing = nextX > unit.x ? 2 : nextX < unit.x ? 1 : nextY < unit.y ? 3 : 0;
    unit.x = nextX; unit.y = nextY;
    syncMobility(unit, battle.map.tiles[nextY][nextX]);
    travelled.push([nextX, nextY]);
    applyTileEntry(battle, unit);
    if (!alive(unit) || battle.result) break;
  }
  unit.visualPath = travelled;
  unit.visual = 'move'; unit.visualNonce = (unit.visualNonce ?? 0) + 1;
  log(battle, `${unit.name} moved to ${unit.x + 1}, ${unit.y + 1} for ${spent} AP.`);
}
function moveUnitAlongPath(battle: Battle, unit: Unit, points: GridPoint[]): boolean {
  if (!points.length || points.length > unit.stats[6]) return false;
  let x = unit.x, y = unit.y, cost = 0;
  for (const [nextX, nextY] of points) {
    if (distance({ x, y }, { x: nextX, y: nextY }) !== 1 || !canEnter(battle, unit, nextX, nextY, x, y)) return false;
    cost += stepCost(battle, unit, nextX, nextY, x, y);
    if (cost > unit.ap) return false;
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
export function canHitWithMove(battle: Battle, unit: Unit, moveId: string, target: Unit) {
  const move = MOVES[moveId];
  if (!move || !move.power || target.side === unit.side || !alive(target)) return false;
  if (move.target === 'unit') return inMoveRange(battle, unit, moveId, target.x, target.y);
  if (move.target !== 'tile') return false;
  const radiusX = move.area?.width ?? 1, radiusY = move.area?.height ?? 1;
  for (let y = Math.max(0, target.y - radiusY); y <= Math.min(mapHeight(battle.map) - 1, target.y + radiusY); y++)
    for (let x = Math.max(0, target.x - radiusX); x <= Math.min(mapWidth(battle.map) - 1, target.x + radiusX); x++) {
    if (inMoveRange(battle, unit, moveId, x, y) && affectedTiles(battle.map, moveId, x, y).some(([tx, ty]) => tx === target.x && ty === target.y)) return true;
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
function applyDamage(battle: Battle, source: Unit, target: Unit, moveId: string, visual: AttackVisualEvent) {
  const move = MOVES[moveId];
  const hitChance = abilityHitChance(target.ability, battle.weather);
  const miss = hitChance < 1 && random(battle) >= hitChance;
  if (miss) { feedback(battle, 'ability', target.ability, target); log(battle, `${source.name}'s ${move.name} missed ${target.name}.`); return; }
  const absorption = abilityAbsorption(target.ability, move.type);
  if (absorption?.kind === 'heal') { feedback(battle, 'ability', target.ability, target); heal(battle, target, max(target.maxHp * (absorption.healFraction ?? 0)), target.ability); return; }
  if (absorption?.kind === 'charge') { feedback(battle, 'ability', target.ability, target); if (absorption.status) target.status[absorption.status] = 1; log(battle, `${target.name} absorbed ${move.type} with ${target.ability}.`); return; }
  const preview = damagePreview(battle, source, target, moveId);
  if (!preview.type) { log(battle, `${target.name} is immune to ${move.type}.`); return; }
  const critical = random(battle) < 1 / 24;
  const randomPercent = 85 + Math.floor(random(battle) * 16);
  const damage = calculateDamage(battle, source, target, move, { critical, randomPercent });
  if (!visual.abilityTriggered && abilityDamageMultiplier(source, move) > 1) {
    feedback(battle, 'ability', source.ability, source);
    visual.abilityTriggered = true;
  }
  visual.targetIds.push(target.id);
  hit(battle, target, damage, `${move.name}${critical ? ' (critical)' : ''} · ${preview.type}×`);
  if (!alive(target)) return;
  const reaction = hasMoveTag(move, 'contact') && abilityContactReaction(target.ability);
  if (reaction && random(battle) < reaction.chance) { feedback(battle, 'ability', target.ability, target); source.status[reaction.status] = battle.time + reaction.duration; log(battle, `${source.name} was ${reaction.status} by ${target.ability}.`); }
  for (const effect of move.effects ?? []) {
    if (effect.on !== 'hit' || !alive(target)) continue;
    if (effect.kind === 'status' && random(battle) < effect.chance) {
      target.status[effect.status] = battle.time + effect.duration;
      log(battle, `${target.name} was ${effect.status}.`);
    } else if (effect.kind === 'displace') {
      const direction = effect.direction === 'push' ? 1 : -1;
      for (let step = 0; step < effect.tiles; step++) {
        const deltaX = target.x - source.x, deltaY = target.y - source.y;
        const dx = Math.abs(deltaX) >= Math.abs(deltaY) ? Math.sign(deltaX) * direction : 0;
        const dy = Math.abs(deltaY) > Math.abs(deltaX) ? Math.sign(deltaY) * direction : 0;
        const nextX = target.x + dx, nextY = target.y + dy;
        if (!canEnter(battle, target, nextX, nextY)) break;
        target.x = nextX; target.y = nextY;
        syncMobility(target, battle.map.tiles[nextY][nextX]);
        visual.tiles.push([nextX, nextY]);
        applyTileEntry(battle, target);
        if (!alive(target) || battle.result) break;
      }
      log(battle, `${target.name} was ${effect.direction === 'push' ? 'pushed' : 'pulled'}.`);
    } else if (effect.kind === 'tile') setTileEffects(battle, [[target.x, target.y]], effect.field, battle.time + effect.duration);
    else if (effect.kind === 'chain' && random(battle) < effect.chance) {
      const chained = battle.units.find(unit => unit.side === target.side && unit.id !== target.id && alive(unit) && distance(unit, target) <= effect.radius);
      if (chained) { visual.tiles.push([chained.x, chained.y]); visual.targetIds.push(chained.id); hit(battle, chained, max(damage * effect.damageFraction), `${move.name} chain`); }
    }
  }
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
  const visual: AttackVisualEvent = { id: crypto.randomUUID(), moveId, sourceId: unit.id, from: [unit.x, unit.y], to: [x, y], tiles: [...tiles], targetIds: [] };
  battle.visualEvents.push(visual);
  // Recent presentation cues are disposable; battle rules, RNG, and log live elsewhere.
  battle.visualEvents = battle.visualEvents.slice(-24);
  log(battle, `${unit.name} used ${move.name} for ${move.apCost} AP.`);
  for (const effect of move.effects ?? []) {
    if (effect.on !== 'cast') continue;
    if (effect.kind === 'weather') { battle.weather = effect.weather; battle.weatherUntil = battle.time + effect.duration; }
    else if (effect.kind === 'tile') setTileEffects(battle, tiles, effect.field, battle.time + effect.duration);
    else if (effect.kind === 'stage') for (const other of battle.units.filter(alive)) {
      if (!tiles.some(([tileX, tileY]) => other.x === tileX && other.y === tileY)) continue;
      if (effect.recipients === 'self' && other.id !== unit.id) continue;
      if (effect.recipients === 'allies' && other.side !== unit.side) continue;
      other.stages[effect.stat] = Math.max(-6, Math.min(6, other.stages[effect.stat] + effect.delta));
    }
  }
  if (move.power) for (const target of battle.units.filter(other => alive(other) && other.side !== unit.side && tiles.some(([tileX, tileY]) => other.x === tileX && other.y === tileY))) applyDamage(battle, unit, target, moveId, visual);
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
  if (battle.result) return acted;
  if (!acted || !alive(unit) || unit.ap < 1) endCurrentTurn(battle);
  else if (unit.ap >= before) throw new Error(`Enemy ${unit.id} acted without spending AP.`);
  return acted;
}
export function finishTurn(battle: Battle) {
  if (battle.result) return;
  if (!alive(active(battle)) || active(battle).ap < 1) endCurrentTurn(battle);
}
export function passTurn(battle: Battle) { if (!battle.result) endCurrentTurn(battle); }
export function upcoming(battle: Battle) {
  const remaining = battle.turnOrder.slice(battle.turnIndex).map(id => battle.units.find(unit => unit.id === id)).filter((unit): unit is Unit => !!unit && alive(unit));
  return remaining.slice(0, 6);
}
export function completeBattle(run: Run): Run {
  if (!run.battle?.result) return run;
  const battle = run.battle;
  const next: Run = { ...run, party: run.party.map(mon => ({ ...mon, learned: [...mon.learned], equipped: [...mon.equipped] })) };
  next.rngState = battle.rngState;
  for (const mon of next.party) { const unit = battle.units.find(u => u.partyId === mon.id); if (unit) { mon.hp = Math.min(unit.hp, statsAtLevel(mon.species, mon.level)[0]); mon.item = unit.item; } }
  if (battle.result === 'loss') { next.phase = 'result'; next.result = 'loss'; next.battle = undefined; return next; }
  const report: string[] = [];
  const earnedXp = ENCOUNTERS.find(encounter => encounter.id === battle.encounterId)!.xp;
  for (const mon of next.party) {
    mon.xp += earnedXp; report.push(`${SPECIES[mon.species].name} gained ${earnedXp} XP.`);
    while (mon.level < MAX_LEVEL && mon.xp >= xpForLevel(mon.level + 1)) {
      const oldMax = statsAtLevel(mon.species, mon.level)[0]; mon.level++;
      if (mon.hp > 0) mon.hp += statsAtLevel(mon.species, mon.level)[0] - oldMax;
      report.push(`${SPECIES[mon.species].name} reached level ${mon.level}.`);
    }
    mon.xp = Math.min(mon.xp, xpForLevel(MAX_LEVEL));
    for (const [level, move] of Object.entries(SPECIES[mon.species].learn)) if (mon.level >= Number(level) && !mon.learned.includes(move)) {
      mon.learned.push(move); report.push(`${SPECIES[mon.species].name} learned ${MOVES[move].name}.`);
    }
  }
  next.report = report; next.phase = 'intermission'; next.battle = undefined;
  return next;
}
export function evolve(run: Run, id: string) {
  const next = structuredClone(run), mon = next.party.find(p => p.id === id);
  if (!mon) return next;
  const evolution = SPECIES[mon.species].evolves;
  if (!evolution || mon.level < evolution.level) return next;
  const hpGain = statsAtLevel(evolution.into, mon.level)[0] - statsAtLevel(mon.species, mon.level)[0];
  mon.species = evolution.into; if (mon.hp > 0) mon.hp += hpGain;
  for (const [level, move] of Object.entries(SPECIES[mon.species].learn)) if (mon.level >= Number(level) && !mon.learned.includes(move)) mon.learned.push(move);
  next.report.push(`Evolved into ${SPECIES[mon.species].name}!`);
  return next;
}
export function recruit(run: Run, species: string) {
  const next = structuredClone(run); if (next.party.length >= 6) return next;
  next.party.push(makePartyMon(species, recruitLevel(next)));
  return next;
}
export function offerRecruits(run: Run) { return [RECRUITS[run.encounter % RECRUITS.length], RECRUITS[(run.encounter + 1) % RECRUITS.length]]; }
export function nextEncounter(run: Run): Run {
  if (run.phase !== 'intermission') return run;
  const next = structuredClone(run);
  const followingId = encounterFor(next)?.nextId;
  next.encounter++;
  if (!followingId) { next.phase = 'result'; next.result = 'win'; next.unlocks++; }
  else { next.encounterId = followingId; next.phase = 'route'; next.routeChoice = 'rest'; next.deployment = {}; next.selected = next.selected.filter(id => next.party.some(p => p.id === id && p.hp > 0)); }
  return next;
}
export function applyRouteChoice(run: Run, choice: 'rest' | 'recruit'): Run {
  const next = structuredClone(run); next.routeChoice = choice;
  if (choice === 'rest') {
    for (const mon of next.party) mon.hp = Math.min(statsAtLevel(mon.species, mon.level)[0], mon.hp + max(statsAtLevel(mon.species, mon.level)[0] * 0.4));
  } else {
    const offered = offerRecruits(next)[0]; if (next.party.length < 6) next.party.push(makePartyMon(offered, recruitLevel(next)));
  }
  next.deployment = {};
  next.phase = 'prepare'; return next;
}
export function setWeather(battle: Battle, weather: Weather) { battle.weather = weather; battle.weatherUntil = battle.time + 300; }
