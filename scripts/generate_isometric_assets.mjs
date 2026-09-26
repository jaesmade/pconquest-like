import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Deterministic, seam-safe source art. Re-run with --force only to replace this family.
const root = join(process.cwd(), 'public/assets/environment/isometric');
mkdirSync(root, { recursive: true });
const force = process.argv.includes('--force');
const save = (name, body) => {
  const file = join(root, name);
  if (!force && existsSync(file)) return;
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

const tree = `<ellipse cx="48" cy="94" rx="22" ry="5" fill="#102c34" opacity=".36"/><path d="M43 58h11v36H42V72l-9-8 4-5 10 9z" fill="#70422e"/><path d="M48 60h6v31h-6z" fill="#a6683c"/><path d="M13 37h11V24h12V13h27v7h14v13h9v22H76v14H63v9H28V68H16V55H9V43h4z" fill="#214e3d"/><path d="M15 34h10V22h13V11h23v8h13v12h9v22h-9v12H61v8H31v-9H19V52h-7V40h3z" fill="#3d873d"/><path d="M21 30h13V19h12V9h17v12h11v14h7v14H69v11H55v10H34V58H21V46H13V36h8z" fill="#5ba63f"/><path d="M28 20h10V11h17v7h10v10h10v7H64v9H48v-8H35v9H22V32h6z" fill="#87c746"/><path d="M42 8h13v8H42z M23 37h11v7H23z M64 27h10v8H64z M52 51h11v7H52z" fill="#a3d84c"/><path d="M15 49h12v9H15z M30 63h16v9H30z M67 55h11v8H67z" fill="#2d703c"/>`;
save('iso-tree-96px.svg', svg(96, 104, tree));
const rock = `<ellipse cx="24" cy="35" rx="20" ry="4" fill="#102c34" opacity=".35"/><path d="M6 30V19l9-8h11l6 6 9 2 3 11-8 7H13z" fill="#53605e"/><path d="M7 20l9-9h11l7 8-7 7H14z" fill="#a2aba2"/><path d="M28 20l12-1 4 11-8 7-8-8z" fill="#6a7773"/><path d="M17 13h8v5h-8z M11 23h9v5h-9z" fill="#c0c5ad"/>`;
save('iso-rock-48px.svg', svg(48, 40, rock));
const flower = `<path d="M14 19v-9 M24 21V9 M6 22v-8" stroke="#498735" stroke-width="2"/><path d="M10 8h8v8h-8z M20 7h8v8h-8z M2 11h8v8H2z" fill="#fbf6dd"/><path d="M13 11h3v3h-3z M23 10h3v3h-3z M5 14h3v3H5z" fill="#e8c35d"/><path d="M2 22h28v2H2z" fill="#3f7c33"/>`;
save('iso-flower-32px.svg', svg(32, 24, flower));
const bush = `<ellipse cx="24" cy="37" rx="19" ry="4" fill="#102c34" opacity=".3"/><path d="M7 28V17h8V9h15v5h9v9h6v11H34v5H14v-5H5v-6z" fill="#285b3b"/><path d="M8 25V16h9V8h13v8h10v8h5v8H33v5H16v-5H7v-7z" fill="#4b9b3d"/><path d="M10 17h9v-8h13v7h9v9H30v6H16v-5H9z" fill="#79bf42"/><path d="M18 10h9v7h-9z M31 20h9v7h-9z M13 23h8v6h-8z" fill="#a0d74a"/><path d="M6 29h9v5H6z M35 30h9v4h-9z" fill="#34773a"/>`;
save('iso-bush-48px.svg', svg(48, 42, bush));
const tuft = `<path d="M1 22l2-10 4 7 2-15 4 13 3-10 2 13 4-7 1 9z" fill="#327c36"/><path d="M4 19l2-8 3 9 2-12 3 10 3-5 2 7z" fill="#7bbd3f"/><path d="M8 17l2-10 3 9z M16 18l2-8 2 9z" fill="#a7d948"/>`;
save('iso-grass-tuft-24px.svg', svg(24, 24, tuft));
