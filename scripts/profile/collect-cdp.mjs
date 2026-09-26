import { writeFile } from 'node:fs/promises';

const port = Number(process.env.CDP_PORT ?? 9226);
const output = process.argv[2] ?? 'scripts/profile/before.json';
const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
const page = pages.find(p => p.type === 'page' && p.url.includes('/scripts/profile/index.html'));
if (!page) throw new Error('Profile page unavailable');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const item = pending.get(message.id);
  if (!item) return;
  pending.delete(message.id);
  item.resolve(message);
});
const evaluate = expression => new Promise((resolve, reject) => {
  const current = ++id;
  const timeout = setTimeout(() => { pending.delete(current); reject(new Error('CDP response timeout')); }, 10000);
  pending.set(current, { resolve: message => {
    clearTimeout(timeout);
    if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.error ?? message.result.exceptionDetails)));
    else resolve(message.result.result.value);
  } });
  ws.send(JSON.stringify({ id: current, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
});
let status;
for (let attempt = 0; attempt < 120; attempt++) {
  status = await evaluate('document.querySelector("#profile-status")?.textContent');
  if (status === 'Profiling complete') break;
  if (status?.startsWith('Profiling failed')) throw new Error(status);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
if (status !== 'Profiling complete') throw new Error(`Timed out: ${status}`);
const data = await evaluate('document.querySelector("#profile-results")?.textContent');
const result = JSON.parse(data);
await writeFile(output, JSON.stringify(result, null, 2));
console.log(`Saved ${output}`);
for (const [name, passes] of Object.entries(result.scenarios)) {
  console.log(name, JSON.stringify(passes.map(p => ({frame:p.frameMs,draw:p.drawCallsPerFrame,render:p.renderBattleMs,long:p.longTasks,memory:p.memory,scene:p.scene}))));
}
ws.close();
