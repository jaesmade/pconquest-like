import { setTileEffects } from './clone';
import { canEnter } from './grid';
import { placeHazardZone } from './hazards';
import { syncMobility } from './mobility';
import { random } from './rng';
import { changeStage, MAX_STAGE, statWithStage } from './stages';
import { changeNextAction, formatCycleDuration, timelineSpeed, toActionValueDuration } from './actionValue';
import { abilitySpeedMultiplier } from '../content/abilities';
import type { AttackVisualEvent, Battle, GridPoint, Move, MoveEffect, Unit } from './types';

type Kind = MoveEffect['kind'];
type OfKind<K extends Kind> = Extract<MoveEffect, { kind: K }>;
export type EffectContext = {
  battle: Battle; source: Unit; move: Move; moveId: string; tiles: GridPoint[];
  target?: Unit; visual?: AttackVisualEvent;
  log: (message: string) => void;
  enterTile: (unit: Unit) => void;
  chainHit: (unit: Unit, fraction: number) => void;
};
type EffectView = Pick<EffectContext, 'battle' | 'source' | 'move' | 'moveId' | 'tiles' | 'target'>;
type Handler<E extends MoveEffect> = {
  validate: (effect: E, move: Move) => string[];
  resolve: (effect: E, context: EffectContext) => void;
  preview: (effect: E, context: EffectView) => string;
  score: (effect: E, context: EffectView) => number;
};
const distance = (a: Unit, b: Unit) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const chanceError = (chance: number) => Number.isFinite(chance) && chance >= 0 && chance <= 1 ? [] : ['effect chance must be between 0 and 1'];
const durationError = (duration: number) => Number.isInteger(duration) && duration > 0 ? [] : ['effect duration must be a positive integer'];
const targets = (context: EffectView, effect: OfKind<'stage'>) => context.battle.units.filter(unit => unit.hp > 0
  && context.tiles.some(([x, y]) => unit.x === x && unit.y === y)
  && (effect.recipients === 'self' ? unit.id === context.source.id : effect.recipients === 'allies' ? unit.side === context.source.side : unit.side !== context.source.side));
const actionTargets = (effect: OfKind<'action'>, context: EffectView) => effect.on === 'hit'
  ? context.target ? [context.target] : []
  : context.battle.units.filter(unit => unit.hp > 0 && context.tiles.some(([x, y]) => unit.x === x && unit.y === y)
    && (effect.recipients === 'self' ? unit.id === context.source.id
      : effect.recipients === 'allies' ? unit.side === context.source.side
        : effect.recipients === 'enemies' ? unit.side !== context.source.side : true));
const planningSpeed = (unit: Unit, battle: Battle) => Math.max(0.5,
  statWithStage(unit.stats[5], unit.stages.speed) * abilitySpeedMultiplier(unit, battle.weather) * (unit.status.paralyzed > battle.time ? 0.5 : 1));

/** The authored effect array is the order within each phase. This table owns all effect-family rules. */
const handlers: { [K in Kind]: Handler<OfKind<K>> } = {
  status: {
    validate: effect => [...chanceError(effect.chance), ...durationError(effect.duration)],
    resolve: (effect, { battle, target, log }) => {
      if (target && random(battle) < effect.chance) { target.status[effect.status] = battle.time + toActionValueDuration(effect.duration); log(`${target.name} was ${effect.status}.`); }
    },
    preview: effect => `${Math.round(effect.chance * 100)}% ${effect.status} for ${formatCycleDuration(effect.duration)} on hit`,
    score: (effect, { battle, target }) => target && target.hp > 0 && (target.status[effect.status] ?? 0) <= battle.time ? effect.chance : 0,
  },
  displace: {
    validate: effect => Number.isInteger(effect.tiles) && effect.tiles > 0 ? [] : ['displacement must be a positive tile count'],
    resolve: (effect, { battle, source, target, visual, log, enterTile }) => {
      if (!target) return;
      const direction = effect.direction === 'push' ? 1 : -1;
      for (let step = 0; step < effect.tiles; step++) {
        const deltaX = target.x - source.x, deltaY = target.y - source.y;
        const dx = Math.abs(deltaX) >= Math.abs(deltaY) ? Math.sign(deltaX) * direction : 0;
        const dy = Math.abs(deltaY) > Math.abs(deltaX) ? Math.sign(deltaY) * direction : 0;
        const nextX = target.x + dx, nextY = target.y + dy;
        if (!canEnter(battle, target, nextX, nextY)) break;
        target.x = nextX; target.y = nextY;
        syncMobility(target, battle.map.tiles[nextY][nextX]);
        visual?.tiles.push([nextX, nextY]);
        enterTile(target);
        if (target.hp <= 0 || battle.result) break;
      }
      log(`${target.name} was ${effect.direction === 'push' ? 'pushed' : 'pulled'}.`);
    },
    preview: effect => `${effect.direction === 'push' ? 'Pushes' : 'Pulls'} ${effect.tiles} tile${effect.tiles === 1 ? '' : 's'} on hit`,
    score: () => 0.1,
  },
  tile: {
    validate: effect => durationError(effect.duration),
    resolve: (effect, { battle, source, moveId, tiles, target }) => {
      const points: GridPoint[] = effect.on === 'hit' ? target ? [[target.x, target.y]] : [] : tiles;
      if (!points.length) return;
      const until = battle.time + toActionValueDuration(effect.duration);
      if (effect.field === 'hazardUntil') placeHazardZone(battle, source.id, moveId, points, until);
      else setTileEffects(battle, points, effect.field, until);
    },
    preview: effect => `${effect.field === 'hazardUntil' ? 'Hazard' : effect.field === 'mudUntil' ? 'Slowing ground' : 'Cover'} for ${formatCycleDuration(effect.duration)}`,
    score: (effect, { battle, tiles, target }) => {
      const points = effect.on === 'hit' && target ? [[target.x, target.y]] : tiles;
      return points.some(([x, y]) => (battle.map.tiles[y]?.[x]?.[effect.field] ?? 0) <= battle.time) ? 1 : 0;
    },
  },
  chain: {
    validate: effect => [...chanceError(effect.chance), ...(!Number.isInteger(effect.radius) || effect.radius < 1 ? ['chain radius must be a positive integer'] : []), ...(!Number.isFinite(effect.damageFraction) || effect.damageFraction <= 0 ? ['chain damage fraction must be positive'] : [])],
    resolve: (effect, { battle, target, visual, chainHit }) => {
      if (!target || random(battle) >= effect.chance) return;
      const chained = battle.units.find(unit => unit.side === target.side && unit.id !== target.id && unit.hp > 0 && distance(unit, target) <= effect.radius);
      if (chained) { visual?.tiles.push([chained.x, chained.y]); chainHit(chained, effect.damageFraction); }
    },
    preview: effect => `${Math.round(effect.chance * 100)}% chain within ${effect.radius} tile${effect.radius === 1 ? '' : 's'} for ${Math.round(effect.damageFraction * 100)}% damage`,
    score: (effect, { battle, target }) => target && battle.units.some(unit => unit.side === target.side && unit.id !== target.id && unit.hp > 0 && distance(unit, target) <= effect.radius) ? effect.chance * effect.damageFraction : 0,
  },
  stage: {
    validate: effect => [...durationError(effect.duration), ...(!Number.isInteger(effect.delta) || effect.delta === 0 ? ['stage change must be a nonzero integer'] : [])],
    resolve: (effect, context) => { for (const unit of targets(context, effect)) changeStage(unit, effect.stat, effect.delta, context.battle.time + toActionValueDuration(effect.duration)); },
    preview: effect => `${effect.stat} ${effect.delta > 0 ? '+' : ''}${effect.delta} for ${formatCycleDuration(effect.duration)} (${effect.recipients})`,
    score: (effect, context) => targets(context, effect).some(unit => (effect.delta > 0 ? unit.stages[effect.stat] < MAX_STAGE : unit.stages[effect.stat] > -MAX_STAGE)
      || unit.stageUntil[effect.stat] <= context.battle.time + toActionValueDuration(100)) ? 1 : 0,
  },
  weather: {
    validate: effect => durationError(effect.duration),
    resolve: (effect, { battle }) => { battle.weather = effect.weather; battle.weatherUntil = battle.time + toActionValueDuration(effect.duration); },
    preview: effect => `Sets ${effect.weather} for ${formatCycleDuration(effect.duration)}`,
    score: (effect, { battle }) => battle.weather === effect.weather ? 0 : 1,
  },
  'trick-room': {
    validate: effect => durationError(effect.duration),
    resolve: (effect, { battle, source, log }) => {
      if (battle.trickRoomUntil > battle.time) {
        battle.trickRoomUntil = 0;
        log('Trick Room ended.');
      } else {
        battle.trickRoomUntil = battle.time + toActionValueDuration(effect.duration);
        log(`${source.name} twisted the action timeline with Trick Room.`);
      }
    },
    preview: effect => `Reverses turn frequency for ${formatCycleDuration(effect.duration)}; slower Speed acts sooner`,
    score: (_effect, { battle, source }) => {
      if (battle.trickRoomUntil > battle.time) return 0;
      const rates = battle.units.filter(unit => unit.hp > 0);
      if (!rates.length) return 0;
      let benefit = 0, roomRate = 0;
      for (const unit of rates) {
        const speed = planningSpeed(unit, battle);
        const normalRate = timelineSpeed(speed, false);
        const roomTimelineSpeed = timelineSpeed(speed, true);
        const sideSign = unit.side === source.side ? 1 : -1;
        benefit += sideSign * (roomTimelineSpeed - normalRate);
        roomRate += roomTimelineSpeed;
      }
      return benefit > 0 ? Math.min(1, benefit / Math.max(1, roomRate)) : 0;
    },
  },
  action: {
    validate: effect => Number.isInteger(effect.amount) && effect.amount > 0 ? [] : ['action value change must be a positive integer'],
    resolve: (effect, context) => { for (const unit of actionTargets(effect, context)) changeNextAction(unit, context.battle, effect.direction, effect.amount); },
    preview: effect => `${effect.direction === 'advance' ? 'Advances' : 'Delays'} ${effect.on === 'cast' ? effect.recipients : 'the target'} by ${effect.amount} AV`,
    score: (effect, context) => Math.min(1, actionTargets(effect, context).reduce((score, unit) => {
      if (unit.id !== context.battle.current && unit.nextAction < context.battle.time) return score;
      const advancesAlly = effect.direction === 'advance' && unit.side === context.source.side;
      const delaysEnemy = effect.direction === 'delay' && unit.side !== context.source.side;
      return score + (advancesAlly || delaysEnemy ? 0.5 : 0.05);
    }, 0)),
  },
};

function handlerFor(effect: MoveEffect): Handler<MoveEffect> {
  return handlers[effect.kind] as unknown as Handler<MoveEffect>;
}

export function validateMoveEffect(effect: MoveEffect, move: Move): string[] {
  return [...(effect.on === 'hit' && !move.power ? ['hit effects require a damaging move'] : []), ...handlerFor(effect).validate(effect, move)];
}

/** Cast effects run first; then each direct target resolves damage and hit effects in authored order. */
export function resolveMoveEffects(phase: MoveEffect['on'], effects: readonly MoveEffect[] | undefined, context: EffectContext) {
  for (const effect of effects ?? []) if (effect.on === phase && (phase === 'cast' || (context.target?.hp ?? 0) > 0)) handlerFor(effect).resolve(effect, context);
}

export function previewMoveEffects(move: Move, context: EffectView): string[] {
  return (move.effects ?? []).map(effect => handlerFor(effect).preview(effect, context));
}

export function scoreMoveEffects(move: Move, phase: MoveEffect['on'], context: EffectView): number {
  return (move.effects ?? []).reduce((score, effect) => score + (effect.on === phase ? handlerFor(effect).score(effect, context) : 0), 0);
}
