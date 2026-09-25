import { ENCOUNTERS, itemFor, MAPS, MOVES, SPECIES } from '../content/data';
import { newSeed } from '../game/rng';
import { syncMobility } from '../game/mobility';
import type { Run } from '../game/types';

const CURRENT_KEY = 'pokemon-tactics-save-v5';
const OLD_KEYS = [['pokemon-tactics-save-v4', 4], ['pokemon-tactics-save-v3', 3], ['pokemon-tactics-save-v2', 2]] as const;
const LEGACY_KEY = 'pokemon-tactics-prototype-v1';
const SCHEMA_VERSION = 5;

type SaveEnvelope = { schemaVersion: number; savedAt: string; run: Run };
const phases = new Set<Run['phase']>(['starter', 'route', 'prepare', 'battle', 'intermission', 'result']);

export function freshRun(unlocks = 0): Run {
  const seed = newSeed();
  return { phase: 'starter', party: [], selected: [], bag: [], encounter: 0, encounterId: ENCOUNTERS[0].id, seed, rngState: seed, routeChoice: 'rest', report: [], unlocks };
}

function isRun(value: unknown): value is Run {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<Run>;
  return !!run.phase && phases.has(run.phase) && Array.isArray(run.party) && Array.isArray(run.selected)
    && Array.isArray(run.bag) && Number.isInteger(run.encounter) && run.encounter! >= 0
    && Number.isInteger(run.unlocks) && run.unlocks! >= 0;
}

function migrateRun(run: Run, version: number): Run {
  const next = structuredClone(run);
  next.encounterId ??= ENCOUNTERS[next.encounter]?.id ?? ENCOUNTERS.at(-1)!.id;
  if (!ENCOUNTERS.some(encounter => encounter.id === next.encounterId)) return freshRun(next.unlocks);
  if (!Number.isInteger(next.seed)) next.seed = newSeed();
  if (!Number.isInteger(next.rngState)) next.rngState = next.seed;
  if (next.party.some(mon => !SPECIES[mon.species])) return freshRun(next.unlocks);
  for (const mon of next.party) {
    if (!itemFor(mon.item)) mon.item = 'None';
    mon.learned = mon.learned.filter(id => !!MOVES[id]);
    mon.equipped = mon.equipped.filter(id => mon.learned.includes(id)).slice(0, 2);
    while (mon.equipped.length < Math.min(2, mon.learned.length)) mon.equipped.push(mon.learned.find(id => !mon.equipped.includes(id))!);
  }
  next.bag = next.bag.filter(item => !!itemFor(item));
  next.selected = [...new Set(next.selected.filter(id => next.party.some(mon => mon.id === id && mon.hp > 0)))].slice(0, 3);

  // The old battle cannot reveal whether its active unit already spent its attack.
  if (version < SCHEMA_VERSION && next.battle) {
    if (next.phase === 'battle') {
      next.phase = 'prepare';
      next.report = ['Battle resumed at preparation after the one-attack rule update.'];
    }
    next.battle = undefined;
  }
  if (next.phase === 'battle' && !next.battle) next.phase = 'prepare';
  if (next.battle) {
    const battle = next.battle, authored = MAPS[battle.map?.id];
    const capturePending = battle.objective === 'defeat-and-capture' && !!battle.map?.capture
      && !battle.units?.some(unit => unit.hp > 0 && unit.side === 'player'
        && unit.x === battle.map.capture![0] && unit.y === battle.map.capture![1]);
    const validMap = authored && Array.isArray(battle.map.tiles) && battle.map.tiles.length === authored.tiles.length
      && battle.map.tiles.every((row, y) => Array.isArray(row) && row.length === authored.tiles[y].length
        && row.every(tile => !!tile && ['plain', 'water', 'lava', 'wall'].includes(tile.kind) && Number.isInteger(tile.height)));
    const validUnits = validMap && Array.isArray(battle.units) && battle.units.every(unit => SPECIES[unit.species]
      && Number.isInteger(unit.x) && Number.isInteger(unit.y) && Number.isFinite(unit.hp)
      && Number.isFinite(unit.ap) && unit.ap >= 0 && Number.isFinite(unit.maxAp) && unit.maxAp >= 0
      && Number.isFinite(unit.maxHp) && unit.maxHp > 0 && unit.hp >= 0 && unit.hp <= unit.maxHp
      && typeof unit.attackedThisTurn === 'boolean' && typeof unit.mobility?.canFly === 'boolean'
      && typeof unit.mobility?.canSwim === 'boolean'
      && battle.map.tiles[unit.y]?.[unit.x] && Array.isArray(unit.moves) && unit.moves.every(id => !!MOVES[id]));
    const unitIds = validUnits ? battle.units.map(unit => unit.id) : [];
    const livePositions = validUnits ? battle.units.filter(unit => unit.hp > 0).map(unit => `${unit.x},${unit.y}`) : [];
    const validQueue = validUnits && new Set(unitIds).size === unitIds.length && new Set(livePositions).size === livePositions.length
      && ['clear', 'sun', 'rain', 'snow', 'sandstorm'].includes(battle.weather)
      && (battle.result === undefined || battle.result === 'win' || battle.result === 'loss')
      && Number.isInteger(battle.round) && battle.round >= 1 && Number.isInteger(battle.time) && battle.time >= 0
      && Array.isArray(battle.turnOrder) && battle.turnOrder.every(id => unitIds.includes(id))
      && new Set(battle.turnOrder).size === battle.turnOrder.length && Number.isInteger(battle.turnIndex)
      && battle.turnIndex >= 0 && (battle.result || battle.turnIndex < battle.turnOrder.length)
      && battle.units.some(unit => unit.id === battle.current) && battle.encounterId === next.encounterId
      && (battle.result || (battle.turnOrder[battle.turnIndex] === battle.current
        && battle.units.some(unit => unit.id === battle.current && unit.side === 'player' && unit.hp > 0)
        && (battle.units.some(unit => unit.side === 'enemy' && unit.hp > 0) || capturePending)));
    if (!validMap || !validUnits || !validQueue) {
      next.phase = 'prepare';
      next.battle = undefined;
    } else {
      if (!Number.isInteger(battle.rngState)) battle.rngState = next.rngState;
      battle.captureHeld = !!battle.map.capture && battle.units.some(unit => unit.hp > 0 && unit.side === 'player'
        && unit.x === battle.map.capture![0] && unit.y === battle.map.capture![1]);
      battle.visualEvents = [];
      for (const unit of battle.units) {
        syncMobility(unit, battle.map.tiles[unit.y][unit.x]);
        delete unit.visual; delete unit.visualNonce; delete unit.visualPath;
      }
    }
  }
  if (next.phase === 'prepare' && next.party.length && !next.party.some(mon => mon.hp > 0)) {
    next.phase = 'result';
    next.result = 'loss';
  }
  return next;
}

export function loadRun(): Run {
  for (const [key, version] of [[CURRENT_KEY, SCHEMA_VERSION] as const, ...OLD_KEYS]) {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) continue;
      const envelope = JSON.parse(saved) as Partial<SaveEnvelope>;
      if (envelope.schemaVersion === version && isRun(envelope.run)) return migrateRun(envelope.run, version);
    } catch { /* Try the next save version. */ }
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const run = JSON.parse(legacy) as unknown;
      if (isRun(run)) return migrateRun(run, 1);
    }
  } catch { /* Storage is unavailable or this save is malformed. */ }
  return freshRun();
}

export function saveRun(run: Run): void {
  try {
    const copy: Run = run.battle ? { ...run, battle: { ...run.battle, visualEvents: [], units: run.battle.units.map(unit => {
      const persisted = { ...unit };
      delete persisted.visual;
      delete persisted.visualNonce;
      delete persisted.visualPath;
      return persisted;
    }) } } : run;
    const envelope: SaveEnvelope = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), run: copy };
    localStorage.setItem(CURRENT_KEY, JSON.stringify(envelope));
  } catch { /* Keep playing in memory if local storage is unavailable. */ }
}
