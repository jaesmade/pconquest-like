import Board from '../battle/Board';
import { abilityFor, itemBlocksMove, itemFor, itemSpecial, MOVES } from '../content/data';
import { active, apGain, canUseMove, maxCarryAp, upcoming } from '../game/engine';
import type { Battle, Run } from '../game/types';
import MovePreview from './MovePreview';
import Sprite from './Sprite';

type Props = {
  run: Run;
  battle: Battle;
  mode: 'inspect' | 'move' | 'attack';
  chosenMove: string;
  target?: [number, number];
  notice: string;
  onTile: (x: number, y: number) => void;
  onAnimationState: (playing: boolean) => void;
  onMode: (mode: 'move' | 'attack') => void;
  onChooseMove: (id: string) => void;
  onAttack: () => void;
  onSpecial: () => void;
  onPass: () => void;
  onComplete: () => void;
};

export default function BattleScreen(props: Props) {
  const { run, battle, mode, chosenMove, target, notice } = props;
  const current = battle.result ? undefined : active(battle);
  const currentMon = current && run.party.find(mon => mon.id === current.partyId);
  const selectedMove = chosenMove ? MOVES[chosenMove] : undefined;

  return <main className="battle-layout">
    <section className="board-column">
      <div className="board-head">
        <div><span className="eyebrow">ENCOUNTER {run.encounter + 1}</span><h2>{battle.map.name}</h2></div>
        <div className="weather"><b>{battle.weather.toUpperCase()}</b><small>{battle.weather === 'clear' ? 'No weather effect' : `until time ${battle.weatherUntil}`}</small></div>
      </div>
      <Board key={battle.map.id} battle={battle} mode={mode} chosenMove={chosenMove} target={target} onTile={props.onTile} onAnimationState={props.onAnimationState} />
      <div className="board-legend">
        <span>▣ Height</span><span>≈ Deep water · swimmers/flyers</span><span>◆ Lava · 10% HP</span><span>● Shadow: flying · ◯ Ripple: swimming</span>
        {mode === 'attack' && chosenMove && <span>Blue: range · green: strong · orange: resisted · gray: immune</span>}
        {battle.map.capture && <span>◯ Capture point</span>}
      </div>
    </section>
    <aside className="battle-sidebar">
      <section className="panel">
        <span className="eyebrow">ROUND {battle.round} · BATTLE TIME {battle.time}</span>
        <h3>{battle.result ? battle.result === 'win' ? 'Victory!' : 'Defeat' : current?.side === 'player' ? `${current.name}'s turn` : 'Opponent turn'}</h3>
        {current && <>
          <div className="unit-summary"><Sprite id={current.species} /><div><b>{current.hp}/{current.maxHp} HP · {current.ap} AP</b><small>{current.types.join(' / ')} · {current.mobility.state} · +{current.maxAp} AP/turn · Move up to {current.stats[6]} tiles per command</small><small>{current.ability} · {current.item}</small><small>{abilityFor(current.ability)?.description}</small>{current.item !== 'None' && <small>{itemFor(current.item)?.description}</small>}</div></div>
          <div className="action-row">
            <button disabled={current.side !== 'player' || current.ap < 1 || current.attackedThisTurn} className={mode === 'attack' ? 'active' : ''} onClick={() => props.onMode('attack')}>{current.attackedThisTurn ? 'Attack used' : 'Attack'}</button>
            <button disabled={current.side !== 'player' || current.ap < 1} className={mode === 'move' ? 'active' : ''} onClick={() => props.onMode('move')}>Move</button>
            <button disabled={current.side !== 'player' || !itemSpecial(current)} onClick={props.onSpecial}>Special</button>
          </div>
          <p className="hint">Use one Attack command per turn, then keep moving or use Special while AP remains. End the turn to carry up to {maxCarryAp} unused AP forward.</p>
          {mode === 'attack' && currentMon && <div className="moves">{current.moves.map(id => <button key={id} className={chosenMove === id ? 'active' : ''} disabled={current.attackedThisTurn || current.ap < MOVES[id].apCost || itemBlocksMove(current, MOVES[id])} onClick={() => props.onChooseMove(id)}><b>{MOVES[id].name}</b><small>{MOVES[id].type} · {MOVES[id].category} · Range {MOVES[id].range} · {MOVES[id].apCost} AP</small></button>)}</div>}
          {selectedMove && mode === 'attack' && <p className="hint">{selectedMove.detail} {selectedMove.target === 'self' ? 'Confirm to use.' : 'Select a target tile on the grid.'}</p>}
          {chosenMove && mode === 'attack' && <MovePreview battle={battle} attacker={current} moveId={chosenMove} target={target} />}
          {mode === 'attack' && target && chosenMove && <button className="primary full" disabled={!canUseMove(battle, current, chosenMove, target[0], target[1])} onClick={props.onAttack}>Confirm {selectedMove?.name}</button>}
          <button className="end-turn" disabled={current.side !== 'player'} onClick={props.onPass}>End turn →</button>
        </>}
        {battle.result && <button className="primary full" onClick={props.onComplete}>{battle.result === 'win' ? 'Collect XP →' : 'View result →'}</button>}
        {notice && <p className="notice">{notice}</p>}
      </section>
      <section className="panel"><span className="eyebrow">TURN ORDER · ROUND {battle.round}</span><div className="queue">{upcoming(battle).map((unit, i) => <div key={unit.id} className={unit.id === battle.current ? 'now' : ''}><span>{i + 1}. {unit.name}</span><small>{unit.side === 'player' ? 'ALLY' : 'FOE'} · +{unit.id === battle.current ? unit.maxAp : apGain(unit, battle)} AP</small></div>)}</div></section>
      <section className="panel"><span className="eyebrow">ACTION LOG</span><div className="log">{battle.log.slice(0, 8).map((entry, i) => <p key={i}>{entry}</p>)}</div></section>
    </aside>
  </main>;
}
