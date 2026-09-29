import { useMemo } from 'react';
import { unitSet } from '../battle/unitAnimations';
import { ISO_HALF_HEIGHT, ISO_HALF_WIDTH, isoTileCenter, isoWorldSize } from '../battle/isometric';
import { canDeploy } from '../game/deployment';
import { mobilityFor } from '../game/mobility';
import { TERRAIN_OBJECTS } from '../content/terrainObjects';
import { SPECIES } from '../content/species';
import type { BattleMap, GridPoint, PartyMon } from '../game/types';

type Props = { map: BattleMap; selected: PartyMon[]; focused?: PartyMon; placements: Record<string, GridPoint>; onPlace: (point: GridPoint) => void };
const asset = (name: string) => `/assets/environment/isometric/iso-${name}.svg`;
const cellKey = (x: number, y: number) => `${x},${y}`;
const UNIT_SCALE = 1.95;
const ALLY_FACING_NORTH = 3;

export default function DeploymentBoard({ map, selected, focused, placements, onPlace }: Props) {
  const world = useMemo(() => isoWorldSize(map), [map]);
  const cells = useMemo(() => map.tiles.flatMap((row, y) => row.map((tile, x) => ({ tile, x, y, center: isoTileCenter(map, x, y) }))), [map]);
  const depth = useMemo(() => [...cells].sort((a, b) => a.center.y - b.center.y || a.x + a.y - b.x - b.y), [cells]);
  const terrain = useMemo(() => depth.map(({ tile, x, y, center }) => <g key={`ground-${x}-${y}`}>
    <image href={asset(`${tile.kind}-h${tile.height}-96px`)} x={center.x - ISO_HALF_WIDTH} y={center.y - ISO_HALF_HEIGHT} width="96" height="72" />
    {tile.slope && <image href={asset(`slope-${tile.slope}-96px`)} x={center.x - ISO_HALF_WIDTH} y={center.y - ISO_HALF_HEIGHT} width="96" height="72" />}
  </g>), [depth]);
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
  const actorCells = depth.filter(({ tile, x, y }) => !!tile.object || occupants.has(cellKey(x, y)));

  return <div className="deploy-map-wrap">
    <span className="deploy-zone-tag deploy-zone-tag-enemy" aria-hidden="true">ENEMY ENTRY ↑</span>
    <span className="deploy-zone-tag deploy-zone-tag-ally" aria-hidden="true">YOUR ZONE ↓</span>
    <svg className="deploy-map" viewBox={`76 68 ${world.width - 152} ${world.height - 140}`} aria-label={`${map.name} isometric deployment map`}>
      <g className="deploy-terrain">{terrain}</g>
      <g className="deploy-actors">{actorCells.map(({ tile, x, y, center }) => {
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
          {occupant && idle && <g className={`deploy-unit${occupant.mon.id === focused?.id ? ' focused' : ''}`}>
            <ellipse cx={center.x} cy={center.y + 5} rx="21" ry="7" fill="#092432" opacity={state === 'flying' ? '.4' : '.52'} />
            {state === 'swimming' && <ellipse cx={center.x} cy={center.y + 5} rx="25" ry="9" fill="none" stroke="#c5f0ff" strokeWidth="3" opacity=".8" />}
            <svg className="deploy-unit-sprite" x={center.x - spriteWidth / 2} y={center.y - 12 + lift - spriteHeight / 2}
              width={spriteWidth} height={spriteHeight} viewBox={`0 ${row * idle.frameHeight} ${idle.frameWidth} ${idle.frameHeight}`} overflow="hidden" aria-hidden="true">
              <image href={idle.url} x="0" y="0" width={idle.frameWidth * idle.frames} height={idle.frameHeight * idle.rows} />
            </svg>
            <circle cx={center.x + 31} cy={center.y - 34 + lift} r="10" fill="#ffd13c" stroke="#132c36" strokeWidth="2" />
            <text x={center.x + 31} y={center.y - 30 + lift} textAnchor="middle" fontSize="11" fontWeight="900" fill="#132c36">{occupant.index + 1}</text>
          </g>}
          {object && <image href={asset(`${object.asset}-${object.width}px`)} x={center.x - object.width / 2} y={center.y + 5 - object.height} width={object.width} height={object.height} />}
        </g>;
      })}</g>
      <g className="deploy-hit-area">{cells.map(({ x, y, center }) => {
        const zone = map.zones[y][x];
        const legal = legalCells.has(cellKey(x, y));
        const occupant = occupants.get(cellKey(x, y));
        const points = `${center.x},${center.y - ISO_HALF_HEIGHT} ${center.x + ISO_HALF_WIDTH},${center.y} ${center.x},${center.y + ISO_HALF_HEIGHT} ${center.x - ISO_HALF_WIDTH},${center.y}`;
        return <polygon key={`hit-${x}-${y}`} points={points} className={`deploy-cell zone-${zone}${legal ? ' legal' : ''}${occupant ? ' occupied' : ''}${occupant?.mon.id === focused?.id ? ' current' : ''}`}
          role={legal ? 'button' : undefined} tabIndex={legal ? 0 : -1} aria-label={legal ? `Place ${SPECIES[focused!.species].name} at column ${x + 1}, row ${y + 1}${occupant?.mon.id === focused?.id ? ', current position' : occupant ? `, swap with ${SPECIES[occupant.mon.species].name}` : ''}` : undefined}
          onClick={() => { if (legal) onPlace([x, y]); }} onKeyDown={event => { if (legal && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPlace([x, y]); } }} />;
      })}</g>
    </svg>
  </div>;
}
