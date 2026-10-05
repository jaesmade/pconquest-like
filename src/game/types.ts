import type { AbilityId } from '../content/abilities';
import type { ItemId } from '../content/items';
import type { RoutePlan } from './route';

export type Weather = 'clear' | 'sun' | 'rain' | 'snow' | 'sandstorm';
export type GridPoint = [number, number];
export type DeploymentZone = 'ally' | 'neutral' | 'enemy';
export type SlopeDirection = 'north' | 'south' | 'east' | 'west';
export type TerrainObjectId = 'tree' | 'pine-tree' | 'rock' | 'bush' | 'fallen-log' | 'tree-stump' | 'fern' | 'mushrooms' | 'flower' | 'grass-tuft' | 'ancient-tree' | 'standing-stone';
export type Tile = { kind: 'plain' | 'water' | 'lava' | 'wall'; height: number; surface?: 'path' | 'moss' | 'stone' | 'seal'; slope?: SlopeDirection; object?: TerrainObjectId; hazardUntil?: number; coverUntil?: number; mudUntil?: number };
export type BattleMap = { id: string; name: string; weather: Weather; tiles: Tile[][]; zones: DeploymentZone[][]; playerSpawns: GridPoint[]; enemySpawns: GridPoint[]; capture?: GridPoint };
export type TileChange = { x: number; y: number; kind?: Tile['kind']; height?: number; hazardUntil?: number; coverUntil?: number; mudUntil?: number };
export type HazardZone = { id: string; sourceId: string; moveId: string; tiles: GridPoint[]; until: number };
export type EnemyRank = 'normal' | 'elite' | 'boss';
export type BattleCategory = EnemyRank;
export type EncounterEnemy = { species: string; rank: EnemyRank };
export type Encounter = { id: string; mapId: string; enemies: EncounterEnemy[]; enemyLevel: number; objective: 'defeat' | 'defeat-and-capture'; xp: number; nextId?: string };
export type EncounterTemplate = Omit<Encounter, 'enemies'> & { kind: BattleCategory; normalPool: string[]; elitePool: string[]; bossSpecies?: string };
export type MoveEffect =
  | { kind: 'status'; on: 'hit'; status: 'burned' | 'paralyzed'; chance: number; duration: number }
  | { kind: 'displace'; on: 'hit'; direction: 'push' | 'pull'; tiles: number }
  | { kind: 'tile'; on: 'hit' | 'cast'; field: 'coverUntil' | 'mudUntil' | 'hazardUntil'; duration: number }
  | { kind: 'chain'; on: 'hit'; chance: number; radius: number; damageFraction: number }
  | { kind: 'stage'; on: 'cast'; stat: keyof StatStages; delta: number; duration: number; recipients: 'self' | 'allies' | 'all' }
  | { kind: 'weather'; on: 'cast'; weather: Weather; duration: number }
  | { kind: 'trick-room'; on: 'cast'; duration: number }
  | { kind: 'action'; on: 'hit'; direction: 'advance' | 'delay'; amount: number }
  | { kind: 'action'; on: 'cast'; direction: 'advance' | 'delay'; amount: number; recipients: 'self' | 'allies' | 'enemies' | 'all' };
export type MoveTag = 'contact' | 'punch' | 'bomb' | 'projectile' | 'pulse' | 'sound' | 'weather' | 'hazard' | 'field';
export type AttackDelivery = 'melee' | 'ranged';
type MoveBase = { name: string; type: string; power: number; range: number; apCost: number; target: 'unit' | 'tile' | 'self'; detail: string; tags: MoveTag[]; visualId?: string; soundId?: string; area?: { width: number; height: number; anchor: 'center' | 'corner' }; effects?: MoveEffect[] };
export type Move = MoveBase & ({ category: 'Physical' | 'Special'; delivery: AttackDelivery } | { category: 'Status'; delivery?: never });
export type MobilityState = 'grounded' | 'flying' | 'swimming';
export type Mobility = { canFly: boolean; canSwim: boolean; state: MobilityState };
export type Species = { name: string; types: string[]; partyCost?: number; mobility?: { fly?: boolean; swim?: boolean }; ability: AbilityId; stats: [number, number, number, number, number, number, number]; moves: string[]; learn: Record<number, string>; tmMoves?: string[]; evolves?: { level: number; into: string }; form?: { kind: 'mega'; from: string; stone: ItemId } };
export type PartyMon = { id: string; species: string; level: number; xp: number; hp: number; learned: string[]; equipped: string[]; item: ItemId; evolved?: boolean };
export type PendingMove = { monId: string; moveId: string };
export type StatStages = { attack: number; defense: number; specialAttack: number; specialDefense: number; speed: number };
export type StageExpiry = Record<keyof StatStages, number>;
export type Unit = { id: string; partyId?: string; side: 'player' | 'enemy'; rank: EnemyRank; species: string; name: string; level: number; types: string[]; mobility: Mobility; ability: AbilityId; stats: [number, number, number, number, number, number, number]; moves: string[]; hp: number; maxHp: number; x: number; y: number; facing: number; ap: number; maxAp: number; movedThisTurn: boolean; attackedThisTurn: boolean; nextAction: number; nextActionShift: number; scheduledSpeed: number; status: Record<string, number>; stages: StatStages; stageUntil: StageExpiry; item: ItemId; itemAttackMultiplier: number; visual?: string; visualNonce?: number; visualFrom?: GridPoint; visualPath?: GridPoint[] };
export type AttackVisualEvent = { id: string; moveId: string; sourceId: string; from: [number, number]; to: [number, number]; tiles: [number, number][]; targetIds: string[]; hpAfter?: Record<string, number>; abilityTriggered?: boolean };
export type FeedbackEvent = { id: string; kind: 'ability' | 'item'; key: string; unitId: string };
export type HpVisualEvent = { id: string; unitId: string; kind: 'damage' | 'heal'; amount: number; hpAfter: number; x: number; y: number; attackId?: string; duringMove?: boolean };
export type Battle = { map: BattleMap; tileChanges: Record<string, TileChange>; hazardZones: HazardZone[]; objective: Encounter['objective']; units: Unit[]; weather: Weather; weatherUntil: number; trickRoomUntil: number; time: number; round: number; turnOrder: string[]; turnIndex: number; current: string; rngState: number; log: string[]; visualEvents: AttackVisualEvent[]; feedbackEvents?: FeedbackEvent[]; hpEvents?: HpVisualEvent[]; result?: 'win' | 'loss'; captureHeld: boolean; encounterId: string };
export type RouteEvent = { kind: 'coins'; amount: number } | { kind: 'loss-coins' } | { kind: 'item'; item: ItemId } | { kind: 'heal' } | { kind: 'ambush' };
export type Run = { phase: 'starter' | 'route' | 'prepare' | 'battle' | 'intermission' | 'shop' | 'event' | 'result'; party: PartyMon[]; selected: string[]; deployment: Record<string, GridPoint>; bag: ItemId[]; pendingMoves: PendingMove[]; coins: number; encounter: number; encounterId: string; seed: number; rngState: number; route: RoutePlan; currentNodeId?: string; pendingRouteEvent?: RouteEvent; routeChoice: 'rest' | 'recruit'; battle?: Battle; report: string[]; result?: 'win' | 'loss'; unlocks: number };
