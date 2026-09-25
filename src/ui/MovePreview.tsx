import { abilityAbsorption, abilityHitChance, effectiveness, MOVES } from '../content/data';
import { affectedTiles, canHitWithMove, damagePreview } from '../game/engine';
import type { Battle, Unit } from '../game/types';

type Props = { battle: Battle; attacker: Unit; moveId: string; target?: [number, number] };

function matchup(battle: Battle, attacker: Unit, defender: Unit, moveId: string) {
  const move = MOVES[moveId];
  if (!move.power) return 'Status move';
  const absorption = abilityAbsorption(defender.ability, move.type);
  if (absorption) return absorption.kind === 'heal' ? 'Absorbed · heals target' : 'Absorbed · boosts target';
  const value = effectiveness(move.type, defender.types);
  const label = value === 0 ? 'Immune' : value === 0.25 || value === 0.5 ? 'Not very effective' : value >= 4 ? 'Extremely effective' : value >= 2 ? 'Super effective' : 'Neutral';
  const preview = damagePreview(battle, attacker, defender, moveId);
  return `${value}× ${label} · ${preview.damage} damage${preview.damage ? `, ${preview.crit} crit` : ''}`;
}

export default function MovePreview({ battle, attacker, moveId, target }: Props) {
  const move = MOVES[moveId];
  if (!move) return null;
  const inRange = battle.units.filter(unit => canHitWithMove(battle, attacker, moveId, unit));
  const selectedTiles = target ? affectedTiles(battle.map, moveId, target[0], target[1]) : [];
  const selectedTargets = battle.units.filter(unit => unit.hp > 0 && unit.side !== attacker.side && selectedTiles.some(([x, y]) => unit.x === x && unit.y === y));
  const range = move.target === 'self' ? 'Self' : `${move.range} tiles${move.range > 0 ? ' (+1 from high ground)' : ''}`;
  return <div className="move-preview">
    <div className="move-preview-title"><b>{move.name} · {move.apCost} AP · range: {range}</b><small>{move.area ? `${move.area.width}×${move.area.height} area` : move.target === 'self' ? 'Self' : 'One enemy'}</small></div>
    {move.power ? <>
      <span className="eyebrow">TYPE EFFECTIVENESS IN REACH</span>
      {inRange.length ? inRange.map(unit => <div className="matchup" key={unit.id}><strong>{unit.name}</strong><span>{matchup(battle, attacker, unit, moveId)}</span></div>) : <p className="hint">No enemy in range yet.</p>}
      {target && <div className="selected-preview"><b>Selected area</b>{selectedTargets.length ? selectedTargets.map(unit => <span key={unit.id}>{unit.name}: {matchup(battle, attacker, unit, moveId)} · Hit {Math.round(abilityHitChance(unit.ability, battle.weather) * 100)}%</span>) : <span>No enemy in the selected area.</span>}<small>Critical chance: 1 in 24 per hit.</small></div>}
    </> : <p className="hint">Support move: no type damage. The highlighted cells show its target or affected area.</p>}
  </div>;
}
