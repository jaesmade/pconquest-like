import { useMemo } from 'react';
import { unitSet } from '../battle/unitAnimations';
import { tileCenter, tileOrigin, tileTopPoints, worldSize } from '../battle/topDown';
import { terrainAssets, terrainArt, terrainEdges } from '../battle/terrainArt';
import { canDeploy } from '../game/deployment';
import { mobilityFor } from '../game/mobility';
import { TERRAIN_OBJECTS } from '../content/terrainObjects';
import { SPECIES } from '../content/species';
import type { BattleMap, GridPoint, PartyMon } from '../game/types';

type Props = { map: BattleMap; selected: PartyMon[]; focused?: PartyMon; placements: Record<string, GridPoint>; onPlace: (point: GridPoint) => void };
const cellKey = (x: number, y: number) => `${x},${y}`;
const UNIT_SCALE = 1.65;
const ALLY_FACING_NORTH = 3;

export default function DeploymentBoard({ map, selected, focused, placements, onPlace }: Props) {
  const world = useMemo(() => worldSize(map), [map]);
  const cells = useMemo(() => map.tiles.flatMap((row, y) => row.map((tile, x) => ({ tile, x, y, center: tileCenter(map, x, y) }))), [map]);
  const depth = useMemo(() => [...cells].sort((a, b) => a.y - b.y || a.x - b.x), [cells]);
  const terrain = useMemo(() => cells.map(({ tile, x, y }) => {
    const art = terrainArt(tile, x, y);
    const origin = tileOrigin(map, x, y);
    return <g key={`ground-${x}-${y}`}>
      <image href={art.url} x={origin.x} y={origin.y} width="64" height={art.height} />
      {terrainEdges(map, x, y).map(edge => <image key={edge.texture} href={edge.url} x={origin.x} y={origin.y} width="64" height="64" />)}
    </g>;
  }), [cells, map]);
  const occupants = useMemo(() => {
    const byCell = new Map<string, { mon: PartyMon; index: number }>();
    selected.forEach((mon, index) => {
      const point = placements[mon.id];
      if (point) byCell.set(cellKey(point[0], point[1]), { mon, index });
    });
    return byCell;
  }, [selected, placements]);
  const legalCells = useMemo(() => {
    if (!focused) return new Set<string>();
    return new Set(cells.filter(({ x, y }) => canDeploy(map, focused.species, [x, y], 'ally')).map(({ x, y }) => cellKey(x, y)));
  }, [cells, focused?.species, map]);
  const actorLayers = depth.filter(cell => cell.tile.object || occupants.has(cellKey(cell.x, cell.y)));

  return <div className="deploy-map-wrap">
    <span className="deploy-zone-tag deploy-zone-tag-enemy" aria-hidden="true">ENEMY ENTRY ↑</span>
    <span className="deploy-zone-tag deploy-zone-tag-ally" aria-hidden="true">YOUR ZONE ↓</span>
    <svg className="deploy-map" viewBox={`44 44 ${world.width - 88} ${world.height - 88}`} aria-label={`${map.name} top-down deployment map`}>
      <g className="deploy-terrain">{terrain}</g>
      <g className="deploy-actors">{actorLayers.map(({ tile, x, y, center }) => {
        const occupant = occupants.get(cellKey(x, y));
        const object = tile.object && TERRAIN_OBJECTS[tile.object];
        const set = occupant && unitSet(occupant.mon.species);
        const idle = set?.clips.idle;
        const row = idle ? Math.min(idle.rows - 1, idle.rows === 1 ? 0 : set!.facingRows[ALLY_FACING_NORTH] ?? 0) : 0;
        const spriteWidth = idle ? idle.frameWidth * UNIT_SCALE : 0;
        const spriteHeight = idle ? idle.frameHeight * UNIT_SCALE : 0;
        const state = occupant && mobilityFor(SPECIES[occupant.mon.species], tile).state;
        const lift = state === 'flying' ? -10 : state === 'swimming' ? 4 : 0;
        return <g key={`actor-${x}-${y}`}>
          {object && <image href={terrainAssets.decorations[object.asset as keyof typeof terrainAssets.decorations]} x={center.x - 32} y={center.y - 32} width="64" height="64" />}
          {occupant && idle && <g className={`deploy-unit${occupant.mon.id === focused?.id ? ' focused' : ''}`}>
            <ellipse cx={center.x} cy={center.y + 17} rx="21" ry="7" fill="#092432" opacity={state === 'flying' ? '.4' : '.52'} />
            {state === 'swimming' && <ellipse cx={center.x} cy={center.y + 17} rx="25" ry="9" fill="none" stroke="#c5f0ff" strokeWidth="3" opacity=".8" />}
            <svg className="deploy-unit-sprite" x={center.x - spriteWidth / 2} y={center.y + lift - spriteHeight / 2}
              width={spriteWidth} height={spriteHeight} viewBox={`0 ${row * idle.frameHeight} ${idle.frameWidth} ${idle.frameHeight}`} overflow="hidden" aria-hidden="true">
              <image href={idle.url} x="0" y="0" width={idle.frameWidth * idle.frames} height={idle.frameHeight * idle.rows} />
            </svg>
            <rect x={center.x + 21} y={center.y - 44 + lift} width="20" height="20" fill="#ffd13c" stroke="#132c36" strokeWidth="2" />
            <text x={center.x + 31} y={center.y - 30 + lift} textAnchor="middle" fontFamily="var(--pixel-font)" fontSize="10" fill="#132c36">{occupant.index + 1}</text>
          </g>}
        </g>;
      })}</g>
      <g className="deploy-hit-area">{cells.map(({ x, y }) => {
        const zone = map.zones[y][x];
        const legal = legalCells.has(cellKey(x, y));
        const occupant = occupants.get(cellKey(x, y));
        const points = tileTopPoints(map, x, y).map(point => `${point.x},${point.y}`).join(' ');
        return <polygon key={`hit-${x}-${y}`} points={points} className={`deploy-cell zone-${zone}${legal ? ' legal' : ''}${occupant ? ' occupied' : ''}${occupant?.mon.id === focused?.id ? ' current' : ''}`}
          role={legal ? 'button' : undefined} tabIndex={legal ? 0 : -1} aria-label={legal ? `Place ${SPECIES[focused!.species].name} at column ${x + 1}, row ${y + 1}${occupant?.mon.id === focused?.id ? ', current position' : occupant ? `, swap with ${SPECIES[occupant.mon.species].name}` : ''}` : undefined}
          onClick={() => { if (legal) onPlace([x, y]); }} onKeyDown={event => { if (legal && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPlace([x, y]); } }} />;
      })}</g>
    </svg>
  </div>;
}
