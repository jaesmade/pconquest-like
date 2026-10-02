import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Original, deterministic pixel-cluster source art. --forest refreshes woodland
// assets without replacing the unrelated lava / wall family; --force replaces all.
const root = join(process.cwd(), 'public/assets/environment/isometric');
mkdirSync(root, { recursive: true });
const force = process.argv.includes('--force');
const forest = process.argv.includes('--forest');
const save = (name, body, forestOwned = false) => {
  const file = join(root, name);
  if (!force && !(forest && forestOwned) && existsSync(file)) return;
  writeFileSync(file, body);
};
const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${body}</svg>\n`;
const hash = (x, y, seed) => ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
const palettes = {
  plain: { top: '#79ba3c', light: '#a6d94e', mid: '#69aa35', dark: '#508c35', left: '#a26339', right: '#824a32', seam: '#5e382b' },
  water: { top: '#158bd0', light: '#50c9ee', mid: '#188fcf', dark: '#0872b3', left: '#0e71b5', right: '#0a5b9b', seam: '#0a4f86' },
  lava: { top: '#d8592e', light: '#ffbb44', mid: '#f07b28', dark: '#983d2d', left: '#803b31', right: '#642e2d', seam: '#46252a' },
  wall: { top: '#899390', light: '#b1b8aa', mid: '#78857e', dark: '#5d6d68', left: '#69716d', right: '#515b5b', seam: '#3b484a' },
};
for (const [kind, color] of Object.entries(palettes)) for (let level = 0; level <= 2; level++) {
  if (kind === 'plain' || kind === 'water') continue;
  const depth = 22 + level * 20, bottom = 48 + depth;
  const left = `0,24 48,48 48,${bottom} 0,${24 + depth}`;
  const right = `48,48 96,24 96,${24 + depth} 48,${bottom}`;
  let sideDetails = '', topDetails = '';
  for (let y = 25; y < bottom + 2; y += 7) for (let x = 0; x < 96; x += 12) {
    const value = hash(x, y, level + kind.length);
    if (value % 5 < 2) sideDetails += `<rect x="${x + value % 5}" y="${y}" width="${6 + value % 6}" height="${2 + value % 2}" fill="${value % 3 ? color.seam : color.light}" opacity=".34"/>`;
  }
  for (let y = 4; y < 47; y += 6) for (let x = 4; x < 94; x += 8) {
    const value = hash(x, y, level + kind.charCodeAt(0));
    if (value % 5 < 3) topDetails += `<rect x="${x + value % 3}" y="${y + value % 2}" width="${3 + value % 4}" height="${2 + value % 2}" fill="${[color.light, color.mid, color.dark][value % 3]}" opacity="${kind === 'plain' ? '.68' : '.8'}"/>`;
  }
  const grassLip = kind === 'plain' ? `<path d="M1 25 L48 49 L95 25" fill="none" stroke="#b1dc57" stroke-width="2" opacity=".6"/><path d="M6 29v5 M20 36v5 M34 43v4 M61 43v5 M77 35v5 M89 29v4" stroke="#4f8d33" stroke-width="3"/>` : '';
  const waterFoam = kind === 'water' ? `<path d="M4 24 L20 32 M31 39 L47 47 M52 46 L68 38 M77 33 L92 25" stroke="#90e5f3" stroke-width="3" fill="none" opacity=".8"/>` : '';
  const body = `<defs><clipPath id="sides"><polygon points="${left}"/><polygon points="${right}"/></clipPath><clipPath id="top"><polygon points="48,0 96,24 48,48 0,24"/></clipPath></defs>`
    + `<polygon points="${left}" fill="${color.left}"/><polygon points="${right}" fill="${color.right}"/>`
    + `<g clip-path="url(#sides)">${sideDetails}</g>`
    + `<polygon points="48,0 96,24 48,48 0,24" fill="${color.top}"/>`
    + `<g clip-path="url(#top)">${topDetails}<path d="M2 23 L48 1 L94 23" fill="none" stroke="${color.light}" stroke-width="2" opacity=".25"/></g>`
    + grassLip + waterFoam
    + `<path d="M0 24 L48 48 L96 24 M48 48 L48 ${bottom}" fill="none" stroke="${color.seam}" stroke-width="2" opacity=".55"/>`;
  save(`iso-${kind}-h${level}-96px.svg`, svg(96, bottom + 2, body));
}

// Stepped, overlapping patches keep the art readable at the battlefield scale.
// Every ground variant shares its outer diamond and soil plane, so combinations
// and elevated neighbors never introduce gaps or change the rules footprint.
const patch = (x, y, w, h, fill, opacity = 1) => `<path d="M${x + 4} ${y}h${w - 8}v2h4v${h - 4}h-4v2h-${w - 8}v-2h-4v-${h - 4}h4z" fill="${fill}" opacity="${opacity}"/>`;
const soil = (depth, bottom) => {
  let rocks = '';
  for (let y = 36; y < bottom; y += 12) for (let x = 8; x < 94; x += 18) {
    const value = hash(x, y, 47);
    if (value % 4 === 0) rocks += patch(x, y, 12, 6, value % 3 ? '#bf9566' : '#584b3b', .52);
  }
  return `<path d="M0 24L48 48L96 24v5L48 53L0 29z" fill="#3f7341"/>`
    + `<path d="M0 29L48 53L96 29v4L48 57L0 33z" fill="#645738"/>`
    + `<path d="M4 35l13 6h6l9 5h7 M55 53l12-6h7l17-9" fill="none" stroke="#c09560" stroke-width="2" opacity=".5"/>`
    + `<path d="M12 31v10h4v7h5 M32 42v12h-4v${Math.min(10, depth - 12)}h5 M74 38v9h-5v${Math.min(14, depth - 10)}h-4 M86 32v11h4v5" fill="none" stroke="#cfac71" stroke-width="2"/>`
    + `<path d="M4 29v5h6v4h4 M24 39v5h6v3h4 M59 47v5h6v-8h4 M81 35v6h5v-8" fill="none" stroke="#65a044" stroke-width="4"/>`
    + rocks;
};
const forestFaces = level => {
  const depth = 22 + level * 20, bottom = 48 + depth;
  const left = `0,24 48,48 48,${bottom} 0,${24 + depth}`;
  const right = `48,48 96,24 96,${24 + depth} 48,${bottom}`;
  return {
    height: bottom + 2,
    clip: `<clipPath id="sides"><polygon points="${left}"/><polygon points="${right}"/></clipPath>`,
    planes: `<polygon points="${left}" fill="#a1774e"/><polygon points="${right}" fill="#79563d"/>`
      + `<g clip-path="url(#sides)">${soil(depth, bottom)}</g>`,
    edge: `<path d="M48 53v${depth - 5}" stroke="#594333" stroke-width="2" opacity=".45"/>`,
  };
};
const forestTile = (variant, level) => {
  const faces = forestFaces(level);
  const isPath = variant === 'path', isMoss = variant === 'moss';
  const base = isPath ? '#b69a60' : isMoss ? '#77ab50' : '#84b94d';
  let texture = '';
  for (let y = 6; y < 45; y += 8) for (let x = 4; x < 92; x += 12) {
    const value = hash(x, y, 59 + variant.length);
    if (value % 7 < 2) texture += patch(x + value % 4, y, 12, 6, isPath ? (value % 2 ? '#cdb47a' : '#947a4f') : (value % 2 ? '#a5ca61' : '#699d49'), .62);
    if (value % 13 === 0 && !isPath) texture += `<path d="M${x + 2} ${y + 5}v-3h2v3h2v-2" fill="none" stroke="#d0df7c" stroke-width="1"/>`;
  }
  if (variant === 'speckled') {
    texture += patch(23, 17, 20, 10, '#6aa044') + patch(54, 29, 16, 8, '#70a646');
    texture += `<path d="M25 21h4v2h-4z M39 25h3v2h-3z M57 34h4v2h-4z M66 17h3v2h-3z" fill="#e2d995"/>`
      + `<path d="M31 18h4v2h-4z M60 30h3v2h-3z" fill="#f0e7b4"/>`;
  }
  if (isMoss) {
    texture += patch(10, 21, 24, 10, '#568647', .8) + patch(35, 11, 28, 12, '#659747', .8)
      + patch(46, 30, 28, 10, '#589044', .8) + patch(62, 21, 20, 8, '#99bf60', .8);
    texture += `<path d="M20 25h8v2h-8z M43 17h11v2H43z M57 34h8v2h-8z" fill="#b5d074"/>`;
  }
  if (isPath) {
    texture += patch(35, 1, 24, 8, '#75a94a') + patch(2, 20, 16, 8, '#81b44b')
      + patch(77, 21, 16, 8, '#699c48') + patch(38, 40, 24, 8, '#79a94a');
    texture += `<path d="M24 21h7v2h-7z M56 21h9v2h-9z M38 33h6v2h-6z" fill="#e2c78c"/>`
      + `<path d="M36 15h3v2h-3z M69 29h4v2h-4z M29 29h3v2h-3z" fill="#826b48" opacity=".7"/>`;
  }
  const body = `<defs>${faces.clip}<clipPath id="top"><polygon points="48,0 96,24 48,48 0,24"/></clipPath></defs>`
    + faces.planes
    + `<polygon points="48,0 96,24 48,48 0,24" fill="${base}"/>`
    + `<g clip-path="url(#top)">${texture}<path d="M0 24L48 0L96 24" fill="none" stroke="${isPath ? '#cfb978' : '#b5d66a'}" stroke-width="2" opacity=".42"/></g>`
    + `<path d="M0 24L48 48L96 24" fill="none" stroke="${isPath ? '#8d8b50' : '#568740'}" stroke-width="1" opacity=".65"/>`
    + faces.edge;
  return svg(96, faces.height, body);
};
for (const variant of ['grass', 'speckled', 'moss', 'path']) for (let level = 0; level <= 2; level++) {
  const kind = variant === 'grass' ? 'plain' : variant === 'path' ? 'woodland-path' : `grass-${variant}`;
  save(`iso-${kind}-h${level}-96px.svg`, forestTile(variant, level), true);
}
// Depth-sorted faces can occlude actors behind raised foreground ground while
// leaving its entire top diamond transparent for units standing on that tile.
for (let level = 0; level <= 2; level++) {
  const faces = forestFaces(level);
  save(`iso-forest-cliff-h${level}-96px.svg`, svg(96, faces.height, `<defs>${faces.clip}</defs>${faces.planes}${faces.edge}`), true);
}
for (let level = 0; level <= 2; level++) {
  const depth = 22 + level * 20, bottom = 48 + depth;
  const left = `0,24 48,48 48,${bottom} 0,${24 + depth}`, right = `48,48 96,24 96,${24 + depth} 48,${bottom}`;
  const body = `<defs><clipPath id="top"><polygon points="48,0 96,24 48,48 0,24"/></clipPath></defs>`
    + `<polygon points="${left}" fill="#23888f"/><polygon points="${right}" fill="#216b7d"/>`
    + `<path d="M0 29L48 53L96 29 M0 39L48 63L96 39" fill="none" stroke="#40afb0" stroke-width="2" opacity=".4"/>`
    + `<polygon points="48,0 96,24 48,48 0,24" fill="#42aeb4"/>`
    + `<g clip-path="url(#top)"><path d="M17 21h17v-2h9 M47 12h11v2h8 M47 35h17v-2h11" fill="none" stroke="#87d3c7" stroke-width="2"/><path d="M28 30h14v2h6 M66 24h16 M26 12h9" fill="none" stroke="#287f99" stroke-width="2" opacity=".6"/><path d="M0 24L48 0L96 24" fill="none" stroke="#7cd3c5" stroke-width="2" opacity=".5"/></g>`
    + `<path d="M0 24L48 48L96 24" fill="none" stroke="#276e86" stroke-width="1" opacity=".4"/>`;
  save(`iso-water-h${level}-96px.svg`, svg(96, bottom + 2, body), true);
}

const lobe = (x, y, w, h, fill) => `<path d="M${x + 12} ${y}h${w - 24}v4h8v4h4v${h - 16}h-4v4h-8v4h-${w - 24}v-4h-8v-4h-4v-${h - 16}h4v-4h8z" fill="${fill}"/>`;
const tree = `<ellipse cx="48" cy="98" rx="24" ry="5" fill="#1d3e38" opacity=".3"/>`
  + `<path d="M43 55h13v33h4v5l9 4v3H53v-5h-9v6H29v-4l11-5V76l-9-8 4-5 10 9z" fill="#654b33"/>`
  + `<path d="M45 59h6v29h-3v8h-5V79l-8-10 3-3 7 8z M56 87v8h8v3h-9v-4h-3v-7z" fill="#ab7a47"/>`
  + `<path d="M48 67v9h-3v7 M52 81v12 M40 96h-6" fill="none" stroke="#d1a165" stroke-width="2"/>`
  + `<path d="M33 97h8v-4h6v3h9v-3h5v5h-7v3H38z" fill="#60904c"/>`
  + `<path d="M12 37h7V23h12V13h13V7h20v6h13v11h10v14h5v19h-7v10H72v10H28v-8H16V57H8V42h4z" fill="#294f3d"/>`
  + lobe(14, 28, 46, 38, '#507f44') + lobe(46, 31, 40, 38, '#497e45')
  + lobe(25, 43, 48, 32, '#5e9445') + lobe(29, 16, 50, 42, '#75a947')
  + lobe(19, 23, 40, 34, '#84b44a') + lobe(34, 10, 38, 30, '#a0c757')
  + `<path d="M39 16h14v4H39z M29 30h10v4H29z M20 39h8v4h-8z M49 28h9v4h-9z M64 40h9v4h-9z M39 49h12v4H39z M32 61h10v3H32z" fill="#c1d875"/>`
  + `<path d="M43 38h10v4H43z M26 48h8v4h-8z M60 53h9v5h-9z M46 66h12v4H46z M76 48h5v7h-5z" fill="#3f7042"/>`
  + `<path d="M24 34h6v2h-6z M56 20h6v2h-6z M53 55h5v2h-5z M64 62h5v2h-5z" fill="#a4c860"/>`;
save('iso-tree-96px.svg', svg(96, 104, tree), true);
const rock = `<ellipse cx="24" cy="35" rx="21" ry="4" fill="#1d3e38" opacity=".3"/><path d="M5 28V18l10-9h13l9 7h5v13l-9 7H14z" fill="#596d63"/><path d="M6 19l10-9h12l8 7-7 8H15z" fill="#a2aa86"/><path d="M29 25l8-8h4v12l-8 7H22v-5z" fill="#74857b"/><path d="M17 13h8v3h-8z M11 21h7v3h-7z" fill="#d0ceb0"/><path d="M7 24h7v4h6v5h-7v2H8v-4H4v-4h3z M28 31h8v-3h6v5h-7v4h-9v-3h-5z" fill="#669749"/><path d="M8 25h5v2H8z M30 32h7v2h-7z" fill="#a7c266"/>`;
save('iso-rock-48px.svg', svg(48, 40, rock), true);
const flower = `<path d="M3 21h27v2H3z" fill="#557d43" opacity=".5"/><path d="M9 21V10 M23 21V7 M15 22v-6" stroke="#507a41" stroke-width="2"/><path d="M7 19H4v-3h4 M22 17h5v-3h-3" fill="#91b956"/><path d="M7 7h4v3h3v4h-3v3H7v-3H4v-4h3z M21 3h4v3h3v4h-3v3h-4v-3h-3V6h3z" fill="#f3edd0"/><path d="M8 10h3v3H8z M22 6h3v3h-3z" fill="#e9bb62"/><path d="M13 13h5v5h-5z" fill="#d7c6dd"/><path d="M14 14h2v2h-2z" fill="#fff0be"/>`;
save('iso-flower-32px.svg', svg(32, 24, flower), true);
const bush = `<ellipse cx="24" cy="37" rx="20" ry="4" fill="#1d3e38" opacity=".28"/><path d="M4 22h4V12h10V6h16v6h7v10h5v11h-7v6H13v-4H4z" fill="#365e40"/>`
  + lobe(5, 14, 34, 24, '#659746') + lobe(13, 8, 32, 24, '#8cb64d')
  + `<path d="M18 12h10v4H18z M9 23h7v4H9z M32 22h7v3h-7z" fill="#c0d572"/><path d="M22 28h9v4h-9z M8 31h7v3H8z" fill="#4c8042"/>`;
save('iso-bush-48px.svg', svg(48, 42, bush), true);
const fallenLog = `<ellipse cx="40" cy="36" rx="33" ry="3" fill="#1d3e38" opacity=".3"/>`
  + `<path d="M7 22l7-7L65 5l8 6v12L18 36 7 30z" fill="#594531"/>`
  + `<path d="M14 17L64 6l6 4v7L18 29l-6-4z" fill="#ae8150"/>`
  + `<path d="M18 29l52-12v7L18 36z" fill="#765637"/>`
  + `<path d="M21 20l35-8 M24 25l39-9 M30 28l28-7" fill="none" stroke="#d1a164" stroke-width="2"/>`
  + `<path d="M32 17v4l-3 2 M46 16v4l4 1 M59 10v5l-3 2 M42 26v4l-4 2" fill="none" stroke="#684b32" stroke-width="2"/>`
  + `<path d="M10 19h7l5 7v7l-5 3h-6l-5-6v-6z" fill="#d6b17b"/><path d="M11 23h5l3 4v5l-3 2h-4l-3-4v-4z" fill="#9c754b"/><path d="M12 25h3l2 3v3h-4l-2-3z" fill="#e1c391"/><path d="M13 27h2v3h-2z" fill="#86603e"/>`
  + `<path d="M26 16l15-3v4l-6 1v3l-8 2v-3h-4v-3z M55 7l9-2 4 3v4l-8 2v-3h-5z" fill="#639348"/><path d="M29 16l10-2v2l-10 2z M59 7h5v2h-5z" fill="#a9c36a"/>`
  + `<path d="M52 10V6l-5-3 2-2 7 4v5z" fill="#765637"/>`;
save('iso-fallen-log-80px.svg', svg(80, 40, fallenLog), true);
const tuft = `<path d="M2 22v-6h3v-6h2v8h3V5h3v13h3v-7h3v6h3v5z" fill="#568641"/><path d="M5 21v-6h2v5h4V9h2v11h4v-5h2v6z" fill="#a8c969"/><path d="M10 6h3v4h-3z M4 12h3v3H4z M17 10h3v3h-3z" fill="#d0de88"/>`;
save('iso-grass-tuft-24px.svg', svg(24, 24, tuft), true);

const stump = `<ellipse cx="28" cy="35" rx="24" ry="4" fill="#1d3e38" opacity=".3"/>`
  + `<path d="M10 14h35v17l8 4v3H38l-5-5H23l-4 5H4v-3l6-4z" fill="#775437"/><path d="M12 18h15v13l-5 5H11l6-5V20z" fill="#a27748"/><path d="M31 18h8v13l7 4h-9l-6-5z" fill="#a97f4e"/>`
  + `<path d="M10 12l9-5h17l9 5v7l-9 5H19l-9-5z" fill="#5f4a34"/><path d="M13 12l8-4h13l8 4v6l-8 4H21l-8-4z" fill="#dcc18c"/><path d="M19 13l5-2h8l5 2v4l-5 2h-8l-5-2z" fill="#aa8453"/><path d="M22 14l4-1h5l3 1v2l-4 1h-4l-4-1z" fill="#e4c98f"/><path d="M27 14h3v2h-3z M36 9v4h-3" fill="#795839"/>`
  + `<path d="M18 24v7h-4 M29 25v8 M41 23v5h3" fill="none" stroke="#594532" stroke-width="2"/>`
  + `<path d="M7 31h10v-3h6v5h-8v4H7z M37 31h6v-3h4v6h4v2H38z" fill="#699648"/><path d="M9 32h7v2H9z M39 33h7v2h-7z" fill="#b0c66a"/>`;
save('iso-tree-stump-56px.svg', svg(56, 40, stump), true);
const fern = `<ellipse cx="20" cy="29" rx="16" ry="3" fill="#1d3e38" opacity=".18"/><path d="M20 29V8 M20 26L8 13 M20 27l12-13 M20 27L3 21 M20 28l17-7" fill="none" stroke="#426e40" stroke-width="2"/><path d="M18 8V3h4v5h3v3h-3v3h4v3h-4v4h3v3h-4v5h-3V18h-4v-3h4v-4h-3V8z M6 13h5v4h5v4h-4v-2H7v-3H4v-3z M29 13h6v3h-3v3h-5v3h-4v-4h5v-3h1z M1 21h8v3h5v3H8v-2H2z M32 20h7v4h-7v2h-6v-3h6z" fill="#729f50"/><path d="M19 3h3v4h-3z M6 13h5v2H6z M30 13h5v2h-5z M2 21h6v2H2z M33 20h5v2h-5z M20 14h4v2h-4z" fill="#b8ce71"/>`;
save('iso-fern-40px.svg', svg(40, 32, fern), true);
const mushrooms = `<ellipse cx="16" cy="25" rx="13" ry="2" fill="#1d3e38" opacity=".2"/><path d="M8 14h5v10H7v-4h1z M23 18h4v6h-5v-3h1z" fill="#d8c398"/><path d="M10 16h3v7h-3z M25 18h2v5h-2z" fill="#9b8568"/><path d="M3 12h3V7h3V4h5v3h4v4h3v6H3z" fill="#874e3f"/><path d="M3 11h3V7h4V4h4v3h4v4h2v3H3z" fill="#d58956"/><path d="M7 8h3v3H7z M14 10h3v2h-3z M10 5h3v2h-3z" fill="#f4d8a0"/><path d="M18 17h3v-4h6v3h3v4H18z" fill="#9c5742"/><path d="M19 16h3v-3h4v3h3v2H19z" fill="#ce7750"/><path d="M23 14h3v2h-3z" fill="#efd49c"/>`;
save('iso-mushrooms-32px.svg', svg(32, 28, mushrooms), true);
const pine = `<ellipse cx="40" cy="114" rx="25" ry="5" fill="#1d3e38" opacity=".28"/><path d="M34 81h12v27l8 5v3H42v-4h-6v5H25v-3l9-6z" fill="#624b35"/><path d="M36 86h5v22h-3v6h-5v-3h3z" fill="#a5824e"/>`
  + `<path d="M37 4h7v8h5v10h6v10h5v10h7v12h7v14h4v17h-8v10H52v8H27v-7H13V86H3V69h5V56h8V43h7V30h6V17h8z" fill="#2e5343"/>`
  + `<path d="M38 5h5v12h5v10h5v10h5v12h8v11H55v5H30v-5H14V50h8V38h6V27h5V16h5z" fill="#689957"/>`
  + `<path d="M27 43h7v10h22v7h10v8h8v12H58v5H24v-5H9V68h8V55h10z" fill="#537e4e"/>`
  + `<path d="M24 65h7v12h20v5h14v7h6v6H52v6H27v-6H14v-9H7v-9h11v-7h6z" fill="#62934f"/>`
  + `<path d="M39 8h3v9h-3z M34 23h5v9h-5z M29 38h7v8h-7z M21 52h11v4H21z M35 56h12v4H35z M18 69h9v4h-9z M34 78h10v4H34z M21 87h10v4H21z M44 90h10v4H44z" fill="#a1be6a"/>`
  + `<path d="M48 28h5v12h-5z M52 48h9v5h-9z M53 65h12v6H53z M51 86h14v5H51z M25 95h13v5H25z" fill="#3c6947"/>`;
save('iso-pine-tree-80px.svg', svg(80, 120, pine), true);

// A slope is a readable top-surface ramp on the higher tile. Its open edge faces
// a neighboring tile exactly one elevation level lower.
const ramp = `<polygon points="9,20 40,4 65,17 37,31" fill="#89714a" stroke="#615338" stroke-width="2"/>`
  + `<polygon points="13,19 40,6 61,17 37,28" fill="#b49b62"/>`
  + `<path d="M13 19L40 6 M21 21L47 9 M29 24L54 13 M37 27L61 17" fill="none" stroke="#dfc280" stroke-width="3"/>`
  + `<path d="M9 20L40 4 M37 31L65 17" fill="none" stroke="#8cb953" stroke-width="3"/>`
  + `<path d="M14 15h4v3h-4z M47 25h4v3h-4z" fill="#477743"/>`;
for (const [direction, transform] of Object.entries({
  west: '', north: 'translate(96 0) scale(-1 1)',
  east: 'translate(96 48) scale(-1 -1)', south: 'translate(0 48) scale(1 -1)',
})) {
  save(`iso-slope-${direction}-96px.svg`, svg(96, 48, `<g${transform ? ` transform="${transform}"` : ''}>${ramp}</g>`), true);
}

// Keep existing texture identifiers and optional manifest metadata intact.
const manifestPath = join(root, 'isometric-manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {
  schemaVersion: 1, projection: 'square-grid-isometric', tileTopPixels: [96, 48], heightStepPixels: 20,
  source: 'Original deterministic SVGs from scripts/generate_isometric_assets.mjs', license: 'Project original; replaceable',
  tiles: Object.fromEntries(Object.keys(palettes).map(kind => [kind, [0, 1, 2].map(level => `/assets/environment/isometric/iso-${kind}-h${level}-96px.svg`)])),
  decorations: {}, slopes: Object.fromEntries(['north', 'south', 'east', 'west'].map(direction => [direction, `/assets/environment/isometric/iso-slope-${direction}-96px.svg`])),
};
manifest.forestTiles = Object.fromEntries(['grass', 'speckled', 'moss', 'path'].map(variant => {
  const kind = variant === 'grass' ? 'plain' : variant === 'path' ? 'woodland-path' : `grass-${variant}`;
  return [variant, [0, 1, 2].map(level => `/assets/environment/isometric/iso-${kind}-h${level}-96px.svg`)];
}));
manifest.forestCliffs = [0, 1, 2].map(level => `/assets/environment/isometric/iso-forest-cliff-h${level}-96px.svg`);
Object.assign(manifest.decorations, Object.fromEntries([
  ['tree', 'tree-96px'], ['rock', 'rock-48px'], ['flower', 'flower-32px'], ['bush', 'bush-48px'],
  ['fallen-log', 'fallen-log-80px'], ['grass-tuft', 'grass-tuft-24px'], ['tree-stump', 'tree-stump-56px'],
  ['fern', 'fern-40px'], ['mushrooms', 'mushrooms-32px'], ['pine-tree', 'pine-tree-80px'],
].map(([id, file]) => [id, `/assets/environment/isometric/iso-${file}.svg`])));
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
