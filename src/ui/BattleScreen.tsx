import { useEffect, useRef, useState } from 'react';
import Board from '../battle/Board';
import { itemBlocksMove, itemFor, itemSpecial, mapHeight, mapWidth, MOVES } from '../content/data';
import { active, apGain, canUseMove, upcoming } from '../game/engine';
import type { Battle, Run, Unit } from '../game/types';
import MovePreview from './MovePreview';
import Sprite from './Sprite';

type Mode = 'inspect' | 'move' | 'attack';
type Props = {
  run: Run; battle: Battle; mode: Mode; chosenMove: string; target?: [number, number]; notice: string;
  onTile: (x: number, y: number) => void; onAnimationState: (playing: boolean) => void;
  onMode: (mode: Mode) => void; onChooseMove: (id: string) => void; onAttack: () => void;
  onSpecial: () => void; onPass: () => void; onComplete: () => void; onPause: () => void;
};

const statLabels: Record<string, string> = { attack: 'Attack', defense: 'Defense', specialAttack: 'Sp. Atk', specialDefense: 'Sp. Def' };
function StatusIcons({ unit, time }: { unit: Unit; time: number }) {
  const statuses = Object.entries(unit.status).filter(([key, until]) => key === 'flashFire' ? !!until : until >= time)
    .map(([key]) => ({ key, label: key, icon: key === 'burned' ? 'status-burned' : key === 'paralyzed' ? 'status-paralyzed' : 'status-charged' }));
  const stages = Object.entries(unit.stages).filter(([, value]) => value !== 0)
    .map(([key, value]) => ({ key, label: `${statLabels[key]} ${value > 0 ? '+' : ''}${value}`, icon: value > 0 ? 'stage-buff' : 'stage-debuff' }));
  return statuses.length || stages.length ? <div className="status-icons" aria-label="Status and stat changes">
    {[...statuses, ...stages].map(effect => <span className="status-icon" key={effect.key} title={effect.label} aria-label={effect.label}>
      <img src={`/assets/ui/icons/${effect.icon}.svg`} alt="" /><small>{effect.label}</small>
    </span>)}
  </div> : null;
}

export default function BattleScreen(props: Props) {
  const { run, battle, mode, chosenMove, target, notice } = props;
  const current = battle.result ? undefined : active(battle);
  const move = chosenMove ? MOVES[chosenMove] : undefined;
  const [open, setOpen] = useState(true);
  const [anchor, setAnchor] = useState({ left: 20, top: 150, flip: false });
  const stageRef = useRef<HTMLElement>(null);
  useEffect(() => { setOpen(true); }, [current?.id, battle.round]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !current) return;
    const position = () => {
      const canvas = stage.querySelector<HTMLCanvasElement>('.board canvas');
      if (!canvas) return;
      const board = canvas.getBoundingClientRect(), area = stage.getBoundingClientRect();
      const x = board.left - area.left + (current.x + 0.5) * board.width / mapWidth(battle.map);
      const y = board.top - area.top + (current.y + 0.5) * board.height / mapHeight(battle.map);
      const flip = x > area.width * 0.58;
      setAnchor({ left: Math.max(12, Math.min(area.width - 344, x + (flip ? -344 : 28))),
        top: Math.max(96, Math.min(area.height - 320, y - 42)), flip });
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(stage);
    const canvas = stage.querySelector('canvas');
    if (canvas) observer.observe(canvas);
    const insertion = new MutationObserver(() => {
      const added = stage.querySelector('canvas');
      if (added) { observer.observe(added); position(); insertion.disconnect(); }
    });
    if (!canvas) insertion.observe(stage, { childList: true, subtree: true });
    window.addEventListener('resize', position);
    return () => { insertion.disconnect(); observer.disconnect(); window.removeEventListener('resize', position); };
  }, [battle.map, current?.id, current?.x, current?.y]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mode !== 'inspect') props.onMode('inspect');
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, props.onMode]);
  const tile = (x: number, y: number) => {
    if (mode === 'inspect') setOpen(!!current && x === current.x && y === current.y);
    props.onTile(x, y);
  };
  const playerTurn = current?.side === 'player' && !battle.result;

  return <main className="battle-stage" ref={stageRef}>
    <div className="battle-map-frame"><Board key={battle.map.id} battle={battle} mode={mode} chosenMove={chosenMove} target={target} onTile={tile} onAnimationState={props.onAnimationState} /></div>
    <header className="battle-top-hud">
      <div className="battle-location"><span className="eyebrow">ENCOUNTER {run.encounter + 1} · ROUND {battle.round}</span><strong>{battle.map.name}</strong><small>{battle.objective === 'defeat-and-capture' ? 'Defeat foes and hold capture point' : 'Defeat the opposing team'} · {battle.weather}</small></div>
      <div className="turn-strip" aria-label="Turn order">{upcoming(battle).slice(0, 6).map((unit, index) =>
        <div key={`${unit.id}-${index}`} className={`turn-portrait ${unit.side} ${index === 0 ? 'now' : ''}`} title={`${unit.name} · +${index === 0 ? unit.maxAp : apGain(unit, battle)} AP`}>
          <Sprite id={unit.species} /><span>{unit.name}</span>
        </div>)}</div>
      <button className="battle-pause" onClick={props.onPause}>☰ Menu</button>
    </header>
    {current && !battle.result && <div className="battle-actor-hud"><Sprite id={current.species} /><div><b>{current.name}</b><span>{current.hp}/{current.maxHp} HP · {current.ap} AP</span><StatusIcons unit={current} time={battle.time} /></div><button onClick={() => setOpen(value => !value)}>{open ? '×' : 'Actions'}</button></div>}
    {!playerTurn && !battle.result && <div className="opponent-turn">Opponent acting…</div>}
    {playerTurn && open && <section className={`action-popup ${anchor.flip ? 'flip' : ''}`} style={{ left: anchor.left, top: anchor.top }} aria-label={`${current.name} actions`}>
      <div className="action-popup-head"><Sprite id={current.species} /><div><b>{current.name}</b><small>{current.hp}/{current.maxHp} HP · {current.ap} AP · {current.attackedThisTurn ? 'Attack used' : 'Attack ready'}</small></div><button onClick={() => setOpen(false)} aria-label="Close actions">×</button></div>
      <StatusIcons unit={current} time={battle.time} />
      <div className="action-row">
        <button disabled={current.ap < 1 || current.attackedThisTurn} className={mode === 'attack' ? 'active' : ''} onClick={() => props.onMode('attack')}>Attack</button>
        <button disabled={current.ap < 1} className={mode === 'move' ? 'active' : ''} onClick={() => props.onMode('move')}>Move</button>
        <button disabled={!itemSpecial(current)} onClick={props.onSpecial} title={itemFor(current.item)?.description ?? 'No usable item'}><img src={`/assets/ui/icons/item-${current.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" />Special</button>
      </div>
      {mode === 'attack' && <div className="moves">{current.moves.map(id => <button key={id} className={chosenMove === id ? 'active' : ''} disabled={current.attackedThisTurn || current.ap < MOVES[id].apCost || itemBlocksMove(current, MOVES[id])} onClick={() => props.onChooseMove(id)}><b>{MOVES[id].name}</b><small>{MOVES[id].type} · {MOVES[id].category} · Range {MOVES[id].range} · {MOVES[id].apCost} AP{MOVES[id].tags.length ? ` · ${MOVES[id].tags.join(', ')}` : ''}</small></button>)}</div>}
      {move && mode === 'attack' && <p className="hint">{move.detail} {move.target === 'self' ? 'Confirm to use.' : 'Select a target tile.'}</p>}
      {chosenMove && mode === 'attack' && <MovePreview battle={battle} attacker={current} moveId={chosenMove} target={target} />}
      {mode === 'attack' && target && chosenMove && <button className="primary full" disabled={!canUseMove(battle, current, chosenMove, target[0], target[1])} onClick={props.onAttack}>Confirm {move?.name}</button>}
      {mode === 'move' && <p className="hint">Choose a highlighted tile. Movement costs AP and can be repeated.</p>}
      <button className="end-turn" onClick={props.onPass}>End turn →</button>
      {notice && <p className="notice" role="status">{notice}</p>}
    </section>}
    {battle.result && <div className="battle-result"><h2>{battle.result === 'win' ? 'Victory!' : 'Defeat'}</h2><button className="primary" onClick={props.onComplete}>{battle.result === 'win' ? 'Collect XP →' : 'View result →'}</button></div>}
    <details className="battle-log"><summary>Action log</summary>{battle.log.slice(0, 8).map((entry, index) => <p key={index}>{entry}</p>)}</details>
    <div className="battle-help">{mode === 'attack' && chosenMove ? 'Blue: range · green: strong · orange: resisted · gray: immune' : 'Select your Pokémon for actions'}</div>
  </main>;
}
