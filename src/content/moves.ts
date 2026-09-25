import type { Move } from '../game/types';

export const MOVES: Record<string, Move> = {
  tackle: { name: 'Tackle', type: 'Normal', category: 'Physical', power: 35, range: 1, apCost: 1, target: 'unit', contact: true, detail: 'Adjacent hit.' },
  ember: { name: 'Ember', type: 'Fire', category: 'Special', power: 34, range: 3, apCost: 1, target: 'unit', detail: '25% Burn.', effects: [{ kind: 'status', on: 'hit', status: 'burned', chance: 0.25, duration: 200 }] },
  vineWhip: { name: 'Vine Whip', type: 'Grass', category: 'Physical', power: 38, range: 2, apCost: 1, target: 'unit', contact: true, detail: 'Pulls the target one tile.', effects: [{ kind: 'displace', on: 'hit', direction: 'pull', tiles: 1 }] },
  waterPulse: { name: 'Water Pulse', type: 'Water', category: 'Special', power: 38, range: 3, apCost: 1, target: 'unit', detail: 'Pushes the target one tile.', effects: [{ kind: 'displace', on: 'hit', direction: 'push', tiles: 1 }] },
  thunderShock: { name: 'Thunder Shock', type: 'Electric', category: 'Special', power: 34, range: 3, apCost: 1, target: 'unit', detail: '30% chance to chain to an adjacent enemy.', effects: [{ kind: 'chain', on: 'hit', chance: 0.3, radius: 1, damageFraction: 0.5 }] },
  rockThrow: { name: 'Rock Throw', type: 'Rock', category: 'Physical', power: 40, range: 3, apCost: 1, target: 'unit', detail: 'Creates temporary cover.', effects: [{ kind: 'tile', on: 'hit', field: 'coverUntil', duration: 150 }] },
  mudSlap: { name: 'Mud Slap', type: 'Ground', category: 'Special', power: 30, range: 3, apCost: 1, target: 'unit', detail: 'Leaves slowing ground.', effects: [{ kind: 'tile', on: 'hit', field: 'mudUntil', duration: 150 }] },
  iceShard: { name: 'Ice Shard', type: 'Ice', category: 'Physical', power: 32, range: 6, apCost: 1, target: 'unit', detail: 'Long range.' },
  tailWhip: { name: 'Tail Whip', type: 'Normal', category: 'Status', power: 0, range: 0, apCost: 1, target: 'self', area: { width: 3, height: 3, anchor: 'center' }, detail: 'Defense −1 for every Pokémon within a 3×3 area.', effects: [{ kind: 'stage', on: 'cast', stat: 'defense', delta: -1, recipients: 'all' }] },
  harden: { name: 'Harden', type: 'Normal', category: 'Status', power: 0, range: 0, apCost: 1, target: 'self', detail: 'Defense +1.', effects: [{ kind: 'stage', on: 'cast', stat: 'defense', delta: 1, recipients: 'self' }] },
  howl: { name: 'Howl', type: 'Normal', category: 'Status', power: 0, range: 0, apCost: 1, target: 'self', area: { width: 3, height: 3, anchor: 'center' }, detail: 'Allied Attack +1 within a 3×3 area.', effects: [{ kind: 'stage', on: 'cast', stat: 'attack', delta: 1, recipients: 'allies' }] },
  stealthRock: { name: 'Stealth Rock', type: 'Rock', category: 'Status', power: 0, range: 3, apCost: 2, target: 'tile', area: { width: 3, height: 3, anchor: 'center' }, detail: '3×3 hazard; entry costs ⅛ max HP.', effects: [{ kind: 'tile', on: 'cast', field: 'hazardUntil', duration: 200 }] },
  thunderbolt: { name: 'Thunderbolt', type: 'Electric', category: 'Special', power: 62, range: 4, apCost: 3, target: 'tile', area: { width: 2, height: 2, anchor: 'corner' }, detail: '2×2 blast; 25% Paralysis.', effects: [{ kind: 'status', on: 'hit', status: 'paralyzed', chance: 0.25, duration: 200 }] },
  sandstorm: { name: 'Sandstorm', type: 'Rock', category: 'Status', power: 0, range: 0, apCost: 4, target: 'self', detail: 'Sets sandstorm for 300 battle time.', effects: [{ kind: 'weather', on: 'cast', weather: 'sandstorm', duration: 300 }] },
  sunnyDay: { name: 'Sunny Day', type: 'Fire', category: 'Status', power: 0, range: 0, apCost: 4, target: 'self', detail: 'Sets sun for 300 battle time.', effects: [{ kind: 'weather', on: 'cast', weather: 'sun', duration: 300 }] },
};
