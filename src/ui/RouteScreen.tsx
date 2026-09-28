import { useEffect, useRef, useState } from 'react';
import { MOVES, SPECIES } from '../content/data';
import { unitSet } from '../battle/unitAnimations';
import { statsAtLevel } from '../game/engine';
import { availableRouteNodes, routeNode, ROUTE_COLUMNS, type RouteNode, type RouteNodeKind } from '../game/route';
import type { Run } from '../game/types';
import Sprite from './Sprite';

const names: Record<RouteNodeKind, string> = {
  battle: 'Battle', elite: 'Elite battle', heal: 'Healing', store: 'Store', special: 'Special encounter', boss: 'Boss',
};
const VIEW_WIDTH = 1960;
const VIEW_HEIGHT = 720;
const START_X = 88;
const START_Y = 585;
const xOf = (node: RouteNode) => 250 + (node.column - 1) * 178;
const yOf = (node: RouteNode) => 125 + node.lane * 165;

function Glyph({ kind }: { kind: RouteNodeKind }) {
  if (kind === 'heal') return <path d="M-8-28h16v20h20V8H8v20H-8V8h-20V-8h20z" />;
  if (kind === 'special') return <text textAnchor="middle" dominantBaseline="central" fontSize="62" fontWeight="900">?</text>;
  if (kind === 'store') return <g fill="none" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"><path d="M-27-23h8l7 34h31l8-25h-40M-5 0h27M-10 11l-4 7h37" /><circle cx="-7" cy="25" r="3" /><circle cx="19" cy="25" r="3" /></g>;
  if (kind === 'boss') return <g><path d="M0-27l23 7 9 15-9 21-7 1-4 13-12-8-12 8-4-13-7-1-9-21 9-15z" /><path className="route-glyph-cutout" d="M-19-1l13 4-8 8zM19-1L6 3l8 8z" /></g>;
  const sword = <path d="M-27 27L20-20M13-28L28-13M-29 13L-13 29M-21 15L-14 22" fill="none" strokeWidth="7" strokeLinecap="square" strokeLinejoin="round" />;
  return <g>{sword}{kind === 'elite' && <g transform="scale(-1 1)">{sword}</g>}</g>;
}

function TileLayers() {
  return <>
    <path className="route-node-shadow" d="M0 27 67-7 67 15 0 50-67 15-67-7Z" />
    <path className="route-node-side" d="M-67-25 0 9 67-25 67 7 0 42-67 7Z" />
    <path className="route-node-rim" d="M0-61 70-26 70-10 0 26-70-10-70-26Z" />
    <path className="route-node-top" d="M0-61 70-26 0 10-70-26Z" />
    <path className="route-node-inset" d="M0-50 57-25 0 4-57-25Z" />
  </>;
}

export default function RouteScreen({ run, onChoose, onBack }: { run: Run; onChoose: (id: string) => void; onBack: () => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const available = new Set(availableRouteNodes(run.route).map(node => node.id));
  const visited = new Set(run.route.visited);
  const currentNode = routeNode(run.route, run.route.visited.at(-1));
  const lead = run.party.find(mon => run.selected.includes(mon.id)) ?? run.party[0];
  const leadSet = lead ? unitSet(lead.species) : undefined;
  const leadArt = leadSet?.normal ?? leadSet?.clips.idle.url;
  const avatarX = currentNode ? xOf(currentNode) : START_X;
  const avatarY = currentNode ? yOf(currentNode) - 48 : START_Y - 50;

  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    const focusX = currentNode ? xOf(currentNode) : START_X;
    viewport.scrollLeft = Math.max(0, focusX / VIEW_WIDTH * viewport.scrollWidth - viewport.clientWidth * .34);
  }, [run.route.visited.length, currentNode]);
  useEffect(() => {
    if (!partyOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPartyOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [partyOpen]);

  return <main className="route-screen">
    <header className="route-heading">
      <span>LAYER 1 · THE CAVERNS</span>
      <strong>Choose a Route</strong>
      <small>Column {Math.min(run.encounter + 1, ROUTE_COLUMNS)} / {ROUTE_COLUMNS}</small>
    </header>

    <aside className="route-hud" aria-label="Route status">
      <div className="route-coins"><i aria-hidden="true" /><b>{run.coins}</b></div>
      <button className="route-party-button" type="button" aria-expanded={partyOpen} onClick={() => setPartyOpen(true)}>
        <span className="route-ball" aria-hidden="true"><i /></span><b>Party</b><small>{run.party.length}</small>
      </button>
    </aside>
    <button className="route-back-button" type="button" aria-label="Return to title screen" onClick={onBack}>‹</button>

    <div className="route-map-scroll" ref={scroll} aria-label="Ten-column route map">
      <svg className="route-map" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} aria-label="Branching route from column one to the boss in column ten">
        <defs>
          <filter id="route-cyan-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10" result="blur" /><feFlood floodColor="#70f4ff" floodOpacity=".95" /><feComposite in2="blur" operator="in" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <line className="route-start-link" x1={START_X} y1={START_Y - 22} x2={xOf(run.route.nodes[0])} y2={yOf(run.route.nodes[0]) - 20} />
        <g className="route-links">{run.route.links.map(link => {
          const from = routeNode(run.route, link.from)!, to = routeNode(run.route, link.to)!;
          const connected = visited.has(from.id) && visited.has(to.id);
          const reachable = visited.has(from.id) && available.has(to.id);
          return <line key={`${from.id}-${to.id}`} x1={xOf(from)} y1={yOf(from) - 20} x2={xOf(to)} y2={yOf(to) - 20} className={connected ? 'cleared' : reachable ? 'reachable' : ''} />;
        })}</g>
        <g className="route-start" transform={`translate(${START_X} ${START_Y})`}><TileLayers /></g>
        {run.route.nodes.map(node => {
          const isAvailable = available.has(node.id), isVisited = visited.has(node.id), isCurrent = currentNode?.id === node.id;
          return <g key={node.id} className={`route-node ${node.kind}${isAvailable ? ' available' : ''}${isVisited ? ' visited' : ''}${isCurrent ? ' current' : ''}`} transform={`translate(${xOf(node)} ${yOf(node)})`}
            role="button" tabIndex={isAvailable ? 0 : -1} aria-disabled={!isAvailable}
            aria-label={`Column ${node.column}: ${names[node.kind]}${isAvailable ? ', available' : isVisited ? ', completed' : ', locked'}`}
            onClick={() => { if (isAvailable) onChoose(node.id); }} onKeyDown={event => { if (isAvailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onChoose(node.id); } }}>
            <title>{names[node.kind]} · column {node.column}</title>
            <TileLayers />
            {!isCurrent && <g className="route-glyph" transform="translate(0 -25) scale(.72 .6)"><Glyph kind={node.kind} /></g>}
            {isAvailable && <g className="route-choice-marker" transform="translate(0 -103)"><path d="M0 43-29-10 0-27 29-10Z" /><path className="route-choice-shine" d="M0-20-20-9 0 2 20-9Z" /></g>}
          </g>;
        })}
        {leadArt && <image className="route-player" href={leadArt} x={avatarX - 37} y={avatarY - 48} width="74" height="74" preserveAspectRatio="xMidYMid meet" />}
      </svg>
    </div>
    <p className="route-instruction"><span>◆</span> Select a glowing connected node <b>·</b> paths can branch into up to four choices</p>

    {partyOpen && <section className="route-party-overlay" role="dialog" aria-modal="true" aria-labelledby="route-party-title" onMouseDown={event => { if (event.target === event.currentTarget) setPartyOpen(false); }}>
      <div className="route-party-panel">
        <div className="route-party-head"><div><span className="route-ball" aria-hidden="true"><i /></span><div><small>TRAVELLING TEAM</small><h2 id="route-party-title">Party</h2></div></div><button type="button" autoFocus aria-label="Close party" onClick={() => setPartyOpen(false)}>×</button></div>
        <div className="route-party-grid">{run.party.map(mon => {
          const species = SPECIES[mon.species], maxHp = statsAtLevel(mon.species, mon.level)[0];
          return <article className="route-party-card" key={mon.id}>
            <div className="route-party-portrait"><Sprite id={mon.species} /></div>
            <div><h3>{species.name}</h3><p>Lv {mon.level} · {mon.hp}/{maxHp} HP</p><small>{species.ability} · {mon.item}</small><span>{mon.equipped.map(id => MOVES[id]?.name ?? id).join(' · ')}</span></div>
          </article>;
        })}</div>
        <p className="route-party-note">Moves, items, and deployment can be changed before a battle.</p>
      </div>
    </section>}
  </main>;
}
