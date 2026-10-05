import { mkdir, writeFile } from 'node:fs/promises';

// Original code-native pixel art: 32×32 logical pixels, doubled for the board.
const folder = 'public/assets/environment/top-down';
await mkdir(folder, { recursive: true });
const rect = (x, y, w, h, fill, opacity = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" opacity="${opacity}"/>`;
const path = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges"><g transform="scale(2)">${body}</g></svg>\n`;
const manifest = { tilePixels: [64, 64], tiles: {}, ramps: {}, edges: {}, decorations: {} };
async function save(name, body) {
  await writeFile(`${folder}/${name}.svg`, svg(body));
  return `/assets/environment/top-down/${name}.svg`;
}
function grass(style, level) {
  const bases = ['#6eaa55', '#80b65c', '#91bf69'];
  let art = rect(0, 0, 32, 32, style === 'moss' ? '#579c64' : bases[level]);
  for (let i = 0; i < (style === 'speckled' ? 25 : 13); i++) {
    const x = (i * 13 + 3) % 30, y = (i * 7 + 5) % 30;
    art += rect(x, y, 2, 1, i % 3 ? '#a4c971' : '#427c48', .6);
    if (i % 4 === 0) art += rect(x + 1, y - 1, 1, 1, '#c5dc8a', .6);
  }
  return art;
}
function floor(style, level) {
  if (['grass', 'speckled', 'moss'].includes(style)) return grass(style, level);
  if (style === 'path') {
    let art = rect(0, 0, 32, 32, '#c5aa73');
    for (let i = 0; i < 16; i++) art += rect((i * 11 + 4) % 31, (i * 7 + 2) % 31, 2, 1, i % 3 ? '#dfc58b' : '#a68d60');
    return art;
  }
  if (style === 'stone' || style === 'seal') {
    let art = rect(0, 0, 32, 32, '#71867c');
    for (let y = 0; y < 32; y += 8) for (let x = -8; x < 32; x += 16) {
      const start = x + (y % 16 ? 8 : 0);
      art += rect(start + 1, y + 1, 14, 6, '#a5b09b') + rect(start + 2, y + 1, 12, 1, '#c5cbb0') + rect(start + 1, y + 6, 14, 1, '#8a9c8a');
    }
    if (style === 'seal') art += path('M12 3H20V6H25V11H28V21H25V26H20V29H12V26H7V21H4V11H7V6H12ZM13 6H19V9H23V12H25V20H23V23H19V26H13V23H9V20H7V12H9V9H13Z', '#eed17a') + rect(14, 10, 4, 12, '#427e64') + rect(10, 14, 12, 4, '#427e64') + rect(14, 14, 4, 4, '#f9e6a1');
    return art;
  }
  if (style === 'water' || style === 'lava') {
    let art = rect(0, 0, 32, 32, style === 'water' ? '#378f9b' : '#db682f');
    for (let i = 0; i < 9; i++) {
      const x = (i * 9 + 2) % 27, y = (i * 11 + 3) % 29;
      art += rect(x, y, 5, 1, style === 'water' ? '#73c8bf' : '#ffd064') + rect(x + 1, y + 1, 3, 1, style === 'water' ? '#49abae' : '#ee963c');
    }
    return art;
  }
  return rect(0, 0, 32, 32, '#46555c') + rect(2, 2, 28, 12, '#7c8b88') + rect(2, 17, 12, 13, '#667b78') + rect(17, 17, 13, 13, '#82918b');
}
for (const style of ['grass', 'speckled', 'moss', 'path', 'stone', 'seal', 'water', 'lava', 'wall']) {
  manifest.tiles[style] = [];
  for (let level = 0; level <= 2; level++) manifest.tiles[style].push(await save(`${style}-h${level}`, floor(style, level)));
}
// Edge artwork occupies the owning square only. Rotations are cardinal, never skewed.
for (const [direction, rotation] of [['north', 0], ['east', 90], ['south', 180], ['west', 270]]) {
  manifest.ramps[direction] = {};
  for (const surface of ['path', 'stone']) {
    const marks = rect(5, 4, 22, 2, surface === 'stone' ? '#586e68' : '#8b794f') + rect(6, 10, 20, 2, '#e4cd93') + rect(7, 16, 18, 2, '#e4cd93') + rect(8, 22, 16, 2, '#e4cd93');
    manifest.ramps[direction][surface] = await save(`ramp-${surface}-${direction}`, floor(surface, 0) + `<g transform="rotate(${rotation} 16 16)">${marks}</g>`);
  }
  for (const kind of ['ledge', 'bank', 'trail']) {
    let edge;
    if (kind === 'ledge') edge = rect(0, 0, 32, 6, '#695a40') + rect(0, 0, 32, 2, '#b8cd7b') + rect(2, 3, 7, 1, '#8f7951') + rect(15, 4, 9, 1, '#8f7951');
    if (kind === 'bank') edge = rect(0, 0, 32, 5, '#7e8552') + rect(0, 0, 32, 2, '#a8be71') + rect(1, 5, 8, 1, '#c0e4cd') + rect(17, 5, 12, 1, '#c0e4cd');
    if (kind === 'trail') edge = rect(0, 0, 32, 2, '#649749') + rect(0, 2, 5, 1, '#8baa59') + rect(10, 2, 7, 1, '#8baa59') + rect(25, 2, 7, 1, '#8baa59');
    manifest.edges[`${kind}-${direction}`] = await save(`${kind}-${direction}`, `<g transform="rotate(${rotation} 16 16)">${edge}</g>`);
  }
}
const crown = (x, y, w, h, color) => path(`M${x + 4} ${y}H${x + w - 4}V${y + 3}H${x + w}V${y + h - 3}H${x + w - 4}V${y + h}H${x + 4}V${y + h - 3}H${x}V${y + 3}H${x + 4}Z`, color);
function tree(pine = false, ancient = false) {
  let art = rect(11, 29, 12, 3, '#263e35', .45) + rect(14, 23, 5, 9, '#745337') + rect(14, 24, 2, 7, '#b18a50');
  if (pine) art += path('M15 0H19V4H22V8H25V12H28V16H26V19H30V24H25V28H7V24H3V20H7V17H5V13H8V9H11V5H15Z', '#264f46') + path('M15 3H18V7H21V11H24V15H22V18H27V22H23V25H9V22H6V20H10V16H8V14H11V10H14Z', '#43846b') + rect(14, 7, 3, 10, '#77ae76') + rect(10, 20, 11, 2, '#6a9e71');
  else art += crown(2, 2, 29, 24, '#2c6145') + crown(3, 1, 25, 20, '#488a4e') + crown(5, 0, 20, 15, '#79b35c') + crown(6, 2, 10, 7, '#a2cb73') + crown(18, 9, 10, 8, '#609f51') + rect(6, 17, 7, 2, '#397648') + rect(19, 21, 6, 2, '#244e3c');
  if (ancient) art += rect(10, 27, 4, 5, '#745337') + rect(20, 27, 5, 5, '#745337') + rect(15, 27, 1, 4, '#ccb272');
  return art;
}
const props = {
  tree: tree(), 'pine-tree': tree(true), 'ancient-tree': tree(false, true),
  rock: crown(5, 12, 23, 17, '#4c6460') + crown(6, 10, 21, 15, '#91a292') + crown(9, 10, 12, 7, '#c5cdb0') + rect(19, 21, 5, 3, '#718578'),
  bush: crown(4, 12, 24, 15, '#326c49') + crown(6, 10, 18, 12, '#83b95e') + rect(9, 13, 7, 2, '#b5d57b'),
  'fallen-log': rect(3, 12, 26, 12, '#674b35') + rect(5, 13, 22, 9, '#9e7545') + rect(6, 14, 20, 2, '#c49c62') + rect(7, 19, 17, 1, '#77552f') + rect(3, 14, 3, 7, '#dfb67a') + rect(27, 14, 3, 7, '#dfb67a'),
  'tree-stump': crown(7, 14, 19, 15, '#705039') + crown(7, 11, 19, 12, '#c9a96e') + crown(10, 13, 13, 8, '#916b41') + crown(12, 14, 9, 5, '#dab579'),
  'standing-stone': crown(10, 4, 13, 25, '#4e6863') + rect(12, 5, 9, 22, '#9fae98') + rect(13, 6, 7, 2, '#c8ceb2') + rect(15, 11, 2, 11, '#478779') + rect(13, 13, 6, 2, '#478779'),
  fern: path('M15 27V10H17V27ZM15 12H10V10H7V8H11V10H15ZM17 15H22V12H26V14H24V17H17ZM15 20H9V17H5V20H9V22H15ZM17 23H23V20H28V23H24V25H17Z', '#2a7c51') + rect(15, 13, 1, 13, '#8abb69'),
  mushrooms: rect(11, 21, 3, 6, '#eddbb0') + rect(21, 24, 2, 4, '#eddbb0') + crown(7, 16, 12, 7, '#c86251') + crown(18, 21, 9, 5, '#e4a45b') + rect(10, 17, 2, 2, '#f1d8ab') + rect(15, 19, 2, 2, '#f1d8ab'),
  flower: rect(14, 16, 2, 12, '#397b49') + rect(10, 22, 4, 2, '#519d55') + rect(12, 11, 6, 12, '#eac19a') + rect(9, 14, 12, 6, '#f7d6af') + rect(13, 15, 4, 4, '#e9b741'),
  'grass-tuft': path('M9 28L7 19H10L13 25L12 16H15L17 25L20 18H23L20 28Z', '#397c4b') + rect(15, 22, 1, 5, '#a7ca72'),
};
for (const [id, body] of Object.entries(props)) manifest.decorations[id] = await save(id, body);
await writeFile(`${folder}/top-down-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log('Generated square woodland floors, cardinal ramps, terrain borders, and 12 forest props.');
