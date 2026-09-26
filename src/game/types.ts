import type { AbilityId } from '../content/abilities';
import type { ItemId } from '../content/items';

export type Weather = 'clear' | 'sun' | 'rain' | 'snow' | 'sandstorm';
export type GridPoint = [number, number];
export type DeploymentZone = 'ally' | 'neutral' | 'enemy';
export type Tile = { kind: 'plain' | 'water' | 'lava' | 'wall'; height: number; hazardUntil?: number; coverUntil?: number; mudUntil?: number };
export type BattleMap = { id: string; name: string; weather: Weather; tiles: Tile[][]; zones: DeploymentZone[][]; playerSpawns: GridPoint[]; enemySpawns: GridPoint[]; capture?: GridPoint };
export type TileChange = { x: number; y: number; kind?: Tile['kind']; height?: number; hazardUntil?: number; coverUntil?: number; mudUntil?: number };
export type Encounter = { id: string; mapId: string; enemies: string[]; enemyLevel: number; objective: 'defeat' | 'defeat-and-capture'; xp: number; nextId?: string };
export type MoveEffect =
  | { kind: 'status'; on: 'hit'; status: 'burned' | 'paralyzed'; chance: number; duration: number }
  | { kind: 'displace'; on: 'hit'; direction: 'push' | 'pull'; tiles: number }
  | { kind: 'tile'; on: 'hit' | 'cast'; field: 'coverUntil' | 'mudUntil' | 'hazardUntil'; duration: number }
  | { kind: 'chain'; on: 'hit'; chance: number; radius: number; damageFraction: number }
  | { kind: 'stage'; on: 'cast'; stat: keyof StatStages; delta: number; recipients: 'self' | 'allies' | 'all' }
  | { kind: 'weather'; on: 'cast'; weather: Weather; duration: number };
export type MoveTag = 'contact' | 'punch' | 'bomb' | 'projectile' | 'pulse' | 'sound' | 'weather' | 'hazard';
export type Move = { name: string; type: string; category: 'Physical' | 'Special' | 'Status'; power: number; range: number; apCost: number; target: 'unit' | 'tile' | 'self'; detail: string; tags: MoveTag[]; area?: { width: number; height: number; anchor: 'center' | 'corner' }; effects?: MoveEffect[] };
export type MobilityState = 'grounded' | 'flying' | 'swimming';
export type Mobility = { canFly: boolean; canSwim: boolean; state: MobilityState };
export type Species = { name: string; types: string[]; mobility?: { fly?: boolean; swim?: boolean }; ability: AbilityId; stats: [number, number, number, number, number, number, number]; moves: string[]; learn: Record<number, string>; evolves?: { level: number; into: string }; form?: { kind: 'mega'; from: string; stone: ItemId } };
export type PartyMon = { id: string; species: string; level: number; xp: number; hp: number; learned: string[]; equipped: string[]; item: ItemId; evolved?: boolean };
export type StatStages = { attack: number; defense: number; specialAttack: number; specialDefense: number };
export type Unit = { id: string; partyId?: string; side: 'player' | 'enemy'; species: string; name: string; level: number; types: string[]; mobility: Mobility; ability: AbilityId; stats: [number, number, number, number, number, number, number]; moves: string[]; hp: number; maxHp: number; x: number; y: number; facing: number; ap: number; maxAp: number; attackedThisTurn: boolean; status: Record<string, number>; stages: StatStages; item: ItemId; itemAttackMultiplier: number; visual?: string; visualNonce?: number; visualPath?: GridPoint[] };
export type AttackVisualEvent = { id: string; moveId: string; sourceId: string; from: [number, number]; to: [number, number]; tiles: [number, number][]; targetIds: string[]; abilityTriggered?: boolean };
export type FeedbackEvent = { id: string; kind: 'ability' | 'item'; key: string; unitId: string };
export type Battle = { map: BattleMap; tileChanges: Record<string, TileChange>; objective: Encounter['objective']; units: Unit[]; weather: Weather; weatherUntil: number; time: number; round: number; turnOrder: string[]; turnIndex: number; current: string; rngState: number; log: string[]; visualEvents: AttackVisualEvent[]; feedbackEvents?: FeedbackEvent[]; result?: 'win' | 'loss'; captureHeld: boolean; encounterId: string };
export type Run = { phase: 'starter' | 'route' | 'prepare' | 'battle' | 'intermission' | 'result'; party: PartyMon[]; selected: string[]; deployment: Record<string, GridPoint>; bag: ItemId[]; encounter: number; encounterId: string; seed: number; rngState: number; routeChoice: 'rest' | 'recruit'; battle?: Battle; report: string[]; result?: 'win' | 'loss'; unlocks: number };
