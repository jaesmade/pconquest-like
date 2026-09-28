import { useEffect, useMemo, useRef, useState } from 'react';
import Board from '../battle/Board';
import type { BoardView, CameraCommand } from '../battle/Board';
import { ISO_HALF_HEIGHT, ISO_HALF_WIDTH, isoGridAtWorld, isoTileCenter, isoWorldSize } from '../battle/isometric';
import { abilityAbsorption, itemBlocksMove, itemFor, itemSpecial, mapHeight, mapWidth, MOVES, SPECIES } from '../content/data';
import { active, apGain, upcoming, unitAt } from '../game/engine';
import { reachable } from '../game/grid';
import { damageRange } from '../game/damage';
import type { Battle, Run, StatStages, Unit } from '../game/types';
import Sprite from './Sprite';

type Mode = 'inspect' | 'move' | 'attack';
type Props = {
  run: Run; battle: Battle; mode: Mode; chosenMove: string; target?: [number, number]; notice: string; paused: boolean;
  controlBoth?: boolean; labSeed?: number; onLabReset?: () => void;
  onTile: (x: number, y: number) => void; onHoverTile: (x: number, y: number) => void; onAnimationState: (playing: boolean) => void;
  onMode: (mode: Mode) => void; onChooseMove: (id: string) => void;
  onSpecial: () => void; onPass: () => void; onComplete: () => void; onPause: () => void;
};

const statLabels: Record<string, string> = { attack: 'Attack', defense: 'Defense', specialAttack: 'Sp. Atk', specialDefense: 'Sp. Def' };
function StatusIcons({ unit, time }: { unit: Unit; time: number }) {
  const statuses = Object.entries(unit.status).filter(([key, until]) => key === 'flashFire' ? !!until : until >= time)
    .map(([key]) => ({ key, label: key, icon: key === 'burned' ? 'status-burned' : key === 'paralyzed' ? 'status-paralyzed' : 'status-charged' }));
  const stages = Object.entries(unit.stages).filter(([key, value]) => value !== 0 && unit.stageUntil[key as keyof StatStages] > time)
    .map(([key, value]) => ({ key, label: `${statLabels[key]} ${value > 0 ? '+' : ''}${value} · ${Math.ceil((unit.stageUntil[key as keyof StatStages] - time) / 100)} rounds left`, icon: value > 0 ? 'stage-buff' : 'stage-debuff' }));
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
  const [panelStep, setPanelStep] = useState<'main' | 'special' | 'end-confirm'>('main');
  const [hoveredMove, setHoveredMove] = useState<string>();
  const [moveTooltip, setMoveTooltip] = useState({ left: 12, top: 120 });
  const [anchor, setAnchor] = useState({ left: 20, top: 150 });
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
    setPanelStep('main');
    setHoveredMove(undefined);
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
    const width = popupRef.current?.offsetWidth ?? 246, height = popupRef.current?.offsetHeight ?? 220;
    const margin = 12;
    const topHud = stage.querySelector<HTMLElement>('.battle-top-hud');
    const safeTop = Math.max(margin, (topHud?.getBoundingClientRect().bottom ?? area.top + 84) - area.top + 8);
    const safeBottom = 100;
    const maxTop = Math.max(safeTop, area.height - safeBottom - height);
    const preferredTop = y - height - 16;
    const left = Math.max(margin, Math.min(Math.max(margin, area.width - margin - width), x - width / 2));
    const top = Math.max(safeTop, Math.min(maxTop, preferredTop));
    setAnchor(previous => Math.abs(previous.left - left) < 1 && Math.abs(previous.top - top) < 1
      ? previous : { left, top });
  };
  const showMoveTooltip = (id: string, button: HTMLButtonElement) => {
    const stage = stageRef.current, popup = popupRef.current;
    if (!stage || !popup) return;
    const area = stage.getBoundingClientRect(), menu = popup.getBoundingClientRect();
    const width = Math.min(280, area.width - 24), height = 170, gap = 10, margin = 12;
    const right = menu.right - area.left + gap, left = menu.left - area.left - width - gap;
    const beside = right + width <= area.width - margin || left >= margin;
    const tooltipLeft = right + width <= area.width - margin ? right : left >= margin ? left
      : Math.max(margin, Math.min(area.width - margin - width, button.getBoundingClientRect().left - area.left));
    const below = menu.bottom - area.top + gap, above = menu.top - area.top - height - gap;
    const preferredTop = beside ? button.getBoundingClientRect().top - area.top
      : below + height <= area.height - margin ? below : above >= margin ? above : below;
    const tooltipTop = Math.max(margin, Math.min(Math.max(margin, area.height - margin - height), preferredTop));
    setMoveTooltip({ left: tooltipLeft, top: tooltipTop });
    setHoveredMove(id);
  };
  useEffect(() => { setOpen(true); setInspected(undefined); setPanelStep('main'); setHoveredMove(undefined); }, [current?.id, battle.round]);
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
  }, [battle.map, current?.id, current?.x, current?.y, mode, open, panelStep, chosenMove]);
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
          const object = battle.map.tiles[y][x].object;
          if (object === 'tree' || object === 'rock') {
            context.fillStyle = object === 'tree' ? '#204a32' : '#a8ada0';
            context.fillRect(px - 2, py - 2, 4, 4);
          }
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
      if (panelStep !== 'main') setPanelStep('main');
      else if (mode === 'attack' && chosenMove) props.onMode('attack');
      else if (mode !== 'inspect') props.onMode('inspect');
      else if (inspected) { setInspected(undefined); setOpen(true); }
      else if (open) closePopup();
      else props.onPause();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, chosenMove, panelStep, open, inspected, props.paused, current?.id, props.onMode, props.onPause]);
  useEffect(() => {
    if (!open || (current?.side !== 'player' && !props.controlBoth) || props.paused) return;
    const frame = requestAnimationFrame(() => popupRef.current?.querySelector<HTMLButtonElement>('[data-popup-focus]')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, mode, panelStep, chosenMove, current?.id, props.paused]);
  const tile = (x: number, y: number) => {
    if (props.paused) return;
    if (mode === 'inspect') {
      const actor = !!current && x === current.x && y === current.y;
      setPanelStep('main');
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
  const moveReasonFor = (id: string) => current?.attackedThisTurn ? 'Attack used'
    : current && itemBlocksMove(current, MOVES[id]) ? 'Blocked by Assault Vest'
    : !current || current.ap < MOVES[id].apCost ? `Needs ${MOVES[id].apCost} AP` : '';
  const animationState = (playing: boolean) => {
    setVisualBusy(playing);
    props.onAnimationState(playing);
    if (!playing && visualBusy && (current?.side === 'player' || props.controlBoth) && current && current.ap > 0) setOpen(true);
  };
  const chooseMode = (next: Mode) => { setInspected(undefined); setPanelStep('main'); setHoveredMove(undefined); props.onMode(next); };
  const back = () => {
    if (panelStep !== 'main') setPanelStep('main');
    else chooseMode(mode === 'attack' && chosenMove ? 'attack' : 'inspect');
  };
  const moveButton = (index: number) => {
    const id = current?.moves[index];
    if (!id) return null;
    const reason = moveReasonFor(id), moveData = MOVES[id];
    return <button type="button" className={`move-position-${['top', 'left', 'right', 'bottom'][index]}`}
      data-popup-focus={current.moves.find(candidate => !moveReasonFor(candidate)) === id || undefined}
      disabled={!!reason || visualBusy} title={reason || moveData.detail}
      onMouseEnter={event => showMoveTooltip(id, event.currentTarget)}
      onMouseLeave={() => setHoveredMove(previous => previous === id ? undefined : previous)}
      onFocus={event => showMoveTooltip(id, event.currentTarget)}
      onBlur={() => setHoveredMove(previous => previous === id ? undefined : previous)}
      onClick={() => props.onChooseMove(id)}>{moveData.name}</button>;
  };

  return <main className="battle-stage" ref={stageRef}>
    <div className="battle-map-frame"><Board key={battle.map.id} battle={battle} mode={mode} controlBoth={props.controlBoth} chosenMove={chosenMove} target={target} moveRoutes={routes} onTile={tile} onHover={props.onHoverTile} onAnimationState={animationState} onViewChange={onViewChange} cameraAction={cameraAction} /></div>
    <header className="battle-top-hud">
      <div className="battle-location"><span className="eyebrow">{props.controlBoth ? 'BATTLE LAB' : `COLUMN ${run.encounter + 1}`} · ROUND {battle.round}</span><strong>{battle.map.name}</strong><small>{battle.objective === 'defeat-and-capture' ? 'Defeat foes and hold capture point' : 'Defeat the opposing team'} · {battle.weather}</small></div>
      <div className="turn-strip" aria-label="Turn order">{upcoming(battle).slice(0, 6).map((unit, index) =>
        <div key={`${unit.id}-${index}`} className={`turn-portrait ${unit.side} ${index === 0 ? 'now' : ''}`} title={index === 0 ? `${unit.name} · ${unit.ap} AP now` : `${unit.name} · ${unit.ap} AP banked · +${apGain(unit, battle)} next turn`}>
          <Sprite id={unit.species} /><span>{unit.name}</span>
        </div>)}</div>
      <button className="battle-pause" onClick={props.onPause}>{props.controlBoth ? '⚙ Setup' : '☰ Menu'}</button>
    </header>
    {current && !battle.result && <div className="battle-actor-hud"><Sprite id={current.species} /><div><b>{current.name}</b><span>{current.hp}/{current.maxHp} HP · {current.ap} AP</span><StatusIcons unit={current} time={battle.time} /></div>{playerTurn && <button ref={actorToggleRef} onClick={() => { setInspected(undefined); setPanelStep('main'); setOpen(value => !value); }} aria-label={open ? 'Hide actions' : 'Show actions'}>{open ? '×' : 'Actions'}</button>}</div>}
    {!playerTurn && !battle.result && <div className="opponent-turn">Opponent acting…</div>}
    {playerTurn && open && <section ref={popupRef} className={`action-popup glass-action-menu ${mode !== 'inspect' || panelStep !== 'main' ? 'submenu' : ''} ${mode === 'attack' && !chosenMove ? 'choosing-move' : ''} ${(mode === 'move' || mode === 'attack' && chosenMove) && !notice ? 'targeting' : ''}`} style={{ left: anchor.left, top: anchor.top }} aria-label={`${current.name} actions`} aria-busy={visualBusy}>
      {mode === 'inspect' && panelStep === 'main' && <div className="action-command-list">
        <button type="button" data-popup-focus={!attackReason || undefined} disabled={!!attackReason || visualBusy} title={attackReason || 'Choose one equipped move'} onClick={() => chooseMode('attack')}>Attack</button>
        <button type="button" data-popup-focus={!!attackReason && !moveReason || undefined} disabled={!!moveReason || visualBusy} title={moveReason || 'Choose a reachable tile'} onClick={() => chooseMode('move')}>Move</button>
        <button type="button" data-popup-focus={!!attackReason && !!moveReason && !specialReason || undefined} disabled={!!specialReason || visualBusy} title={specialReason || held?.description} onClick={() => setPanelStep('special')}>Special</button>
        <button type="button" data-popup-focus={!!attackReason && !!moveReason && !!specialReason || undefined} disabled={visualBusy} onClick={() => setPanelStep('end-confirm')}>End</button>
      </div>}
      {mode === 'inspect' && panelStep === 'end-confirm' && <div className="action-end-confirm">
        <p>End {current.name}'s turn and bank {current.ap} AP?</p>
        <button type="button" disabled={visualBusy} onClick={() => { setPanelStep('main'); props.onPass(); }}>Yes</button>
        <button type="button" data-popup-focus disabled={visualBusy} onClick={() => setPanelStep('main')}>No</button>
      </div>}
      {mode === 'inspect' && panelStep === 'special' && <div className="action-special-choice">
        <button type="button" className="menu-back" data-popup-focus disabled={visualBusy} onClick={back} aria-label="Back to actions">‹</button>
        <button type="button" disabled={!!specialReason || visualBusy} title={specialReason || `${current.item} · ${held?.special?.apCost} AP · ${held?.description ?? ''}`} onClick={() => { setPanelStep('main'); props.onSpecial(); }}>Use Item</button>
      </div>}
      {mode !== 'inspect' && <>
        {mode === 'attack' && !chosenMove && <div className="action-move-choice">
          <div className="moves move-cross">
            {moveButton(0)}{moveButton(1)}
            <button type="button" className="menu-back move-center" disabled={visualBusy} onClick={back} aria-label="Back to actions">‹</button>
            {moveButton(2)}{moveButton(3)}
          </div>
        </div>}
        {mode === 'attack' && chosenMove && <div className="action-target-choice">
          <button type="button" className="menu-back" data-popup-focus disabled={visualBusy} onClick={back} aria-label="Back to move selection">‹</button>
        </div>}
        {mode === 'move' && <div className="action-target-choice">
          <button type="button" className="menu-back" data-popup-focus disabled={visualBusy} onClick={back} aria-label="Back to actions">‹</button>
        </div>}
      </>}
      {notice && <p className="notice" role="status">{notice}</p>}
    </section>}
    {playerTurn && open && mode === 'attack' && !chosenMove && hoveredMove && <aside className="battle-move-tooltip" style={{ left: moveTooltip.left, top: moveTooltip.top }} role="status">
      <b>{MOVES[hoveredMove].name}</b><p>{MOVES[hoveredMove].detail}</p><small>{MOVES[hoveredMove].type} · {MOVES[hoveredMove].category} · Power {MOVES[hoveredMove].power} · Range {MOVES[hoveredMove].range} · {MOVES[hoveredMove].apCost} AP</small>
    </aside>}
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
    <div className="battle-help">{mode === 'attack' ? chosenMove ? 'Click a target to attack · blue: range · green: strong · orange: resisted · gray: immune' : 'Choose a move from the action menu' : mode === 'move' ? selectedRoute ? `Click to move · ${selectedRoute.cost} AP · ${(current?.ap ?? 0) - selectedRoute.cost} AP left` : 'Click a green tile to move · drag to pan · scroll to zoom' : 'Drag map to pan · scroll to zoom · click tiles to inspect'}</div>
  </main>;
}
