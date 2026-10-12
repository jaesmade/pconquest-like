import { memo, useMemo } from 'react';

type Props = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  reachable?: boolean;
  cleared?: boolean;
  previewed?: boolean;
  start?: boolean;
};

const snap = (value: number) => Math.round(value / 2) * 2;

function stone(x: number, y: number, width: number, height: number) {
  return `M${x} ${y - height}l${width} ${height} ${-width} ${height} ${-width} ${-height}Z`;
}

/** Static, pixel-cut stepping stones; the saved graph still owns every connection. */
export default memo(function RouteStonePath({ x1, y1, x2, y2, reachable, cleared, previewed, start }: Props) {
  const art = useMemo(() => {
    const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
    const faces: string[] = [], shadows: string[] = [], moss: string[] = [];
    const inset = Math.min(76, length / 3), end = length - inset;
    const at = (distance: number) => [snap(x1 + dx * distance / length), snap(y1 + dy * distance / length)];
    const [beginX, beginY] = at(inset), [endX, endY] = at(end);
    let bed = `M${beginX} ${beginY}`;
    for (let distance = inset + 8; distance < end; distance += 8) {
      const [x, y] = at(distance);
      bed += `L${x} ${y}`;
    }
    bed += `L${endX} ${endY}`;
    let index = 0;
    for (let distance = inset; distance <= end; distance += 36) {
      const [x, y] = at(distance), width = 14 + index % 3 * 2;
      shadows.push(stone(x, y + 4, width + 2, 8));
      faces.push(stone(x, y, width, 6));
      if (index % 3 === 1) moss.push(`M${x + width - 6} ${y}h6v2h-6Z`);
      index++;
    }
    return { bed, shadows: shadows.join(''), faces: faces.join(''), moss: moss.join('') };
  }, [x1, y1, x2, y2]);

  return <g className={`route-stone-path${start ? ' route-start-link' : ''}${cleared ? ' cleared' : reachable ? ' reachable' : ''}${previewed ? ' previewed' : ''}`}
    aria-hidden="true" pointerEvents="none" shapeRendering="crispEdges">
    <path className="route-stone-bed" d={art.bed} />
    <path className="route-stone-shadow" d={art.shadows} />
    <path className="route-stone-face" d={art.faces} />
    <path className="route-stone-moss" d={art.moss} />
  </g>;
});
