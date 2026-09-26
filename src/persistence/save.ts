import { abilityFor, ENCOUNTERS, itemFor, MAPS, MOVES, SPECIES, TYPES } from '../content/data';
import { MAX_LEVEL, RUN_START_LEVEL, statsAtLevel, xpForLevel } from '../game/engine';
import { newSeed } from '../game/rng';
import { syncMobility } from '../game/mobility';
import { resolvePlayerDeployment } from '../game/deployment';
import type { Battle, BattleMap, Run, TileChange, Unit } from '../game/types';

const OLD_KEYS = [['pokemon-tactics-save-v6', 6], ['pokemon-tactics-save-v5', 5], ['pokemon-tactics-save-v4', 4], ['pokemon-tactics-save-v3', 3], ['pokemon-tactics-save-v2', 2]] as const;
const LEGACY_KEY = 'pokemon-tactics-prototype-v1';
const DATABASE = 'pokemon-tactics-saves';
const STORE = 'snapshots';

type SaveEnvelope = { schemaVersion: number; savedAt: string; run: Run };
type MapSnapshot = { id: string; signature: string; changes: TileChange[] };
type UnitSnapshot = Omit<Unit, 'visual' | 'visualNonce' | 'visualPath'>;
type BattleSnapshot = Omit<Battle, 'map' | 'tileChanges' | 'units' | 'visualEvents' | 'feedbackEvents'> & { map: MapSnapshot; units: UnitSnapshot[] };
type RunSnapshot = Omit<Run, 'battle'> & { battle?: BattleSnapshot };
type SaveV12 = { schemaVersion: 12; savedAt: string; run: RunSnapshot };
type StoredSnapshot = SaveV12 | { schemaVersion: 11 | 10 | 9 | 8 | 7; savedAt: string; run: RunSnapshot };
// Frozen pre-v9 HP bases let migration preserve each party member's health ratio.
const LEGACY_HP_BASE: Record<string, number> = {
  bulbasaur: 84, ivysaur: 106, squirtle: 86, wartortle: 108, lapras: 120,
  geodude: 90, pikachu: 76, meowth: 78, vulpix: 80, charmander: 78,
};
const phases = new Set<Run['phase']>(['starter', 'route', 'prepare', 'battle', 'intermission', 'result']);

export function freshRun(unlocks = 0): Run {
  const seed = newSeed();
  return { phase: 'starter', party: [], selected: [], deployment: {}, bag: [], encounter: 0, encounterId: ENCOUNTERS[0].id, seed, rngState: seed, routeChoice: 'rest', report: [], unlocks };
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
  if (next.party.length > 6 || next.party.some(mon => !mon || typeof mon.id !== 'string' || !mon.id || !SPECIES[mon.species])
    || new Set(next.party.map(mon => mon.id)).size !== next.party.length) return freshRun(next.unlocks);
  for (const mon of next.party) {
    if (version < 9) {
      const oldLevel = Number.isInteger(mon.level) ? Math.max(1, Math.min(MAX_LEVEL, mon.level)) : 2;
      const oldMaxHp = Math.round((LEGACY_HP_BASE[mon.species] ?? SPECIES[mon.species].stats[0]) * (1 + 0.07 * (oldLevel - 2)));
      const oldXp = Number.isFinite(mon.xp) ? mon.xp : xpForLevel(oldLevel);
      mon.level = Math.min(MAX_LEVEL, oldLevel + RUN_START_LEVEL - 2);
      mon.xp = xpForLevel(mon.level) + Math.max(0, oldXp - xpForLevel(oldLevel));
      const newMaxHp = statsAtLevel(mon.species, mon.level)[0];
      mon.hp = Number.isFinite(mon.hp) ? Math.min(newMaxHp, Math.ceil(newMaxHp * mon.hp / Math.max(1, oldMaxHp))) : newMaxHp;
    } else if (version < 11) {
      const level = Number.isInteger(mon.level) ? Math.max(1, Math.min(MAX_LEVEL, mon.level)) : RUN_START_LEVEL;
      const oldMaxHp = Math.round(SPECIES[mon.species].stats[0] * (1 + 0.07 * (level - 2)));
      const newMaxHp = statsAtLevel(mon.species, level)[0];
      mon.hp = Number.isFinite(mon.hp) ? Math.min(newMaxHp, Math.ceil(newMaxHp * mon.hp / oldMaxHp)) : newMaxHp;
    }
    mon.level = Number.isInteger(mon.level) ? Math.max(1, Math.min(MAX_LEVEL, mon.level)) : RUN_START_LEVEL;
    mon.xp = Number.isFinite(mon.xp) ? Math.max(xpForLevel(mon.level), Math.min(xpForLevel(MAX_LEVEL), Math.floor(mon.xp))) : xpForLevel(mon.level);
    const maxHp = statsAtLevel(mon.species, mon.level)[0];
    mon.hp = Number.isFinite(mon.hp) ? Math.max(0, Math.min(maxHp, Math.floor(mon.hp))) : maxHp;
    if (!itemFor(mon.item)) mon.item = 'None';
    mon.learned = [...new Set((Array.isArray(mon.learned) ? mon.learned : SPECIES[mon.species].moves).filter(id => !!MOVES[id]))];
    if (!mon.learned.length) mon.learned = [...SPECIES[mon.species].moves];
    mon.equipped = (Array.isArray(mon.equipped) ? mon.equipped : []).filter(id => mon.learned.includes(id)).slice(0, 2);
    while (mon.equipped.length < Math.min(2, mon.learned.length)) mon.equipped.push(mon.learned.find(id => !mon.equipped.includes(id))!);
  }
  next.bag = next.bag.filter(item => !!itemFor(item));
  next.selected = [...new Set(next.selected.filter(id => next.party.some(mon => mon.id === id && mon.hp > 0)))].slice(0, 3);
  next.deployment = resolvePlayerDeployment({ ...next, deployment: next.deployment && typeof next.deployment === 'object' && !Array.isArray(next.deployment) ? next.deployment : {} }, MAPS[ENCOUNTERS.find(encounter => encounter.id === next.encounterId)!.mapId]);

  if (version < 11 && next.battle) {
    if (next.phase === 'battle') next.phase = 'prepare';
    next.battle = undefined;
    next.report = ['Battle returned to preparation after the stat formula update.'];
  }
  if (version === 11 && next.battle && Array.isArray(next.battle.units)) {
    for (const unit of next.battle.units) {
      if (unit && SPECIES[unit.species] && Array.isArray(unit.stats) && unit.stats.length === 7) {
        unit.stats[6] = SPECIES[unit.species].stats[6];
      }
    }
  }
  if (next.phase === 'battle' && !next.battle) next.phase = 'prepare';
  if (next.battle) {
    const battle = next.battle, authored = MAPS[battle.map?.id];
    if (version === 5 && Array.isArray(battle.units)) {
      const enemyLevel = ENCOUNTERS.find(encounter => encounter.id === next.encounterId)?.enemyLevel ?? 2;
      for (const unit of battle.units) {
        unit.level = unit.side === 'player' ? next.party.find(mon => mon.id === unit.partyId)?.level ?? 2 : enemyLevel;
        unit.stages = { attack: unit.stages?.attack ?? 0, defense: unit.stages?.defense ?? 0, specialAttack: 0, specialDefense: 0 };
      }
    }
    const capturePending = battle.objective === 'defeat-and-capture' && !!battle.map?.capture
      && !battle.units?.some(unit => unit.hp > 0 && unit.side === 'player'
        && unit.x === battle.map.capture![0] && unit.y === battle.map.capture![1]);
    const validMap = authored && Array.isArray(battle.map.tiles) && battle.map.tiles.length === authored.tiles.length
      && battle.map.tiles.every((row, y) => Array.isArray(row) && row.length === authored.tiles[y].length
        && row.every(tile => !!tile && ['plain', 'water', 'lava', 'wall'].includes(tile.kind) && Number.isInteger(tile.height)));
    const validUnits = validMap && Array.isArray(battle.units) && battle.units.every(unit => unit && SPECIES[unit.species]
      && (unit.side === 'player' || unit.side === 'enemy')
      && (unit.side !== 'player' || next.party.some(mon => mon.id === unit.partyId))
      && Array.isArray(unit.stats) && unit.stats.length === 7 && unit.stats.every(value => Number.isInteger(value) && value > 0)
      && Array.isArray(unit.types) && unit.types.length >= 1 && unit.types.length <= 2 && unit.types.every(type => TYPES.includes(type))
      && !!abilityFor(unit.ability) && !!itemFor(unit.item)
      && Number.isFinite(unit.itemAttackMultiplier) && unit.itemAttackMultiplier > 0
      && unit.status && typeof unit.status === 'object' && !Array.isArray(unit.status)
      && Object.values(unit.status).every(value => Number.isFinite(value) && value >= 0)
      && Number.isInteger(unit.x) && Number.isInteger(unit.y) && Number.isFinite(unit.hp)
      && Number.isSafeInteger(unit.ap) && unit.ap >= 0 && Number.isSafeInteger(unit.maxAp) && unit.maxAp >= 0
      && Number.isFinite(unit.maxHp) && unit.maxHp > 0 && unit.hp >= 0 && unit.hp <= unit.maxHp
      && Number.isInteger(unit.level) && unit.level >= 1 && unit.level <= 100
      && ['attack', 'defense', 'specialAttack', 'specialDefense'].every(stat => Number.isInteger(unit.stages?.[stat as keyof typeof unit.stages]) && Math.abs(unit.stages[stat as keyof typeof unit.stages]) <= 6)
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
        && battle.units.some(unit => unit.id === battle.current && unit.hp > 0)
        && (battle.units.some(unit => unit.side === 'enemy' && unit.hp > 0) || capturePending)));
    const changedAuthoredMap = !!validMap && version < 7 && mapSignature(battle.map, false) !== mapSignature(authored, false);
    if (!validMap || !validUnits || !validQueue || changedAuthoredMap) {
      next.phase = 'prepare';
      next.battle = undefined;
      if (changedAuthoredMap) next.report = ['The map changed since this battle was saved. Prepare your team to restart it.'];
    } else {
      if (!Number.isInteger(battle.rngState)) battle.rngState = next.rngState;
      if (!Number.isFinite(battle.weatherUntil)) battle.weatherUntil = 0;
      if (!battle.tileChanges) battle.tileChanges = deriveChanges(battle.map, authored!);
      battle.map.zones = structuredClone(authored!.zones);
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

const signatureCache = new WeakMap<BattleMap, { old?: string; current?: string }>();
function mapSignature(map: BattleMap, includeZones: boolean): string {
  const slot = includeZones ? 'current' : 'old';
  const cached = signatureCache.get(map)?.[slot];
  if (cached) return cached;
  // Include only authored geometry and encounter markers. Temporary effects live in changes.
  const source = JSON.stringify([map.id, map.name, map.weather, map.playerSpawns, map.enemySpawns, map.capture,
    map.tiles.map(row => row.map(tile => [tile.kind, tile.height])), ...(includeZones ? [map.zones] : [])]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  const signature = (hash >>> 0).toString(16);
  signatureCache.set(map, { ...signatureCache.get(map), [slot]: signature });
  return signature;
}

function deriveChanges(map: BattleMap, authored: BattleMap): Record<string, TileChange> {
  const changes: Record<string, TileChange> = {};
  for (let y = 0; y < map.tiles.length; y++) for (let x = 0; x < map.tiles[y].length; x++) {
    const tile = map.tiles[y][x], base = authored.tiles[y][x];
    const change: TileChange = { x, y };
    if (tile.kind !== base.kind) change.kind = tile.kind;
    if (tile.height !== base.height) change.height = tile.height;
    for (const field of ['hazardUntil', 'coverUntil', 'mudUntil'] as const) if (tile[field] !== undefined) change[field] = tile[field];
    if (Object.keys(change).length > 2) changes[`${x},${y}`] = change;
  }
  return changes;
}

function snapshotMap(battle: Battle): MapSnapshot {
  const { map, time } = battle;
  const authored = MAPS[map.id];
  if (!authored || map.tiles.length !== authored.tiles.length
    || map.tiles[0]?.length !== authored.tiles[0]?.length) throw new Error('Battle map differs from authored layout.');
  const changes = Object.values(battle.tileChanges).map(change => {
    const copy: TileChange = { x: change.x, y: change.y };
    if (change.kind !== undefined) copy.kind = change.kind;
    if (change.height !== undefined) copy.height = change.height;
    for (const field of ['hazardUntil', 'coverUntil', 'mudUntil'] as const) if ((change[field] ?? 0) > time) copy[field] = change[field];
    return copy;
  }).filter(change => Object.keys(change).length > 2);
  return { id: map.id, signature: mapSignature(authored, true), changes };
}

export function snapshotRun(run: Run): SaveV12 {
  const battle = run.battle;
  const savedBattle: BattleSnapshot | undefined = battle && (({ visualEvents: _events, feedbackEvents: _feedback, tileChanges: _changes, ...state }) => ({
    ...state,
    map: snapshotMap(battle),
    units: battle.units.map(({ visual: _visual, visualNonce: _visualNonce, visualPath: _visualPath, ...unit }) => unit),
  }))(battle);
  return { schemaVersion: 12, savedAt: new Date().toISOString(), run: { ...run, battle: savedBattle } };
}

function restoreRun(value: unknown): Run | undefined {
  if (!value || typeof value !== 'object') return;
  const envelope = value as Partial<StoredSnapshot>;
  if ((envelope.schemaVersion !== 7 && envelope.schemaVersion !== 8 && envelope.schemaVersion !== 9 && envelope.schemaVersion !== 10 && envelope.schemaVersion !== 11 && envelope.schemaVersion !== 12) || !envelope.run || !isRun(envelope.run)) return;
  const run = envelope.run as RunSnapshot;
  if (!run.battle) return migrateRun(run as Run, envelope.schemaVersion);
  const saved = run.battle;
  const authored = MAPS[saved.map?.id];
  if (!authored || saved.map.signature !== mapSignature(authored, envelope.schemaVersion >= 8) || !Array.isArray(saved.map.changes)) {
    return migrateRun({ ...run, phase: 'prepare', battle: undefined,
      report: ['The map changed since this battle was saved. Prepare your team to restart it.'] } as Run, envelope.schemaVersion);
  }
  const map = structuredClone(authored);
  for (const change of saved.map.changes) {
    if (!Number.isInteger(change.x) || !Number.isInteger(change.y) || !map.tiles[change.y]?.[change.x]
      || !['plain', 'water', 'lava', 'wall', undefined].includes(change.kind)
      || (change.height !== undefined && (!Number.isInteger(change.height) || change.height < 0 || change.height > 2))) return;
    const tile = map.tiles[change.y][change.x];
    if (change.kind !== undefined) tile.kind = change.kind;
    if (change.height !== undefined) tile.height = change.height;
    for (const field of ['hazardUntil', 'coverUntil', 'mudUntil'] as const) {
      const until = change[field];
      if (until !== undefined) {
        if (!Number.isFinite(until) || until < 0) return;
        tile[field] = until;
      }
    }
  }
  const tileChanges = Object.fromEntries(saved.map.changes.map(change => [`${change.x},${change.y}`, change]));
  return migrateRun({ ...run, battle: { ...saved, map, tileChanges, visualEvents: [], feedbackEvents: [] } } as Run, envelope.schemaVersion);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readSlot(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeSlots(db: IDBDatabase, current: string, backup: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    store.put(backup, 'backup');
    store.put(current, 'current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function writeWithBackup(db: IDBDatabase, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const previous = store.get('current');
    previous.onsuccess = () => {
      store.put(typeof previous.result === 'string' ? previous.result : payload, 'backup');
      store.put(payload, 'current');
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function parseSnapshot(raw: unknown): Run | undefined {
  if (typeof raw !== 'string') return;
  try {
    const envelope = JSON.parse(raw) as Partial<StoredSnapshot>;
    const loaded = restoreRun(envelope);
    if (envelope.run?.phase !== 'starter' && loaded?.phase === 'starter') return;
    return loaded;
  } catch { return; }
}

function loadLegacyRun(): Run | undefined {
  for (const [key, version] of OLD_KEYS) {
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
  return;
}

export async function loadRun(): Promise<Run> {
  try {
    const db = await openDatabase();
    try {
      const current = await readSlot(db, 'current');
      const loaded = parseSnapshot(current);
      if (loaded) return loaded;
      const backup = await readSlot(db, 'backup');
      const recovered = parseSnapshot(backup);
      if (recovered) {
        await writeSlots(db, backup as string, backup as string);
        return recovered;
      }
    } finally { db.close(); }
  } catch { /* IndexedDB unavailable; legacy data may still be readable. */ }
  return loadLegacyRun() ?? freshRun();
}

let pendingSave: Promise<boolean> = Promise.resolve(true);
export function saveRun(run: Run): Promise<boolean> {
  // Serialize the latest committed state at the boundary, then preserve write order.
  pendingSave = pendingSave.catch(() => false).then(async () => {
    try {
      const payload = JSON.stringify(snapshotRun(run));
      const db = await openDatabase();
      try {
        await writeWithBackup(db, payload);
      } finally { db.close(); }
      return true;
    } catch { return false; }
  });
  return pendingSave;
}
