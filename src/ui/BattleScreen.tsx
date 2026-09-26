import { useEffect, useMemo, useRef, useState } from 'react';
import Board from '../battle/Board';
import type { BoardView, CameraCommand } from '../battle/Board';
import { ISO_HALF_HEIGHT, ISO_HALF_WIDTH, isoGridAtWorld, isoTileCenter, isoWorldSize } from '../battle/isometric';
import { abilityAbsorption, itemBlocksMove, itemFor, itemSpecial, mapHeight, mapWidth, MOVES, SPECIES } from '../content/data';
import { active, apGain, canUseMove, upcoming, unitAt } from '../game/engine';
import { reachable } from '../game/grid';
import { damageRange } from '../game/damage';
import type { Battle, Run, Unit } from '../game/types';
import MovePreview from './MovePreview';
import Sprite from './Sprite';

type Mode = 'inspect' | 'move' | 'attack';
type Props = {
  run: Run; battle: Battle; mode: Mode; chosenMove: string; target?: [number, number]; notice: string; paused: boolean;
  controlBoth?: boolean; labSeed?: number; onLabReset?: () => void;
  onTile: (x: number, y: number) => void; onAnimationState: (playing: boolean) => void;
  onMode: (mode: Mode) => void; onChooseMove: (id: string) => void; onAttack: () => void;
  onMove: () => void; onSpecial: () => void; onPass: () => void; onComplete: () => void; onPause: () => void;
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
  const [anchor, setAnchor] = useState({ left: 20, top: 150, flip: false, arrowTop: 40 });
  const [inspected, setInspected] = useState<[number, number]>();
  const [visualBusy, setVisualBusy] = useState(false);
  const [cameraAction, setCameraAction] = useState<{ id: number; command: CameraCommand; point?: [number, number] }>();
  const view = useRef<BoardView | undefined>(undefined);
  const stageRef = useRef<HTMLElement>(null);
  const popupRef = useRef<HTMLElement>(null);
  const actorToggleRef = useRef<HTMLButtonElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const cameraSequence = useRef(0);
  const routes = useMemo(() => current && (current.side === 'player' || props.controlBoth) ? reachable(battle, current) : new Map(), [battle, current, props.controlBoth]);
  const labTarget = props.controlBoth && current ? battle.units.find(unit => unit.side !== current.side) : undefined;
  const labDamage = current && labTarget && move && move.category !== 'Status' ? damageRange(battle, current, labTarget, move) : undefined;
  const labAbsorption = labTarget && move ? abilityAbsorption(labTarget.ability, move.type) : undefined;
  const selectedRoute = target && mode === 'move' ? routes.get(`${target[0]},${target[1]}`) : undefined;
  const inspectedUnit = inspected ? unitAt(battle, inspected[0], inspected[1]) : undefined;
  const issueCamera = (command: CameraCommand, point?: [number, number]) => setCameraAction({ id: ++cameraSequence.current, command, point });
  const closePopup = () => {
    setOpen(false);
    requestAnimationFrame(() => actorToggleRef.current?.focus());
  };
  const positionPopup = (snapshot = view.current) => {
    const stage = stageRef.current, canvas = stage?.querySelector<HTMLCanvasElement>('.board canvas');
    if (!stage || !canvas || !current) return;
    const board = canvas.getBoundingClientRect(), area = stage.getBoundingClientRect();
    const world = isoWorldSize(battle.map), center = isoTileCenter(battle.map, current.x, current.y);
    const scaleX = snapshot ? snapshot.zoom * board.width / snapshot.width : board.width / world.width;
    const scaleY = snapshot ? snapshot.zoom * board.height / snapshot.height : board.height / world.height;
    const x = board.left - area.left + (center.x - (snapshot?.left ?? 0)) * scaleX;
    const y = board.top - area.top + (center.y - 28 - (snapshot?.top ?? 0)) * scaleY;
    const width = popupRef.current?.offsetWidth ?? 340, height = popupRef.current?.offsetHeight ?? 340;
    const safeTop = 96, safeBottom = 100, margin = 12;
    const rightFits = x + 28 + width <= area.width - margin;
    const leftFits = x - 28 - width >= margin;
    const flip = !rightFits && (leftFits || x > area.width / 2);
    const left = Math.max(margin, Math.min(area.width - margin - width, x + (flip ? -width - 28 : 28)));
    const top = Math.max(safeTop, Math.min(area.height - safeBottom - height, y - 45));
    const arrowTop = Math.max(20, Math.min(height - 24, y - top));
    setAnchor(previous => Math.abs(previous.left - left) < 1 && Math.abs(previous.top - top) < 1
      && previous.flip === flip && Math.abs(previous.arrowTop - arrowTop) < 1
      ? previous : { left, top, flip, arrowTop });
  };
  useEffect(() => { setOpen(true); setInspected(undefined); }, [current?.id, battle.round]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !current) return;
    positionPopup();
    const observer = new ResizeObserver(() => positionPopup());
    observer.observe(stage);
    const canvas = stage.querySelector('canvas');
    if (canvas) observer.observe(canvas);
    if (popupRef.current) observer.observe(popupRef.current);
    const insertion = new MutationObserver(() => {
      const added = stage.querySelector('canvas');
      if (added) { observer.observe(added); positionPopup(); insertion.disconnect(); }
    });
    if (!canvas) insertion.observe(stage, { childList: true, subtree: true });
    const onResize = () => positionPopup();
    window.addEventListener('resize', onResize);
    return () => { insertion.disconnect(); observer.disconnect(); window.removeEventListener('resize', onResize); };
  }, [battle.map, current?.id, current?.x, current?.y, mode, open, chosenMove, target?.[0], target?.[1]]);
  const onViewChange = (next: BoardView) => {
    view.current = next;
    positionPopup(next);
    const mini = minimapRef.current;
    if (mini) {
      const context = mini.getContext('2d');
      if (context) {
        const width = mapWidth(battle.map), height = mapHeight(battle.map), world = isoWorldSize(battle.map);
        const scale = Math.min(mini.width / world.width, mini.height / world.height);
        const offsetX = (mini.width - world.width * scale) / 2, offsetY = (mini.height - world.height * scale) / 2;
        context.clearRect(0, 0, mini.width, mini.height);
        const palette = { plain: '#649351', water: '#378eaa', lava: '#cf7240', wall: '#586776' };
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const center = isoTileCenter(battle.map, x, y), px = offsetX + center.x * scale, py = offsetY + center.y * scale;
          context.fillStyle = palette[battle.map.tiles[y][x].kind];
          context.beginPath(); context.moveTo(px, py - ISO_HALF_HEIGHT * scale);
          context.lineTo(px + ISO_HALF_WIDTH * scale, py); context.lineTo(px, py + ISO_HALF_HEIGHT * scale);
          context.lineTo(px - ISO_HALF_WIDTH * scale, py); context.closePath(); context.fill();
        }
        for (const unit of battle.units.filter(unit => unit.hp > 0)) {
          const center = isoTileCenter(battle.map, unit.x, unit.y);
          context.fillStyle = unit.side === 'player' ? '#c8ffcf' : '#ffc0a6';
          context.fillRect(offsetX + center.x * scale - 2, offsetY + center.y * scale - 2, 4, 4);
        }
        context.strokeStyle = '#fff5ba'; context.lineWidth = 2;
        const left = Math.max(0, next.left), top = Math.max(0, next.top);
        const right = Math.min(world.width, next.left + next.width / next.zoom);
        const bottom = Math.min(world.height, next.top + next.height / next.zoom);
        if (right > left && bottom > top) context.strokeRect(offsetX + left * scale, offsetY + top * scale,
          (right - left) * scale, (bottom - top) * scale);
      }
    }
  };
  useEffect(() => { if (view.current) onViewChange(view.current); }, [battle]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || props.paused || !current || (current.side !== 'player' && !props.controlBoth)) return;
      event.preventDefault();
      if (mode !== 'inspect') props.onMode('inspect');
      else if (inspected) { setInspected(undefined); setOpen(true); }
      else if (open) closePopup();
      else props.onPause();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, open, inspected, props.paused, current?.id, props.onMode, props.onPause]);
  useEffect(() => {
    if (!open || (current?.side !== 'player' && !props.controlBoth) || props.paused) return;
    const frame = requestAnimationFrame(() => popupRef.current?.querySelector<HTMLButtonElement>('[data-popup-focus]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, mode, current?.id, props.paused]);
  const tile = (x: number, y: number) => {
    if (props.paused) return;
    if (mode === 'inspect') {
      const actor = !!current && x === current.x && y === current.y;
      setOpen(actor);
      setInspected(actor ? undefined : [x, y]);
    }
    props.onTile(x, y);
  };
  const playerTurn = !!current && (current.side === 'player' || !!props.controlBoth) && !battle.result;
  const attackReason = current?.attackedThisTurn ? 'Attack already used this turn'
    : !current || current.ap < 1 ? 'No AP remaining'
    : current.moves.every(id => current.ap < MOVES[id].apCost || itemBlocksMove(current, MOVES[id]))
      ? 'No equipped move is usable' : '';
  const moveReason = !current || current.ap < 1 ? 'No AP remaining' : !routes.size ? 'No reachable tile' : '';
  const held = current && itemFor(current.item);
  const specialReason = !current || current.item === 'None' ? 'No held item'
    : !held?.special ? 'This item activates passively'
    : current.ap < held.special.apCost ? `Needs ${held.special.apCost} AP`
    : SPECIES[current.species].form?.kind === 'mega' && held.special.kind === 'mega-evolve' ? 'Already Mega Evolved'
    : !itemSpecial(current) ? 'Special unavailable' : '';
  const attackReady = !!current && !!target && !!chosenMove && canUseMove(battle, current, chosenMove, target[0], target[1]);
  const moveReasonFor = (id: string) => current?.attackedThisTurn ? 'Attack used'
    : current && itemBlocksMove(current, MOVES[id]) ? 'Blocked by Assault Vest'
    : !current || current.ap < MOVES[id].apCost ? `Needs ${MOVES[id].apCost} AP` : '';
  const animationState = (playing: boolean) => {
    setVisualBusy(playing);
    props.onAnimationState(playing);
    if (!playing && visualBusy && (current?.side === 'player' || props.controlBoth) && current && current.ap > 0) setOpen(true);
  };
  const chooseMode = (next: Mode) => { setInspected(undefined); props.onMode(next); };

  return <main className="battle-stage" ref={stageRef}>
    <div className="battle-map-frame"><Board key={battle.map.id} battle={battle} mode={mode} controlBoth={props.controlBoth} chosenMove={chosenMove} target={target} moveRoutes={routes} onTile={tile} onAnimationState={animationState} onViewChange={onViewChange} cameraAction={cameraAction} /></div>
    <header className="battle-top-hud">
      <div className="battle-location"><span className="eyebrow">{props.controlBoth ? 'BATTLE LAB' : `ENCOUNTER ${run.encounter + 1}`} · ROUND {battle.round}</span><strong>{battle.map.name}</strong><small>{battle.objective === 'defeat-and-capture' ? 'Defeat foes and hold capture point' : 'Defeat the opposing team'} · {battle.weather}</small></div>
      <div className="turn-strip" aria-label="Turn order">{upcoming(battle).slice(0, 6).map((unit, index) =>
        <div key={`${unit.id}-${index}`} className={`turn-portrait ${unit.side} ${index === 0 ? 'now' : ''}`} title={index === 0 ? `${unit.name} · ${unit.ap} AP now` : `${unit.name} · ${unit.ap} AP banked · +${apGain(unit, battle)} next turn`}>
          <Sprite id={unit.species} /><span>{unit.name}</span>
        </div>)}</div>
      <button className="battle-pause" onClick={props.onPause}>{props.controlBoth ? '⚙ Setup' : '☰ Menu'}</button>
    </header>
    {current && !battle.result && <div className="battle-actor-hud"><Sprite id={current.species} /><div><b>{current.name}</b><span>{current.hp}/{current.maxHp} HP · {current.ap} AP</span><StatusIcons unit={current} time={battle.time} /></div>{playerTurn && <button ref={actorToggleRef} onClick={() => { setInspected(undefined); setOpen(value => !value); }} aria-label={open ? 'Hide actions' : 'Show actions'}>{open ? '×' : 'Actions'}</button>}</div>}
    {!playerTurn && !battle.result && <div className="opponent-turn">Opponent acting…</div>}
    {playerTurn && open && <section ref={popupRef} className={`action-popup ${anchor.flip ? 'flip' : ''} ${mode !== 'inspect' ? 'submenu' : ''}`} style={{ left: anchor.left, top: anchor.top }} aria-label={`${current.name} actions`} aria-busy={visualBusy}>
      <span className="popup-connector" style={{ top: anchor.arrowTop }} aria-hidden="true" />
      <div className="action-popup-head"><Sprite id={current.species} /><div><b>{current.name}</b><small>{current.hp}/{current.maxHp} HP · {current.ap} AP · {current.attackedThisTurn ? 'Attack used' : 'Attack ready'}</small></div><button onClick={closePopup} aria-label="Close actions">×</button></div>
      <StatusIcons unit={current} time={battle.time} />
      {mode === 'inspect' ? <>
        <div className="action-command-list">
          <button data-popup-focus={!attackReason || undefined} disabled={!!attackReason || visualBusy} title={attackReason || 'Choose one equipped move'} onClick={() => chooseMode('attack')}><b>Attack</b><small>{attackReason || 'Choose a move · once per turn'}</small></button>
          <button data-popup-focus={!!attackReason && !moveReason || undefined} disabled={!!moveReason || visualBusy} title={moveReason || 'Choose a reachable tile'} onClick={() => chooseMode('move')}><b>Move</b><small>{moveReason || `Up to ${current.stats[6]} tiles · costs AP`}</small></button>
          <button data-popup-focus={!!attackReason && !!moveReason && !specialReason || undefined} disabled={!!specialReason || visualBusy} title={specialReason || held?.description} onClick={props.onSpecial}><img src={`/assets/ui/icons/item-${current.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" /><span><b>Special</b><small>{specialReason || `${current.item} · ${held?.special?.apCost} AP`}</small></span></button>
        </div>
        <button data-popup-focus={!!attackReason && !!moveReason && !!specialReason || undefined} className="end-turn" disabled={visualBusy} onClick={props.onPass}>End turn → <small>Bank {current.ap} AP for next turn</small></button>
      </> : <>
        <div className="popup-submenu-title"><button data-popup-focus disabled={visualBusy} onClick={() => chooseMode('inspect')}>← Back</button><b>{mode === 'attack' ? 'Choose an attack' : 'Choose a destination'}</b></div>
        {mode === 'attack' && <>
          <div className="moves">{current.moves.map(id => { const reason = moveReasonFor(id); return <button key={id} className={chosenMove === id ? 'active' : ''} disabled={!!reason || visualBusy} title={reason || MOVES[id].detail} onClick={() => props.onChooseMove(id)}><b>{MOVES[id].name}</b><small>{MOVES[id].type} · {MOVES[id].category} · Range {MOVES[id].range} · {MOVES[id].apCost} AP{MOVES[id].tags.length ? ` · ${MOVES[id].tags.join(', ')}` : ''}</small>{reason && <small className="disabled-reason">{reason}</small>}</button>; })}</div>
          {move && <p className="hint">{move.detail} {move.target === 'self' ? 'Confirm to use.' : 'Select a target tile.'}</p>}
          {chosenMove && <MovePreview battle={battle} attacker={current} moveId={chosenMove} target={target} />}
          <div className="popup-confirm"><button className="primary full" disabled={visualBusy || !attackReady} onClick={props.onAttack}>Confirm {move?.name ?? 'attack'}</button><small>{!chosenMove ? 'Choose a move first' : !target ? 'Select a highlighted target tile' : !attackReady ? 'Target is blocked or out of range' : `Target: ${target[0] + 1}, ${target[1] + 1}`}</small></div>
        </>}
        {mode === 'move' && <>
          <p className="hint">Select a highlighted tile. The route and AP cost appear before you move.</p>
          {target && <div className="path-preview"><b>{selectedRoute ? `Tile ${target[0] + 1}, ${target[1] + 1} · ${selectedRoute.points.length} steps` : 'Tile out of reach'}</b><span>{selectedRoute ? `${selectedRoute.cost} AP · ${current.ap - selectedRoute.cost} AP after moving` : 'Choose a green highlighted tile.'}</span>{selectedRoute && <small>{battle.map.tiles[target[1]][target[0]].kind} · height {battle.map.tiles[target[1]][target[0]].height}</small>}</div>}
          <div className="popup-confirm"><button className="primary full" disabled={!selectedRoute || visualBusy} onClick={props.onMove}>Confirm move</button><small>Movement may be repeated while AP remains</small></div>
        </>}
      </>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </section>}
    {playerTurn && mode === 'inspect' && inspected && !open && <aside className="inspect-card" aria-label="Tile inspection">
      {inspectedUnit && <div className="inspect-unit"><Sprite id={inspectedUnit.species} /><div><b>{inspectedUnit.name}</b><small>{inspectedUnit.side === 'player' ? 'Ally' : 'Opponent'} · {inspectedUnit.types.join(' / ')}</small><small>{inspectedUnit.hp}/{inspectedUnit.maxHp} HP · {inspectedUnit.ability}</small></div></div>}
      <p>{notice || `Tile ${inspected[0] + 1}, ${inspected[1] + 1}`}</p>
      <button onClick={() => { setInspected(undefined); setOpen(true); }}>Return to actions</button>
    </aside>}
    {battle.result && <div className="battle-result"><h2>{props.controlBoth ? `${battle.result === 'win' ? 'Ally' : 'Opponent'} wins` : battle.result === 'win' ? 'Victory!' : 'Defeat'}</h2><button className="primary" onClick={props.onComplete}>{props.controlBoth ? 'Replay seed' : battle.result === 'win' ? 'Collect XP →' : 'View result →'}</button></div>}
    {props.controlBoth && <aside className="lab-diagnostics" aria-label="Battle Lab diagnostics"><div className="lab-diagnostics-head"><b>Damage lab</b><button onClick={props.onLabReset}>Replay seed {props.labSeed}</button></div>
      <p>{battle.units.map(unit => `${unit.side === 'player' ? 'Ally' : 'Opponent'} ${unit.name}: ${unit.hp}/${unit.maxHp} HP`).join(' · ')}</p>
      <p>{current ? `${current.name} acting · ${current.ap} AP` : 'Battle ended'} · {battle.weather}</p>
      {move && labTarget && <p>{move.name} → {labTarget.name}: {labAbsorption ? `Absorbed by ${labTarget.ability} · 0 HP damage` : labDamage ? `${labDamage.min}–${labDamage.max} HP (${labDamage.type}×); critical ${labDamage.critMin}–${labDamage.critMax} HP · 1/24 critical chance` : 'Status move · no direct damage'}</p>}
      <details open><summary>Combat log</summary>{battle.log.map((entry, index) => <p key={index}>{entry}</p>)}</details>
    </aside>}
    {!props.controlBoth && <details className="battle-log"><summary>Action log</summary>{battle.log.slice(0, 8).map((entry, index) => <p key={index}>{entry}</p>)}</details>}
    <aside className="camera-hud" aria-label="Map camera controls">
      <button className="minimap" title="Click to focus the map" aria-label="Map overview; click to focus" onClick={event => {
        if (!event.detail) { issueCamera('center'); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        const world = isoWorldSize(battle.map), scale = Math.min(160 / world.width, 160 / world.height);
        const offsetX = (160 - world.width * scale) / 2, offsetY = (160 - world.height * scale) / 2;
        const worldX = ((event.clientX - rect.left) / rect.width * 160 - offsetX) / scale;
        const worldY = ((event.clientY - rect.top) / rect.height * 160 - offsetY) / scale;
        const point = isoGridAtWorld(battle.map, worldX, worldY);
        if (point) issueCamera('focus', point);
      }}><canvas ref={minimapRef} width="160" height="160" /></button>
      <div className="camera-buttons"><button onClick={() => issueCamera('zoom-in')} aria-label="Zoom in">+</button><button onClick={() => issueCamera('zoom-out')} aria-label="Zoom out">−</button><button onClick={() => issueCamera('fit')}>Fit map</button><button onClick={() => issueCamera('center')}>Center active</button></div>
    </aside>
    <div className="battle-help">{mode === 'attack' && chosenMove ? 'Blue: range · green: strong · orange: resisted · gray: immune' : 'Drag map to pan · scroll to zoom · click tiles to act'}</div>
  </main>;
}
