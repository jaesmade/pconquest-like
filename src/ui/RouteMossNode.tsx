import { useEffect, useMemo, useRef } from 'react';
import type { RouteNodeKind } from '../game/route';

type Point = [number, number];
type Vertex = [number, number, number];
type SymbolModel = { rows: string[]; colors: Record<string, string>; depth: number };
type PixelPainter = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'>;
type SymbolFace = { points: Point[]; depth: number; color: string };

const SYMBOLS: Record<RouteNodeKind, SymbolModel> = {
  battle: {
    rows: ['SS.......SS', '.SS.....SS.', '..SS...SS..', '...SS.SS...', '....SSS....', '....SSS....', '...BB.BB...', '..BB...BB..', '.BB.....BB.', '..B.....B..'],
    colors: { S: '#eee9d5', B: '#d5a766' }, depth: 2.2,
  },
  heal: {
    rows: ['...HHH...', '...HHH...', '...HHH...', 'HHHHHHHHH', 'HHHHHHHHH', 'HHHHHHHHH', '...HHH...', '...HHH...', '...HHH...'],
    colors: { H: '#a8efd3' }, depth: 2.8,
  },
  store: {
    rows: ['....RRR....', '...RRRRR...', '..RRRRRRR..', '.RRRRRRRRR.', 'AAWAAWAAWAA', 'AAWAAWAAWAA', '.CCCCCCCCC.', '.CWCCDCCWC.', '.CWCDDDCWC.', '.CCCDDDCCC.', '.CCCDDDCCC.'],
    colors: { R: '#dd9466', A: '#e97569', W: '#fff1c8', C: '#e6c585', D: '#33535b' }, depth: 2.4,
  },
  recruit: {
    rows: ['..RRRRR..', '.RRRRRRR.', 'RRRRRRRRR', 'DDDDHDDDD', 'DDDHWHDDD', 'WWWWHWWWW', 'WWWWWWWWW', '.WWWWWWW.', '..WWWWW..'],
    colors: { R: '#eb8f83', W: '#f4edcf', D: '#32494c', H: '#719f99' }, depth: 3.1,
  },
  elite: {
    rows: ['.SSSSSSSSS.', 'SSSSGGGSSSS', 'SSSGGGGGSSS', 'SSSSGGGSSSS', 'SSGGGGGGGSS', '.SSSGGGSSS.', '.SSSGSGSSS.', '..SSSSSSS..', '...SSSSS...', '....SSS....', '.....S.....'],
    colors: { S: '#8ba9b3', G: '#f6d88b' }, depth: 2.6,
  },
  special: {
    rows: ['..GGGGG..', '.GG...GG.', '.G....GG.', '.....GG..', '...GGG...', '...GG....', '.........', '...GG....', '...GG....'],
    colors: { G: '#f4d48c' }, depth: 2.7,
  },
  boss: {
    rows: ['.....G.....', 'G...GGG...G', 'GG..GGG..GG', 'GGGGGGGGGGG', '.GGGGGGGGG.', '.GGGRGRGGG.', '.GGGGGGGGG.', '..GGGGGGG..', '..BBBBBBB..'],
    colors: { G: '#efc568', R: '#e67a72', B: '#bf8846' }, depth: 2.6,
  },
};

const PIXEL_SCALE = 3.9;
const IMAGE_X = -26 * PIXEL_SCALE;
// The platform top's center is canvas (26, 29), matching the original tile at (0, -28).
const IMAGE_Y = -28 - 29 * PIXEL_SCALE;
const STATIC_FRAME = 4;
const FRAME_COUNT = 64;
const TURN_MS = 9000;
const symbolFrames = new Map<string, string>();
const platforms = new Map<string, string>();
const staticSymbols = new Map<RouteNodeKind, string>();
const staticPlatforms = new Map<string, string>();

function canvas(width: number, height: number) {
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const context = surface.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  return { surface, context };
}

// Fill scanlines on the logical pixel grid rather than antialiasing angled polygons.
function polygon(context: PixelPainter, points: Point[], color: string) {
  context.fillStyle = color;
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
      context.fillRect(Math.ceil(cuts[index]), y, Math.floor(cuts[index + 1]) - Math.ceil(cuts[index]) + 1, 1);
    }
  }
}

function diamond(context: PixelPainter, x: number, y: number, width: number, height: number, color: string) {
  polygon(context, [[x, y - height], [x + width, y], [x, y + height], [x - width, y]], color);
}

function shade(hex: string, factor: number) {
  return '#' + [1, 3, 5].map(index => Math.max(0, Math.min(255,
    Math.round(parseInt(hex.slice(index, index + 2), 16) * factor))).toString(16).padStart(2, '0')).join('');
}

function symbolFaces(kind: RouteNodeKind, frame: number) {
  const model = SYMBOLS[kind], grid = model.rows;
  const width = grid[0].length, height = grid.length, scale = 1.65;
  const angle = frame * Math.PI * 2 / FRAME_COUNT, cos = Math.cos(angle), sin = Math.sin(angle);
  const faces: SymbolFace[] = [];
  const has = (x: number, y: number) => !!grid[y]?.[x] && grid[y][x] !== '.';
  function project([x, y, z]: Vertex): Vertex {
    const rx = x * cos + z * sin, rz = -x * sin + z * cos;
    return [26 + rx * scale, 15.5 + y * scale * .93 + rz * scale * .31, rz - y * .31];
  }
  function face(vertices: Vertex[], color: string, light: number) {
    const points = vertices.map(project);
    faces.push({ points: points.map(point => [point[0], point[1]]),
      depth: points.reduce((sum, point) => sum + point[2], 0) / points.length, color: shade(color, light) });
  }
  grid.forEach((row, r) => [...row].forEach((cell, col) => {
    if (cell === '.') return;
    const x = col - width / 2, y = r - height / 2;
    const z0 = -model.depth / 2, z1 = model.depth / 2, color = model.colors[cell];
    if (cos >= 0) face([[x, y, z1], [x + 1, y, z1], [x + 1, y + 1, z1], [x, y + 1, z1]], color, .90 + .10 * Math.abs(cos));
    else face([[x + 1, y, z0], [x, y, z0], [x, y + 1, z0], [x + 1, y + 1, z0]], color, .90 + .10 * Math.abs(cos));
    if (sin > 0 && !has(col - 1, r)) face([[x, y, z0], [x, y, z1], [x, y + 1, z1], [x, y + 1, z0]], color, .58 + .12 * Math.abs(sin));
    if (sin < 0 && !has(col + 1, r)) face([[x + 1, y, z1], [x + 1, y, z0], [x + 1, y + 1, z0], [x + 1, y + 1, z1]], color, .58 + .12 * Math.abs(sin));
    if (!has(col, r - 1)) face([[x, y, z0], [x + 1, y, z0], [x + 1, y, z1], [x, y, z1]], color, 1.12);
  }));
  return faces.sort((a, b) => a.depth - b.depth);
}

function symbolFrame(kind: RouteNodeKind, frame: number) {
  const key = `${kind}:${frame}`;
  const cached = symbolFrames.get(key);
  if (cached) return cached;
  const faces = symbolFaces(kind, frame);
  const raw = canvas(52, 34);
  faces.forEach(item => polygon(raw.context, item.points, item.color));
  const outlined = canvas(52, 34);
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([x, y]) => outlined.context.drawImage(raw.surface, x, y));
  outlined.context.globalCompositeOperation = 'source-in';
  outlined.context.fillStyle = '#213c36';
  outlined.context.fillRect(0, 0, 52, 34);
  outlined.context.globalCompositeOperation = 'source-over';
  outlined.context.drawImage(raw.surface, 0, 0);
  const url = outlined.surface.toDataURL();
  symbolFrames.set(key, url);
  return url;
}

function paintPlatform(c: PixelPainter, available: boolean, visited: boolean, selected: boolean, current: boolean) {
  diamond(c, 26, 39, 24, 9, '#252d30');
  polygon(c, [[3, 29], [26, 39], [26, 45], [3, 35]], '#9b9b90');
  polygon(c, [[26, 39], [49, 29], [49, 35], [26, 45]], '#6b726e');
  const edge = selected || current ? '#ffd274' : available ? '#70e4c5' : visited ? '#a0aaa0' : '#65716d';
  diamond(c, 26, 29, 23, 10, edge);
  diamond(c, 26, 29, 21, 8, '#c6c5b8');
  diamond(c, 26, 29, 16, 6, '#e4dfcf');
  // Broken mortar joints and subdued highlights retain the weight of the raised stone sides.
  c.fillStyle = '#7d8179';
  [[13, 34, 1, 5], [25, 39, 1, 5], [37, 35, 1, 4]].forEach(([x, y, w, h]) => c.fillRect(x, y, w, h));
  c.fillStyle = '#b1b2a5';
  [[8, 33, 4, 1], [17, 37, 6, 1], [29, 41, 5, 1]].forEach(([x, y, w, h]) => c.fillRect(x, y, w, h));
  if (available) polygon(c, [[42, 28], [47, 28], [45, 31]], '#ffce6b');
  if (visited && !current) {
    c.fillStyle = '#e6d799';
    [[22, 34], [23, 35], [24, 36], [25, 35], [26, 34], [27, 33], [28, 32]].forEach(([x, y]) => c.fillRect(x, y, 2, 2));
  }
}

function platform(available: boolean, visited: boolean, selected: boolean, current: boolean) {
  const key = `${available}:${visited}:${selected}:${current}`;
  const cached = platforms.get(key);
  if (cached) return cached;
  const { surface, context } = canvas(52, 50);
  paintPlatform(context, available, visited, selected, current);
  const url = surface.toDataURL();
  platforms.set(key, url);
  return url;
}

// Server rendering and the browser's initial markup use the same complete artwork.
// Browser effects replace these SVG URLs with cached PNG frames once a canvas exists.
function svgSurface(width: number, height: number, paint: (painter: PixelPainter) => void) {
  const layers: { color: string; paths: string[] }[] = [];
  const painter: PixelPainter = {
    fillStyle: '#000000',
    fillRect(x, y, w, h) {
      if (w <= 0 || h <= 0) return;
      const color = String(painter.fillStyle);
      if (layers.at(-1)?.color !== color) layers.push({ color, paths: [] });
      layers.at(-1)!.paths.push(`M${x} ${y}h${w}v${h}h${-w}Z`);
    },
  };
  paint(painter);
  const paths = layers.map(layer => `<path fill="${layer.color}" d="${layer.paths.join('')}"/>`).join('');
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${paths}</svg>`)}`;
}

function staticSymbol(kind: RouteNodeKind) {
  const cached = staticSymbols.get(kind);
  if (cached) return cached;
  const faces = symbolFaces(kind, STATIC_FRAME);
  const url = svgSurface(52, 34, painter => {
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([x, y]) => faces.forEach(face => {
      polygon(painter, face.points.map(point => [point[0] + x, point[1] + y]), '#213c36');
    }));
    faces.forEach(face => polygon(painter, face.points, face.color));
  });
  staticSymbols.set(kind, url);
  return url;
}

function staticPlatform(available: boolean, visited: boolean, selected: boolean, current: boolean) {
  const key = `${available}:${visited}:${selected}:${current}`;
  const cached = staticPlatforms.get(key);
  if (cached) return cached;
  const url = svgSurface(52, 50, painter => paintPlatform(painter, available, visited, selected, current));
  staticPlatforms.set(key, url);
  return url;
}

type MotionRecord = { image: SVGImageElement; shadow: SVGGElement; kind: RouteNodeKind; phase: number; visible: boolean; frame: number; bob: number };
const motionRecords = new Set<MotionRecord>();
let motionTimer: number | undefined;
let motionQuery: MediaQueryList | undefined;

function paintMotion(record: MotionRecord, time: number) {
  const progress = time / TURN_MS;
  const angle = .39 + record.phase + progress * Math.PI * 2 - .20 * Math.sin(progress * Math.PI * 4);
  const frame = ((Math.round(angle / (Math.PI * 2) * FRAME_COUNT) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
  const bob = Math.round(Math.sin(time / 1100 + record.phase * 5));
  if (frame !== record.frame) {
    record.image.setAttribute('href', symbolFrame(record.kind, frame));
    record.image.dataset.spinFrame = String(frame);
    record.frame = frame;
  }
  if (bob !== record.bob) {
    record.image.setAttribute('y', String(IMAGE_Y + bob * PIXEL_SCALE));
    record.image.dataset.floatOffset = String(bob);
    record.shadow.setAttribute('transform', `translate(0 -28) scale(${1 - bob * .09} 1)`);
    record.bob = bob;
  }
}

function stopTimer() {
  if (motionTimer !== undefined) window.clearTimeout(motionTimer);
  motionTimer = undefined;
}

function scheduleMotion() {
  stopTimer();
  if (document.hidden || motionQuery?.matches || ![...motionRecords].some(record => record.visible)) return;
  const tick = () => {
    motionTimer = undefined;
    if (document.hidden || motionQuery?.matches) return;
    const time = performance.now();
    motionRecords.forEach(record => { if (record.visible) paintMotion(record, time); });
    if ([...motionRecords].some(record => record.visible)) motionTimer = window.setTimeout(tick, 120);
  };
  motionTimer = window.setTimeout(tick, 120);
}

function motionPreferenceChanged() {
  if (motionQuery?.matches) motionRecords.forEach(record => {
    record.image.setAttribute('href', symbolFrame(record.kind, STATIC_FRAME));
    record.image.setAttribute('y', String(IMAGE_Y));
    record.image.dataset.spinFrame = String(STATIC_FRAME);
    record.image.dataset.floatOffset = '0';
    record.shadow.setAttribute('transform', 'translate(0 -28)');
    record.frame = STATIC_FRAME; record.bob = 0;
  });
  scheduleMotion();
}

export type RouteMossNodeProps = {
  kind: RouteNodeKind;
  available: boolean;
  visited: boolean;
  selected: boolean;
  current: boolean;
  /** False while the graph is a backdrop or a dialog/ability choice blocks input. */
  animated: boolean;
};

/** Decorative SVG children; the parent retains all node focus, names and input rules. */
export default function RouteMossNode({ kind, available, visited, selected, current, animated }: RouteMossNodeProps) {
  const plinth = useRef<SVGImageElement>(null);
  const icon = useRef<SVGImageElement>(null);
  const shadow = useRef<SVGGElement>(null);
  const platformUrl = useMemo(() => staticPlatform(available, visited, selected, current), [available, visited, selected, current]);
  const initialIcon = useMemo(() => staticSymbol(kind), [kind]);
  useEffect(() => {
    plinth.current?.setAttribute('href', platform(available, visited, selected, current));
  }, [available, visited, selected, current]);
  useEffect(() => {
    const image = icon.current, shadowElement = shadow.current;
    if (!image || !shadowElement) return;
    image.setAttribute('href', symbolFrame(kind, STATIC_FRAME));
    image.setAttribute('y', String(IMAGE_Y));
    image.dataset.spinFrame = String(STATIC_FRAME);
    image.dataset.floatOffset = '0';
    shadowElement.setAttribute('transform', 'translate(0 -28)');
    if (!available || current || !animated) return;
    const phase = Object.keys(SYMBOLS).indexOf(kind) * .13;
    const record: MotionRecord = { image, shadow: shadowElement, kind, phase, visible: false, frame: STATIC_FRAME, bob: 0 };
    if (!motionRecords.size) {
      motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', motionPreferenceChanged);
      document.addEventListener('visibilitychange', scheduleMotion);
    }
    motionRecords.add(record);
    const observer = new IntersectionObserver(entries => {
      record.visible = entries[0]?.isIntersecting ?? false;
      scheduleMotion();
    });
    observer.observe(image);
    return () => {
      observer.disconnect();
      motionRecords.delete(record);
      if (!motionRecords.size) {
        stopTimer();
        motionQuery?.removeEventListener('change', motionPreferenceChanged);
        document.removeEventListener('visibilitychange', scheduleMotion);
        motionQuery = undefined;
      } else scheduleMotion();
    };
  }, [kind, initialIcon, available, current, animated]);

  return <g className="route-moss-node-art" aria-hidden="true" pointerEvents="none">
    <image ref={plinth} className="route-moss-plinth" href={platformUrl} x={IMAGE_X} y={IMAGE_Y} width={52 * PIXEL_SCALE} height={50 * PIXEL_SCALE}
      style={{ imageRendering: 'pixelated' }} />
    {!current && <>
      <g ref={shadow} className="route-moss-icon-shadow" transform="translate(0 -28)" opacity=".42">
        <path d="M0-7.8 27.3 0 0 7.8-27.3 0Z" fill="#213c36" />
      </g>
      <image ref={icon} className="route-moss-icon" data-symbol={kind} data-spin-frame={STATIC_FRAME} data-float-offset="0"
        href={initialIcon} x={IMAGE_X} y={IMAGE_Y} width={52 * PIXEL_SCALE} height={34 * PIXEL_SCALE}
        style={{ imageRendering: 'pixelated' }} />
    </>}
  </g>;
}
