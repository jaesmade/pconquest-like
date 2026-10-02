/** The level-10 current catalog is calibrated to average 65 effective Speed. */
export const SPEED_REFERENCE = 65;
export const BASE_ACTION_INTERVAL = 10_000 * SPEED_REFERENCE;
export const ACTION_VALUE_PER_CYCLE = 10_000;
export const LEGACY_TIME_PER_CYCLE = 100;
export const TRICK_ROOM_REFERENCE_SPEED = SPEED_REFERENCE;

/** Move and status durations remain authored in the former battle-time units. */
export const toActionValueDuration = (duration: number) => duration * ACTION_VALUE_PER_CYCLE / LEGACY_TIME_PER_CYCLE;

export function formatCycleDuration(duration: number) {
  const cycles = duration / LEGACY_TIME_PER_CYCLE;
  const amount = Number.isInteger(cycles) ? String(cycles) : String(Number(cycles.toFixed(1)));
  return `${amount} cycle${cycles === 1 ? '' : 's'}`;
}

export const actionInterval = (speed: number) => BASE_ACTION_INTERVAL / Math.max(0.5, speed);

/** Trick Room reciprocates timeline Speed around the roster's Speed-65 baseline. */
export const timelineSpeed = (effectiveSpeed: number, trickRoomActive: boolean) => {
  const speed = Math.max(0.5, effectiveSpeed);
  return trickRoomActive ? TRICK_ROOM_REFERENCE_SPEED ** 2 / speed : speed;
};

export type ActionDirection = 'advance' | 'delay';

/** Adjust a waiting unit's action timestamp without changing its Speed interval. */
export function changeNextAction(unit: { id: string; nextAction: number; nextActionShift: number }, battle: { current: string; time: number }, direction: ActionDirection, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const delta = direction === 'advance' ? -amount : amount;
  if (unit.id === battle.current) {
    unit.nextActionShift += delta;
    return true;
  }
  unit.nextAction = Math.max(battle.time, unit.nextAction + delta);
  return true;
}
