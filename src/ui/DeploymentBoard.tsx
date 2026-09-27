import { unitSet } from '../battle/unitAnimations';
import { ISO_HALF_HEIGHT, ISO_HALF_WIDTH, isoTileCenter, isoWorldSize } from '../battle/isometric';
import { canDeploy } from '../game/deployment';
import { TERRAIN_OBJECTS } from '../content/terrainObjects';
import { SPECIES } from '../content/species';
import type { BattleMap, GridPoint, PartyMon } from '../game/types';

type Props = { map: BattleMap; selected: PartyMon[]; focused?: PartyMon; placements: Record<string, GridPoint>; onPlace: (point: GridPoint) => void };
const asset = (name: string) => `/assets/environment/isometric/iso-${name}.svg`;

export default function DeploymentBoard({ map, selected, focused, placements, onPlace }: Props) {
  const world = isoWorldSize(map);
  const cells = map.tiles.flatMap((row, y) => row.map((tile, x) => ({ tile, x, y, center: isoTileCenter(map, x, y) })));
  const depth = [...cells].sort((a, b) => a.center.y - b.center.y || a.x + a.y - b.x - b.y);
  return <div className="deploy-map-wrap">
    <svg className="deploy-map" viewBox={`64 40 ${world.width - 128} ${world.height - 96}`} aria-label={`${map.name} isometric deployment map`}>
      <g className="deploy-terrain">{depth.map(({ tile, x, y, center }) => <g key={`ground-${x}-${y}`}>
        <image href={asset(`${tile.kind}-h${tile.height}-96px`)} x={center.x - ISO_HALF_WIDTH} y={center.y - ISO_HALF_HEIGHT} width="96" height="72" />
        {tile.slope && <image href={asset(`slope-${tile.slope}-96px`)} x={center.x - ISO_HALF_WIDTH} y={center.y - ISO_HALF_HEIGHT} width="96" height="72" />}
      </g>)}</g>
      <g className="deploy-actors">{depth.map(({ tile, x, y, center }) => {
        const occupant = selected.find(mon => placements[mon.id]?.[0] === x && placements[mon.id]?.[1] === y);
        const object = tile.object && TERRAIN_OBJECTS[tile.object];
        return <g key={`actor-${x}-${y}`}>
          {occupant && <g className={`deploy-unit${occupant.id === focused?.id ? ' focused' : ''}`}>
            <ellipse cx={center.x} cy={center.y + 7} rx="24" ry="8" fill="#092432" opacity=".52" />
            <image href={unitSet(occupant.species).normal ?? unitSet(occupant.species).clips.idle.url} x={center.x - 27} y={center.y - 55} width="54" height="54" />
            <circle cx={center.x + 23} cy={center.y - 39} r="12" fill="#ffd13c" stroke="#132c36" strokeWidth="3" />
            <text x={center.x + 23} y={center.y - 35} textAnchor="middle" fontSize="13" fontWeight="900" fill="#132c36">{selected.indexOf(occupant) + 1}</text>
          </g>}
          {object && <image href={asset(`${object.asset}-${object.width}px`)} x={center.x - object.width / 2} y={center.y + 5 - object.height} width={object.width} height={object.height} />}
        </g>;
      })}</g>
      <g className="deploy-hit-area">{cells.map(({ x, y, center }) => {
        const zone = map.zones[y][x];
        const legal = !!focused && canDeploy(map, focused.species, [x, y], 'ally');
        const occupant = selected.find(mon => placements[mon.id]?.[0] === x && placements[mon.id]?.[1] === y);
        const points = `${center.x},${center.y - ISO_HALF_HEIGHT} ${center.x + ISO_HALF_WIDTH},${center.y} ${center.x},${center.y + ISO_HALF_HEIGHT} ${center.x - ISO_HALF_WIDTH},${center.y}`;
        return <polygon key={`hit-${x}-${y}`} points={points} className={`deploy-cell zone-${zone}${legal ? ' legal' : ''}${occupant ? ' occupied' : ''}`}
          role={legal ? 'button' : undefined} tabIndex={legal ? 0 : -1} aria-label={legal ? `Place ${SPECIES[focused.species].name} at column ${x + 1}, row ${y + 1}${occupant ? `, swap with ${SPECIES[occupant.species].name}` : ''}` : undefined}
          onClick={() => { if (legal) onPlace([x, y]); }} onKeyDown={event => { if (legal && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPlace([x, y]); } }} />;
      })}</g>
    </svg>
  </div>;
}
