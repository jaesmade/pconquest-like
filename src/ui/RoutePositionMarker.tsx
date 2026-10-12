type Point = [number, number];

const WIDTH = 34;
const HEIGHT = 36;
const SCALE = 2;
const OUTLINE = '#473b31';

/** Rasterize facets on the same integer pixel grid as the encounter symbols. */
function markerArtwork() {
  const pixels = Array.from({ length: HEIGHT }, () => Array<string>(WIDTH).fill(''));
  function polygon(points: Point[], color: string) {
    const low = Math.floor(Math.min(...points.map(point => point[1])));
    const high = Math.ceil(Math.max(...points.map(point => point[1])));
    for (let y = low; y < high; y++) {
      const cuts: number[] = [];
      for (let index = 0; index < points.length; index++) {
        const a = points[index], b = points[(index + 1) % points.length];
        if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5)) {
          cuts.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      cuts.sort((a, b) => a - b);
      for (let index = 0; index + 1 < cuts.length; index += 2) {
        for (let x = Math.ceil(cuts[index]); x <= Math.floor(cuts[index + 1]); x++) {
          if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) pixels[y][x] = color;
        }
      }
    }
  }

  polygon([[2, 11], [17, 19], [17, 34]], '#c5a173');
  polygon([[17, 19], [32, 11], [17, 34]], '#987147');
  polygon([[17, 3], [32, 11], [17, 19], [2, 11]], '#e5ba70');
  polygon([[17, 5], [28, 11], [17, 17], [6, 11]], '#fff0c7');
  polygon([[17, 19], [19, 18], [18, 30], [17, 33]], '#e4bd7c');
  polygon([[4, 13], [7, 15], [16, 30], [16, 33]], '#d6b78a');

  const outlined = pixels.map(row => [...row]);
  pixels.forEach((row, y) => row.forEach((color, x) => {
    if (!color) return;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (ny >= 0 && ny < HEIGHT && nx >= 0 && nx < WIDTH && !pixels[ny][nx]) outlined[ny][nx] = OUTLINE;
    }
  }));

  // A single SVG data URL keeps the browser's first frame identical to server markup.
  const layers = new Map<string, string[]>();
  outlined.forEach((row, y) => {
    for (let x = 0; x < WIDTH;) {
      const color = row[x];
      let end = x + 1;
      while (end < WIDTH && row[end] === color) end++;
      if (color) {
        const paths = layers.get(color) ?? [];
        paths.push(`M${x} ${y}h${end - x}v1h${x - end}Z`);
        layers.set(color, paths);
      }
      x = end;
    }
  });
  const paths = [...layers].map(([color, runs]) => `<path fill="${color}" d="${runs.join('')}"/>`).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" shape-rendering="crispEdges">${paths}</svg>`)}`;
}

const ARTWORK = markerArtwork();

export type RoutePositionMarkerProps = { x: number; y: number };

/** A warm pixel pyramid points to the occupied plinth without obscuring its rim. */
export default function RoutePositionMarker({ x, y }: RoutePositionMarkerProps) {
  return <g className="route-player route-position-marker" transform={`translate(${x} ${y})`}
    role="img" aria-label="Current route position" pointerEvents="none">
    <title>Current route position</title>
    <g className="route-player-bob">
      <image className="route-player-pixel-pyramid" href={ARTWORK} x={-WIDTH * SCALE / 2} y={-38}
        width={WIDTH * SCALE} height={HEIGHT * SCALE} style={{ imageRendering: 'pixelated' }} />
      <g className="route-player-pixel-glint" fill="#fffdf0" shapeRendering="crispEdges">
        <path d="M-12-22h2v6h-2Z M-14-20h6v2h-6Z" />
      </g>
    </g>
  </g>;
}
