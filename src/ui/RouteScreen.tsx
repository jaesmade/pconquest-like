import { useEffect, useRef } from 'react';
import { availableRouteNodes, routeNode, ROUTE_COLUMNS, type RouteNode, type RouteNodeKind } from '../game/route';
import type { Run } from '../game/types';

const names: Record<RouteNodeKind, string> = {
  battle: 'Battle', elite: 'Elite battle', heal: 'Healing', store: 'Store', special: 'Special encounter', boss: 'Boss',
};
const xOf = (node: RouteNode) => 82 + (node.column - 1) * 159;
const yOf = (node: RouteNode) => 150 + node.lane * 158;

function Glyph({ kind }: { kind: RouteNodeKind }) {
  if (kind === 'heal') return <path d="M-8-28h16v20h20V8H8v20H-8V8h-20V-8h20z" fill="#00bd78" />;
  if (kind === 'special') return <text textAnchor="middle" dominantBaseline="central" fontSize="62" fontWeight="900" fill="#111">?</text>;
  if (kind === 'store') return <g fill="none" stroke="#111" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"><path d="M-27-23h8l7 34h31l8-25h-40M-5 0h27M-10 11l-4 7h37" /><circle cx="-7" cy="25" r="3" fill="#111" /><circle cx="19" cy="25" r="3" fill="#111" /></g>;
  if (kind === 'boss') return <g fill="#111"><path d="M0-27l23 7 9 15-9 21-7 1-4 13-12-8-12 8-4-13-7-1-9-21 9-15z" /><path d="M-19-1l13 4-8 8zM19-1L6 3l8 8z" fill="#c9c7c5" /></g>;
  const sword = <path d="M-27 27L20-20M13-28L28-13M-29 13L-13 29M-21 15L-14 22" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="square" strokeLinejoin="round" />;
  return <g>{sword}{kind === 'elite' && <g transform="scale(-1 1)">{sword}</g>}</g>;
}

export default function RouteScreen({ run, onChoose }: { run: Run; onChoose: (id: string) => void }) {
  const scroll = useRef<HTMLDivElement>(null);
  const available = new Set(availableRouteNodes(run.route).map(node => node.id));
  const visited = new Set(run.route.visited);
  useEffect(() => {
    const viewport = scroll.current;
    if (!viewport) return;
    const progress = run.route.visited.length / (ROUTE_COLUMNS - 1);
    viewport.scrollLeft = Math.max(0, progress * viewport.scrollWidth - viewport.clientWidth * 0.45);
  }, [run.route.visited.length]);
  return <main className="route-screen">
    <header className="route-heading"><span>LAYER 1 · THE CAVERNS</span><h2>Choose a Route</h2><p>Column {run.encounter + 1} of {ROUTE_COLUMNS} · {run.coins} coins · {run.party.length} Pokémon</p></header>
    <div className="route-map-scroll" ref={scroll} aria-label="Ten-column route map">
      <svg className="route-map" viewBox="0 0 1600 625" aria-label="Branching route from column one to the boss in column ten">
        <g className="route-links">{run.route.links.map(link => {
          const from = routeNode(run.route, link.from)!, to = routeNode(run.route, link.to)!;
          const connected = run.route.visited.includes(from.id) && run.route.visited.includes(to.id);
          return <line key={`${from.id}-${to.id}`} x1={xOf(from)} y1={yOf(from)} x2={xOf(to)} y2={yOf(to)} className={connected ? 'cleared' : ''} />;
        })}</g>
        {run.route.nodes.map(node => {
          const isAvailable = available.has(node.id), isVisited = visited.has(node.id);
          return <g key={node.id} className={`route-node ${node.kind}${isAvailable ? ' available' : ''}${isVisited ? ' visited' : ''}`} transform={`translate(${xOf(node)} ${yOf(node)})`}
            role="button" tabIndex={isAvailable ? 0 : -1} aria-disabled={!isAvailable}
            aria-label={`Column ${node.column}: ${names[node.kind]}${isAvailable ? ', available' : isVisited ? ', completed' : ', locked'}`}
            onClick={() => { if (isAvailable) onChoose(node.id); }} onKeyDown={event => { if (isAvailable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onChoose(node.id); } }}>
            <rect x="-42" y="-42" width="84" height="84" rx="13" className="route-node-frame" />
            <g className="route-glyph"><Glyph kind={node.kind} /></g>
            <text y="68" textAnchor="middle" className="route-node-label">{node.column}</text>
          </g>;
        })}
      </svg>
    </div>
    <div className="route-legend" aria-label="Route node legend">
      {(['battle', 'elite', 'heal', 'store', 'special', 'boss'] as const).map(kind => <span key={kind}><b className={`route-legend-dot ${kind}`} />{names[kind]}</span>)}
    </div>
    <p className="route-instruction">Select a glowing connected node. The boss is always in column ten.</p>
  </main>;
}
