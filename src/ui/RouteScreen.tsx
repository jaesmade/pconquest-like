import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { itemCanEquip, itemFor, ITEMS, MOVES, SPECIES, tmMoveFor } from '../content/data';
import type { ItemId } from '../content/items';
import { MAX_RUN_POKEMON } from '../content/roster';
import { statsAtLevel } from '../game/engine';
import { availableRouteNodes, routeNode, ROUTE_COLUMNS, type RouteNode, type RouteNodeKind } from '../game/route';
import type { PartyMon, Run } from '../game/types';
import Sprite from './Sprite';

function RoutePyramid({ x, y }: { x: number; y: number }) {
  return <g className="route-player" transform={`translate(${x} ${y})`} role="img" aria-label="Current route position">
    <title>Current route position</title>
    <g className="route-player-bob">
      <path className="route-player-pyramid-outline" d="M0-46 40-23 0 38-40-23Z" />
      <path className="route-player-pyramid-left" d="M-40-23 0-1 0 38Z" />
      <path className="route-player-pyramid-right" d="M0-1 40-23 0 38Z" />
      <path className="route-player-pyramid-top" d="M0-46 40-23 0-1-40-23Z" />
      <path className="route-player-pyramid-glint" d="M0-40 29-23 0-7-29-23Z" />
    </g>
  </g>;
}

const names: Record<RouteNodeKind, string> = {
  battle: 'Battle', elite: 'Elite battle', heal: 'Healing', store: 'Store', special: 'Special encounter', recruit: 'Recruitment', boss: 'Boss',
};
const descriptions: Record<RouteNodeKind, string> = {
  battle: 'Win a standard battle for XP and coins.',
  elite: 'Face stronger opponents for a larger reward.',
  heal: 'Restore HP and revive your whole roster.',
  store: 'Spend coins on items for your party.',
  special: 'A 75% chance of a reward and a 25% chance of a setback.',
  recruit: 'Choose one of three Pokémon to join your roster.',
  boss: 'Defeat the final opponent to clear the layer.',
};
const VIEW_WIDTH = 1050;
const VIEW_HEIGHT = 4860;
const START_X = 525;
const START_Y = 3835;
const xOf = (node: RouteNode) => 180 + node.lane * 230;
const yOf = (node: RouteNode) => 3510 - (node.column - 1) * 340;

type DragGesture = { pointerId: number; startY: number; scrollTop: number; active: boolean };

function Glyph({ kind }: { kind: RouteNodeKind }) {
  if (kind === 'heal') return <path d="M-9-29h18v20h20V9H9v20H-9V9h-20V-9h20z" />;
  if (kind === 'special') return <text textAnchor="middle" dominantBaseline="central" fontSize="66" fontWeight="900">?</text>;
  if (kind === 'recruit') return <g><circle cx="-21" cy="-11" r="8" /><circle cx="0" cy="-18" r="9" /><circle cx="21" cy="-11" r="8" /><path d="M-35 12q0-15 14-15t14 15v6h-28zM-17 12q0-18 17-18t17 18v8h-34zM7 12q0-15 14-15t14 15v6H7z" /></g>;
  if (kind === 'store') return <g fill="none" strokeWidth="6" strokeLinejoin="miter" strokeLinecap="square"><path d="M-30-23h9l7 34h34l7-25h-42M-9-3h31M-14 12h38" /><circle cx="-5" cy="23" r="4" /><circle cx="19" cy="23" r="4" /></g>;
  if (kind === 'boss') return <g><path d="M0-30l23 7 10 16-7 23-11 2-4 12-11-9-11 9-4-12-11-2-7-23 10-16z" /><path className="route-glyph-cutout" d="M-20-1l14 4-8 9zM20-1L6 3l8 9z" /></g>;
  if (kind === 'elite') return <g className="route-elite-spark"><path d="M0-37 8-10 36 0 8 9 0 35-8 9-36 0-8-10Z" /><path d="M-29-25v13m-6-6h13M29 17v13m-6-6h13" /><path className="route-spark-shine" d="M0-23 4-6 21 0 4 5 0 22-4 5-21 0-4-6Z" /></g>;
  return <g className="route-sword"><path d="M-38-5h9v-5h6v5h8v-8h6v8h27L37 0 18 5H-9v8h-6V5h-8v5h-6V5h-9z" /><path className="route-sword-line" d="M-11 0h37" /><path className="route-sword-glint" d="M-30-1h7m8-5h6" /></g>;
}

function TileLayers() {
  return <g className="route-tile-art" transform="scale(1.4)">
    <path className="route-node-shadow" d="M0 28 64-4 64 3 0 35-64 3-64-4Z" />
    <path className="route-node-side" d="M-64-20 0 12 64-20 64-3 0 29-64-3Z" />
    <path className="route-node-side-shade" d="M0 12 64-20 64-3 0 29Z" />
    <path className="route-node-side-highlight" d="M-64-14 0 18 64-14 64-11 0 21-64-11Z" />
    <path className="route-node-rim" d="M0-52 64-20 64-14 0 18-64-14-64-20Z" />
    <path className="route-node-top" d="M0-50 62-20 0 11-62-20Z" />
    <path className="route-node-top-light" d="M-56-20 0-47 56-20" />
    <path className="route-node-inset" d="M0-45 52-20 0 6-52-20Z" />
    <path className="route-node-bevel" d="M0-45 52-20 0-37-52-20Z" />
    <path className="route-node-inset-shade" d="M52-20 0 6-52-20-44-20 0-2 44-20Z" />
    <path className="route-node-texture" d="M0-45 52-20 0 6-52-20Z" />
    <path className="route-node-inlay" d="M0-41 45-20 0 2-45-20Z" />
  </g>;
}

function PartyEmblem() {
  return <svg className="route-party-emblem" viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path d="M20 3h24v4h8v8h5v8h4v18h-4v8h-5v8h-8v4H20v-4h-8v-8H7v-8H3V23h4v-8h5V7h8Z" fill="#081f2b" />
    <path d="M20 9h24v4h8v9h4v19h-4v9h-8v5H20v-5h-8v-9H8V22h4v-9h8Z" fill="#fff9e8" />
    <path d="M20 9h24v4h8v9h4v8H8v-8h4v-9h8Z" fill="#e35360" />
    <path d="M20 9h24v4H20ZM12 17h8v5h-8Z" fill="#ff9a88" />
    <path d="M8 29h48v7H8Z" fill="#081f2b" />
    <path d="M23 23h18v18H23Z" fill="#081f2b" />
    <path d="M27 27h10v10H27Z" fill="#fff9e8" />
    <path d="M30 30h4v4h-4Z" fill="#59c8cc" />
  </svg>;
}

function BagEmblem() {
  return <svg className="route-bag-emblem" viewBox="0 0 64 64" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path d="M17 7h30v6h5v10h5v32h-5v5H12v-5H7V23h5V13h5Z" fill="#102631" />
    <path d="M18 13h28v8H18Z" fill="#eab95f" />
    <path d="M13 25h38v28H13Z" fill="#bd734d" />
    <path d="M13 25h38v7H13Z" fill="#f4c777" />
    <path d="M19 33h26v20H19Z" fill="#df9860" />
    <path d="M27 21h10v19H27Z" fill="#102631" />
    <path d="M29 23h6v12h-6Z" fill="#fff0bd" />
    <path d="M24 40h16v10H24Z" fill="#a45d43" />
    <path d="M28 43h8v4h-8Z" fill="#f5ce75" />
  </svg>;
}

const itemIcon = (item: string) => `/assets/ui/icons/item-${item.toLowerCase().replaceAll(' ', '-')}.svg`;

function BagItemCard({ item, count, party, onTeachTm }: { item: ItemId; count: number; party: PartyMon[]; onTeachTm: (item: ItemId, monId: string, replaceSlot?: number) => void }) {
  const [monId, setMonId] = useState('');
  const [slot, setSlot] = useState('');
  const moveId = tmMoveFor(item);
  const eligible = moveId ? party.filter(mon => SPECIES[mon.species].tmMoves?.includes(moveId) && !mon.equipped.includes(moveId)) : [];
  const chosen = eligible.find(mon => mon.id === monId);
  return <article className="route-inventory-item" key={item}>
    <img src={itemIcon(item)} alt="" /><div><strong>{item}</strong><p>{itemFor(item)?.description}</p></div><span aria-label={`${count} available`}>×{count}</span>
    {moveId && <div className="route-tm-teach">
      <label>Teach to
        <select value={monId} onChange={event => { setMonId(event.target.value); setSlot(''); }} aria-label={`${item} recipient`}>
          <option value="">Choose Pokémon</option>
          {eligible.map(mon => <option key={mon.id} value={mon.id}>{SPECIES[mon.species].name} · Lv {mon.level}</option>)}
        </select>
      </label>
      {chosen && chosen.equipped.length >= 4 && <label>Replace move
        <select value={slot} onChange={event => setSlot(event.target.value)} aria-label={`${item} move to replace`}>
          <option value="">Choose move</option>
          {chosen.equipped.map((id, index) => <option key={`${index}-${id}`} value={index}>{MOVES[id]?.name ?? id}</option>)}
        </select>
      </label>}
      <button type="button" disabled={!chosen || (chosen.equipped.length >= 4 && slot === '')}
        onClick={() => { if (chosen) onTeachTm(item, chosen.id, slot === '' ? undefined : Number(slot)); }}>Use TM</button>
      {!eligible.length && <small>No compatible Pokémon needs this move.</small>}
    </div>}
  </article>;
}

type Props = {
  run: Run;
  onChoose: (id: string) => void;
  onBack: () => void;
  onEquipItem: (monId: string, item: string) => void;
  onEvolve: (id: string) => void;
  onTeachTm: (item: ItemId, monId: string, replaceSlot?: number) => void;
  backdropOnly?: boolean;
};

export default function RouteScreen({ run, onChoose, onBack, onEquipItem, onEvolve, onTeachTm, backdropOnly = false }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const partyButton = useRef<HTMLButtonElement>(null);
  const inventoryButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<DragGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const [openPanel, setOpenPanel] = useState<'party' | 'inventory' | null>(null);
  const [inspectedNodeId, setInspectedNodeId] = useState<string>();
  const available = new Set(availableRouteNodes(run.route).map(node => node.id));
  const visited = new Set(run.route.visited);
  const currentNode = routeNode(run.route, run.route.visited.at(-1));
  const markerX = currentNode ? xOf(currentNode) : START_X;
  const markerY = (currentNode ? yOf(currentNode) : START_Y) - 72;
  const inspectedNode = routeNode(run.route, inspectedNodeId) ?? availableRouteNodes(run.route)[0];
  const inspectedStatus = inspectedNode && (available.has(inspectedNode.id) ? 'AVAILABLE' : visited.has(inspectedNode.id) ? 'CLEARED' : 'AHEAD');
  const nextColumn = Math.min(ROUTE_COLUMNS, run.route.visited.length + 1);
  const bagItems = ITEMS.filter(item => item !== 'None' && run.bag.includes(item)).map(item => ({ item, count: run.bag.filter(owned => owned === item).length }));
  const tmBagItems = bagItems.filter(({ item }) => !!tmMoveFor(item));
  const heldBagItems = bagItems.filter(({ item }) => !tmMoveFor(item));
  const equippedItems = run.party.filter(mon => mon.item !== 'None');
  const pan = (direction: -1 | 1) => scroll.current?.scrollBy({ top: direction * Math.max(300, scroll.current.clientHeight * .72), behavior: 'smooth' });
  const closePanel = () => {
    const returnFocus = openPanel === 'party' ? partyButton : inventoryButton;
    setOpenPanel(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  };

  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    const focusY = currentNode ? yOf(currentNode) : START_Y;
    const placeFocus = () => {
      const map = viewport.querySelector('svg');
      const scale = map ? map.clientWidth / VIEW_WIDTH : 1;
      const anchor = viewport.clientWidth < 600 ? .65 : .83;
      viewport.scrollTop = Math.max(0, focusY * scale - viewport.clientHeight * anchor);
    };
    placeFocus();
    const resize = new ResizeObserver(placeFocus);
    resize.observe(viewport);
    window.addEventListener('resize', placeFocus);
    return () => { resize.disconnect(); window.removeEventListener('resize', placeFocus); };
  }, [run.route.visited.length, currentNode]);
  useEffect(() => {
    if (!openPanel) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') closePanel(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [openPanel]);

  const onMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch') return;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      scrollTop: event.currentTarget.scrollTop,
      active: false,
    };
  };
  const onMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientY - gesture.startY;
    if (!gesture.active && Math.abs(distance) > 7) {
      gesture.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add('dragging');
    }
    if (gesture.active) {
      event.preventDefault();
      event.currentTarget.scrollTop = gesture.scrollTop - distance;
    }
  };
  const endMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.active) {
      suppressClickUntil.current = performance.now() + 250;
      event.currentTarget.classList.remove('dragging');
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
  };
  return <main className={`route-screen${backdropOnly ? ' route-screen-backdrop' : ''}`} aria-hidden={backdropOnly}>
    <header className="route-heading">
      <span>LAYER 1 · THE CAVERNS</span>
      <strong>Choose a Route</strong>
      <small>Column {Math.min(run.encounter + 1, ROUTE_COLUMNS)} / {ROUTE_COLUMNS}</small>
    </header>

    {!backdropOnly && <aside className="route-hud" aria-label="Route status">
      <div className="route-coins" aria-label={`${run.coins} coins`}><i aria-hidden="true" /><b>{run.coins}</b><span>COINS</span></div>
      <button className="route-party-button" ref={partyButton} type="button" aria-label={`Open travelling team, ${run.party.length} of ${MAX_RUN_POKEMON} Pokémon owned`} aria-expanded={openPanel === 'party'} onClick={() => setOpenPanel('party')}>
        <PartyEmblem /><b>Party</b><small>{run.party.length} / {MAX_RUN_POKEMON}</small>
      </button>
      <button className="route-inventory-button" ref={inventoryButton} type="button" aria-label={`Open inventory, ${run.bag.length} items in bag`} aria-expanded={openPanel === 'inventory'} onClick={() => setOpenPanel('inventory')}>
        <BagEmblem /><b>Bag</b><small>{run.bag.length}</small>
      </button>
    </aside>}
    {!backdropOnly && <button className="route-back-button" type="button" aria-label="Return to title screen" onClick={onBack}>&lt;</button>}
    {!backdropOnly && <aside className="route-guide" aria-label="Route guide">
      <div className="route-guide-heading"><span>NEXT STOP</span><b>{String(nextColumn).padStart(2, '0')} <small>/ {ROUTE_COLUMNS}</small></b></div>
      <div className="route-guide-track" aria-label={`${run.route.visited.length} of ${ROUTE_COLUMNS} columns cleared`}>
        {Array.from({ length: ROUTE_COLUMNS }, (_, index) => <i key={index} className={index < run.route.visited.length ? 'cleared' : index === run.route.visited.length ? 'next' : ''} />)}
      </div>
      {inspectedNode && <div className="route-guide-detail" aria-live="polite"><strong>{names[inspectedNode.kind]}</strong><span>{inspectedStatus} · COLUMN {inspectedNode.column}</span><p>{descriptions[inspectedNode.kind]}</p></div>}
      <div className="route-guide-controls"><button type="button" onClick={() => pan(-1)} aria-label="Pan route up toward boss">↑</button><span>CLIMB TO THE BOSS</span><button type="button" onClick={() => pan(1)} aria-label="Pan route down toward start">↓</button></div>
    </aside>}

    <div className="route-map-scroll" ref={scroll} aria-label="Ten-column route map. Scroll or drag upward from the start to the boss."
      onPointerDown={onMapPointerDown} onPointerMove={onMapPointerMove} onPointerUp={endMapDrag}
      onPointerCancel={endMapDrag} onLostPointerCapture={endMapDrag}
      onClickCapture={event => {
        if (performance.now() < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDragStart={event => event.preventDefault()}>
      <svg className="route-map" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="xMidYMin meet" aria-label="Vertical branching route climbing from column one at the bottom to the boss in column ten at the top">
        <defs>
          <filter id="route-cyan-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10" result="blur" /><feFlood floodColor="#70f4ff" floodOpacity=".95" /><feComposite in2="blur" operator="in" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <pattern id="route-stone-grain" width="18" height="16" patternUnits="userSpaceOnUse"><path fill="#fff1c2" opacity=".32" d="M2 2h5v2H2zM12 11h4v2h-4z" /><path fill="#483018" opacity=".27" d="M9 5h4v2H9zM1 12h3v2H1z" /></pattern>
        </defs>
        <line className="route-start-link" x1={START_X} y1={START_Y - 28} x2={xOf(run.route.nodes[0])} y2={yOf(run.route.nodes[0]) - 28} />
        <g className="route-links">{run.route.links.map(link => {
          const from = routeNode(run.route, link.from)!, to = routeNode(run.route, link.to)!;
          const connected = visited.has(from.id) && visited.has(to.id);
          const reachable = visited.has(from.id) && available.has(to.id);
          return <line key={`${from.id}-${to.id}`} x1={xOf(from)} y1={yOf(from) - 28} x2={xOf(to)} y2={yOf(to) - 28} className={connected ? 'cleared' : reachable ? 'reachable' : ''} />;
        })}</g>
        <g className="route-start" transform={`translate(${START_X} ${START_Y})`}><TileLayers /></g>
        {run.route.nodes.map(node => {
          const isAvailable = available.has(node.id), isVisited = visited.has(node.id), isCurrent = currentNode?.id === node.id;
          return <g key={node.id} className={`route-node ${node.kind}${isAvailable ? ' available' : ''}${isVisited ? ' visited' : ''}${isCurrent ? ' current' : ''}`} transform={`translate(${xOf(node)} ${yOf(node)})`}
            role={backdropOnly ? undefined : 'button'} tabIndex={backdropOnly ? -1 : isAvailable ? 0 : -1} aria-disabled={!isAvailable}
            aria-label={`Column ${node.column}: ${names[node.kind]}${isAvailable ? ', available' : isVisited ? ', completed' : ', locked'}`}
            onPointerEnter={() => setInspectedNodeId(node.id)} onPointerLeave={() => setInspectedNodeId(undefined)}
            onFocus={() => setInspectedNodeId(node.id)} onBlur={() => setInspectedNodeId(undefined)}
            onClick={() => { if (!backdropOnly && isAvailable) onChoose(node.id); }} onKeyDown={event => { if (!backdropOnly && isAvailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onChoose(node.id); } }}>
            <title>{names[node.kind]} · column {node.column}</title>
            <TileLayers />
            {!isCurrent && <g className="route-glyph" transform="translate(0 -26) scale(.9 .68)"><Glyph kind={node.kind} /></g>}
            {isAvailable && <g className="route-choice-marker" transform="translate(0 -138)"><path d="M0 43-29-10 0-27 29-10Z" /><path className="route-choice-shine" d="M0-20-20-9 0 2 20-9Z" /></g>}
          </g>;
        })}
        <RoutePyramid x={markerX} y={markerY} />
      </svg>
    </div>
    {!backdropOnly && <p className="route-instruction"><span>◆</span> Select a glowing connected node <b>·</b> paths can branch into up to four choices</p>}

    {!backdropOnly && openPanel === 'inventory' && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-inventory-title" onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="route-party-panel route-inventory-panel">
        <div className="route-party-head">
          <div className="route-party-heading"><span className="route-party-heading-icon"><BagEmblem /></span><div><small>ROUTE · ITEMS</small><h2 id="route-inventory-title">Inventory</h2></div></div>
          <div className="route-party-head-actions"><button type="button" autoFocus aria-label="Close inventory" onClick={closePanel}>×</button></div>
        </div>
        <div className="route-inventory-summary"><span><b>{run.bag.length}</b> in bag</span><span><b>{equippedItems.length}</b> held by team</span><button type="button" onClick={() => setOpenPanel('party')}>Manage team →</button></div>
        {heldBagItems.length > 0 && <><h3>Held items</h3><div className="route-inventory-grid">{heldBagItems.map(({ item, count }) => <BagItemCard key={item} item={item} count={count} party={run.party} onTeachTm={onTeachTm} />)}</div></>}
        {tmBagItems.length > 0 && <><h3>Technical Machines</h3><p className="route-tm-help">Use a TM here to teach a compatible Pokémon. Choose which active move to replace; each TM is used once.</p><div className="route-inventory-grid">{tmBagItems.map(({ item, count }) => <BagItemCard key={item} item={item} count={count} party={run.party} onTeachTm={onTeachTm} />)}</div></>}
        {!bagItems.length && <p className="route-inventory-empty">Your bag is empty. Visit a Store node to buy items or TMs, or change a held item in Party to return it here.</p>}
        {equippedItems.length > 0 && <><h3>Held by team</h3><div className="route-inventory-equipped">{equippedItems.map(mon => <div key={mon.id}><img src={itemIcon(mon.item)} alt="" /><span><b>{mon.item}</b><small>{SPECIES[mon.species].name}</small></span></div>)}</div></>}
      </div>
    </section>}

    {!backdropOnly && openPanel === 'party' && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-party-title" onMouseDown={event => { if (event.target === event.currentTarget) closePanel(); }}>
      <div className="route-party-panel">
        <div className="route-party-head">
          <div className="route-party-heading"><span className="route-party-heading-icon"><PartyEmblem /></span><div><small>ROUTE · TEAM MANAGEMENT</small><h2 id="route-party-title">Travelling Team</h2></div></div>
          <div className="route-party-head-actions"><div className="route-party-owned"><b>{run.party.length}</b><span>/ {MAX_RUN_POKEMON} OWNED</span></div><button type="button" autoFocus aria-label="Close travelling team" onClick={closePanel}>×</button></div>
        </div>
        <div className="route-party-intro"><p>Review active moves, manage held items and evolve here. New moves are chosen at level-up or taught from a TM in the Bag.</p><span>{run.party.filter(mon => mon.hp > 0).length} ready</span><span>{run.bag.length} in bag</span></div>
        <div className="route-party-grid">{run.party.map(mon => {
          const species = SPECIES[mon.species], maxHp = statsAtLevel(mon.species, mon.level)[0];
          const evolution = species.evolves && mon.level >= species.evolves.level ? species.evolves : undefined;
          const availableItems = [mon.item, ...ITEMS.filter(item => (item === 'None' || run.bag.includes(item)) && itemCanEquip(item, mon.species))]
            .filter((item, index, all) => all.indexOf(item) === index);
          return <article className={`route-party-card${mon.hp <= 0 ? ' fainted' : ''}`} data-type={species.types[0].toLowerCase()} key={mon.id}>
            <div className="route-party-card-top"><div className="route-party-portrait"><Sprite id={mon.species} /></div>
              <div className="route-party-card-main">
                <div className="route-party-name-row"><h3>{species.name}</h3><span>{mon.hp <= 0 ? 'FAINTED' : `Lv ${mon.level}`}</span></div>
                <div className="route-party-types">{species.types.map(type => <span key={type}>{type}</span>)}</div>
                <div className="route-party-hp-line"><span>HP</span><b>{mon.hp} / {maxHp}</b></div>
                <div className="route-party-health" role="progressbar" aria-label={`${species.name} HP`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={mon.hp}><i style={{ width: `${Math.max(0, Math.min(100, mon.hp / maxHp * 100))}%` }} /></div>
              </div>
            </div>
            <div className="route-party-facts"><div><span aria-hidden="true">✦</span><small>ABILITY</small><b>{species.ability}</b></div><div><span aria-hidden="true">▣</span><small>HELD ITEM</small><b>{mon.item}</b></div></div>
            <div className="route-party-moves"><span>EQUIPPED MOVES</span><ul>{mon.equipped.map((id, index) => <li key={`${index}-${id}`}>{MOVES[id]?.name ?? id}</li>)}</ul></div>
            <details className="route-party-manage"><summary><span>Manage Pokémon</span><span>{evolution ? 'Evolution ready' : 'Held item'}</span></summary>
              <div className="route-party-controls">
                <label className="route-party-item-control">Held item
                  <select aria-label={`${species.name} held item`} value={mon.item} onChange={event => onEquipItem(mon.id, event.target.value)}>
                    {availableItems.map(item => <option value={item} key={item}>{item}</option>)}
                  </select>
                </label>
                {evolution && <button type="button" className="route-evolve-button" onClick={() => onEvolve(mon.id)}>Evolve into {SPECIES[evolution.into].name}</button>}
              </div>
            </details>
          </article>;
        })}</div>
      </div>
    </section>}
  </main>;
}
