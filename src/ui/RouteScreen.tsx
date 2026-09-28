import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { itemCanEquip, ITEMS, MAX_EQUIPPED_MOVES, MOVES, SPECIES } from '../content/data';
import { statsAtLevel } from '../game/engine';
import { availableRouteNodes, routeNode, ROUTE_COLUMNS, type RouteNode, type RouteNodeKind } from '../game/route';
import type { Run } from '../game/types';
import Sprite from './Sprite';

const names: Record<RouteNodeKind, string> = {
  battle: 'Battle', elite: 'Elite battle', heal: 'Healing', store: 'Store', special: 'Special encounter', boss: 'Boss',
};
const VIEW_WIDTH = 4000;
const VIEW_HEIGHT = 900;
const START_X = 425;
const START_Y = 465;
const ROUTE_AVATAR = '/assets/ui/route-trainer-placeholder.svg';
const xOf = (node: RouteNode) => 760 + (node.column - 1) * 335;
const yOf = (node: RouteNode) => 180 + node.lane * 190;

type DragGesture = { pointerId: number; startX: number; scrollLeft: number; active: boolean };

function Glyph({ kind }: { kind: RouteNodeKind }) {
  if (kind === 'heal') return <path d="M-9-29h18v20h20V9H9v20H-9V9h-20V-9h20z" />;
  if (kind === 'special') return <text textAnchor="middle" dominantBaseline="central" fontSize="66" fontWeight="900">?</text>;
  if (kind === 'store') return <g fill="none" strokeWidth="6" strokeLinejoin="miter" strokeLinecap="square"><path d="M-30-23h9l7 34h34l7-25h-42M-9-3h31M-14 12h38" /><circle cx="-5" cy="23" r="4" /><circle cx="19" cy="23" r="4" /></g>;
  if (kind === 'boss') return <g><path d="M0-30l23 7 10 16-7 23-11 2-4 12-11-9-11 9-4-12-11-2-7-23 10-16z" /><path className="route-glyph-cutout" d="M-20-1l14 4-8 9zM20-1L6 3l8 9z" /></g>;
  if (kind === 'elite') return <g className="route-elite-spark"><path d="M0-37 8-10 36 0 8 9 0 35-8 9-36 0-8-10Z" /><path d="M-29-25v13m-6-6h13M29 17v13m-6-6h13" /><path className="route-spark-shine" d="M0-23 4-6 21 0 4 5 0 22-4 5-21 0-4-6Z" /></g>;
  return <g className="route-sword"><path d="M-38-5h9v-5h6v5h8v-8h6v8h27L37 0 18 5H-9v8h-6V5h-8v5h-6V5h-9z" /><path className="route-sword-line" d="M-11 0h37" /><path className="route-sword-glint" d="M-30-1h7m8-5h6" /></g>;
}

function TileLayers() {
  return <g className="route-tile-art" transform="scale(1.42)">
    <path className="route-node-shadow" d="M0 29 68-6 68 14 0 51-68 14-68-6Z" />
    <path className="route-node-side" d="M-68-25 0 10 68-25 68 6 0 42-68 6Z" />
    <path className="route-node-side-shade" d="M0 10 68-25 68 6 0 42Z" />
    <path className="route-node-side-highlight" d="M-68-10 0 25 68-10 68-4 0 31-68-4Z" />
    <path className="route-node-rim" d="M0-61 70-26 70-11 0 25-70-11-70-26Z" />
    <path className="route-node-top" d="M0-61 70-26 0 10-70-26Z" />
    <path className="route-node-top-light" d="M-62-26 0-57 62-26" />
    <path className="route-node-inset" d="M0-50 57-25 0 4-57-25Z" />
    <path className="route-node-bevel" d="M0-50 57-25 0-37-57-25Z" />
    <path className="route-node-inset-shade" d="M57-25 0 4-57-25-47-25 0-2 47-25Z" />
    <path className="route-node-texture" d="M0-50 57-25 0 4-57-25Z" />
    <path className="route-node-inlay" d="M0-46 51-25 0 0-51-25Z" />
  </g>;
}

type Props = {
  run: Run;
  onChoose: (id: string) => void;
  onBack: () => void;
  onEquipMove: (monId: string, moveId: string, slot: number) => void;
  onEquipItem: (monId: string, item: string) => void;
  onEvolve: (id: string) => void;
  backdropOnly?: boolean;
};

export default function RouteScreen({ run, onChoose, onBack, onEquipMove, onEquipItem, onEvolve, backdropOnly = false }: Props) {
  const scroll = useRef<HTMLDivElement>(null);
  const drag = useRef<DragGesture | null>(null);
  const suppressClickUntil = useRef(0);
  const [partyOpen, setPartyOpen] = useState(false);
  const available = new Set(availableRouteNodes(run.route).map(node => node.id));
  const visited = new Set(run.route.visited);
  const currentNode = routeNode(run.route, run.route.visited.at(-1));
  const avatarX = currentNode ? xOf(currentNode) : START_X;
  const avatarY = currentNode ? yOf(currentNode) - 48 : START_Y - 50;

  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    const focusX = currentNode ? xOf(currentNode) : START_X;
    const placeFocus = () => {
      const map = viewport.querySelector('svg');
      const scale = map ? Math.min(map.clientWidth / VIEW_WIDTH, map.clientHeight / VIEW_HEIGHT) : 1;
      const anchor = viewport.clientWidth < 600 ? .2 : .34;
      viewport.scrollLeft = Math.max(0, focusX * scale - viewport.clientWidth * anchor);
    };
    placeFocus();
    const resize = new ResizeObserver(placeFocus);
    resize.observe(viewport);
    window.addEventListener('resize', placeFocus);
    return () => { resize.disconnect(); window.removeEventListener('resize', placeFocus); };
  }, [run.route.visited.length, currentNode]);
  useEffect(() => {
    if (!partyOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPartyOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [partyOpen]);

  const onMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      active: false,
    };
  };
  const onMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientX - gesture.startX;
    if (!gesture.active && Math.abs(distance) > 7) {
      gesture.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add('dragging');
    }
    if (gesture.active) {
      event.preventDefault();
      event.currentTarget.scrollLeft = gesture.scrollLeft - distance;
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
      <div className="route-coins"><i aria-hidden="true" /><b>{run.coins}</b></div>
      <button className="route-party-button" type="button" aria-expanded={partyOpen} onClick={() => setPartyOpen(true)}>
        <span className="route-ball" aria-hidden="true"><i /></span><b>Party</b><small>{run.party.length}</small>
      </button>
    </aside>}
    {!backdropOnly && <button className="route-back-button" type="button" aria-label="Return to title screen" onClick={onBack}>&lt;</button>}

    <div className="route-map-scroll" ref={scroll} aria-label="Ten-column route map. Drag horizontally to view later nodes through the boss."
      onPointerDown={onMapPointerDown} onPointerMove={onMapPointerMove} onPointerUp={endMapDrag}
      onPointerCancel={endMapDrag} onLostPointerCapture={endMapDrag}
      onClickCapture={event => {
        if (performance.now() < suppressClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDragStart={event => event.preventDefault()}>
      <svg className="route-map" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="xMinYMid meet" aria-label="Branching route from column one to the boss in column ten">
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
            onClick={() => { if (!backdropOnly && isAvailable) onChoose(node.id); }} onKeyDown={event => { if (!backdropOnly && isAvailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onChoose(node.id); } }}>
            <title>{names[node.kind]} · column {node.column}</title>
            <TileLayers />
            {!isCurrent && <g className="route-glyph" transform="translate(0 -37) scale(1.36 .85)"><Glyph kind={node.kind} /></g>}
            {isAvailable && <g className="route-choice-marker" transform="translate(0 -138)"><path d="M0 43-29-10 0-27 29-10Z" /><path className="route-choice-shine" d="M0-20-20-9 0 2 20-9Z" /></g>}
          </g>;
        })}
        <image className="route-player" href={ROUTE_AVATAR} x={avatarX - 49} y={avatarY - 72} width="98" height="98" preserveAspectRatio="xMidYMid meet" />
      </svg>
    </div>
    {!backdropOnly && <p className="route-instruction"><span>◆</span> Select a glowing connected node <b>·</b> paths can branch into up to four choices</p>}

    {!backdropOnly && partyOpen && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-party-title" onMouseDown={event => { if (event.target === event.currentTarget) setPartyOpen(false); }}>
      <div className="route-party-panel">
        <div className="route-party-head"><div><span className="route-ball" aria-hidden="true"><i /></span><div><small>TRAVELLING TEAM</small><h2 id="route-party-title">Party</h2></div></div><button type="button" autoFocus aria-label="Close party" onClick={() => setPartyOpen(false)}>×</button></div>
        <p className="route-party-note">Set four moves, assign held items, and evolve eligible Pokémon before choosing your next node. Deployment happens on the battle map.</p>
        <div className="route-party-grid">{run.party.map(mon => {
          const species = SPECIES[mon.species], maxHp = statsAtLevel(mon.species, mon.level)[0];
          const evolution = species.evolves && mon.level >= species.evolves.level ? species.evolves : undefined;
          const availableItems = [mon.item, ...ITEMS.filter(item => (item === 'None' || run.bag.includes(item)) && itemCanEquip(item, mon.species))]
            .filter((item, index, all) => all.indexOf(item) === index);
          return <article className="route-party-card" key={mon.id}>
            <div className="route-party-summary"><div className="route-party-portrait"><Sprite id={mon.species} /></div>
              <div><h3>{species.name}</h3><p>Lv {mon.level} · {mon.hp}/{maxHp} HP</p><small>{species.ability} · {mon.item}</small><span>{mon.equipped.map(id => MOVES[id]?.name ?? id).join(' · ')}</span></div>
            </div>
            <details className="route-party-manage"><summary>Manage {species.name}{evolution ? ' · Evolution ready' : ''}</summary>
              <div className="route-party-controls">
                {Array.from({ length: MAX_EQUIPPED_MOVES }, (_, slot) => <label key={slot}>Move {slot + 1}
                  <select aria-label={`${species.name} move ${slot + 1}`} value={mon.equipped[slot] ?? ''} onChange={event => onEquipMove(mon.id, event.target.value, slot)}>
                    {mon.learned.map(id => <option value={id} key={id}>{MOVES[id]?.name ?? id}</option>)}
                  </select>
                </label>)}
                <label>Held item
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
