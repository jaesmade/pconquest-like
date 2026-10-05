import { tileCenter } from '../../src/battle/topDown';

const round = value => Math.round(value * 100) / 100;
const percentile = (values, fraction) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]);
};
const summary = values => ({ count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95), p99: percentile(values, 0.99), max: percentile(values, 1) });
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runBrowserBench() {
  const status = document.getElementById('profile-status');
  const output = document.getElementById('profile-results');
  while (!window.__profile?.ready || !window.__profileBattleScene?.ground) await wait(50);
  const scene = window.__profileBattleScene;
  const canvas = document.querySelector('canvas');
  const gl = scene.game.renderer.gl;
  let draws = 0;
  if (gl) for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
    if (typeof gl[name] !== 'function') continue;
    const original = gl[name].bind(gl);
    gl[name] = (...args) => { draws++; return original(...args); };
  }
  const record = { active: false, frames: [], drawCalls: [], longTasks: [], renderMs: [], targetMs: [], matchupLabelsCreated: 0, hpBarRedraws: 0 };
  const originalText = scene.add.text.bind(scene.add);
  scene.add.text = (...args) => {
    if (record.active && args[3]?.backgroundColor === '#183033') record.matchupLabelsCreated++;
    return originalText(...args);
  };
  for (const bar of scene.hp.values()) {
    const originalClear = bar.clear.bind(bar);
    bar.clear = (...args) => {
      if (record.active) record.hpBarRedraws++;
      return originalClear(...args);
    };
  }
  if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    new PerformanceObserver(list => {
      if (record.active) for (const entry of list.getEntries()) record.longTasks.push(entry.duration);
    }).observe({ entryTypes: ['longtask'] });
  }
  const originalRender = scene.renderBattle.bind(scene);
  scene.renderBattle = (...args) => {
    const start = performance.now();
    const value = originalRender(...args);
    if (record.active) record.renderMs.push(performance.now() - start);
    return value;
  };
  const originalTarget = scene.renderTarget.bind(scene);
  scene.renderTarget = (...args) => {
    const start = performance.now();
    const value = originalTarget(...args);
    if (record.active) record.targetMs.push(performance.now() - start);
    return value;
  };
  let lastFrame = 0;
  const tick = now => {
    if (record.active && lastFrame) {
      record.frames.push(now - lastFrame);
      record.drawCalls.push(draws);
    }
    draws = 0;
    lastFrame = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const scenarios = {
    idle: async () => wait(1200),
    battleChanges: async () => {
      for (let i = 0; i < 30; i++) { window.__profile.change(i); await nextFrame(); }
      await wait(400);
    },
    attackBattleChanges: async () => {
      window.__profile.target(13, 4);
      await nextFrame();
      for (let i = 0; i < 30; i++) { window.__profile.change(i); await nextFrame(); }
      await wait(400);
    },
    targeting: async () => {
      window.__profile.inspect();
      await nextFrame();
      for (let i = 0; i < 30; i++) { window.__profile.target(10 + i % 5, 4 + i % 8); await nextFrame(); }
      await wait(400);
    },
    weather: async () => {
      for (let i = 0; i < 10; i++) { window.__profile.weather(); await nextFrame(); }
      await wait(1200);
    },
    cameraNavigation: async () => {
      for (let i = 0; i < 30; i++) { window.__profile.pan(i); await nextFrame(); }
      await wait(400);
    },
    animation: async () => { window.__profile.animate(); await wait(1600); },
  };
  const results = {
    date: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent, dpr: devicePixelRatio,
      viewport: [innerWidth, innerHeight], canvas: [canvas.width, canvas.height],
      renderer: scene.game.renderer.type, webgl: !!gl,
      hardwareConcurrency: navigator.hardwareConcurrency,
      scene: window.__profile.sceneStats(),
    },
    scenarios: {},
  };
  await wait(500);
  for (const [name, action] of Object.entries(scenarios)) {
    results.scenarios[name] = [];
    for (let pass = 1; pass <= 3; pass++) {
      status.textContent = `Profiling ${name}, pass ${pass}/3`;
      record.frames = []; record.drawCalls = []; record.longTasks = []; record.renderMs = []; record.targetMs = [];
      record.matchupLabelsCreated = 0; record.hpBarRedraws = 0;
      const beforeHeap = performance.memory?.usedJSHeapSize ?? null;
      record.active = true;
      const start = performance.now();
      await action();
      const elapsedMs = round(performance.now() - start);
      record.active = false;
      const frames = record.frames.filter(value => value > 0 && value < 1000);
      results.scenarios[name].push({
        pass, elapsedMs,
        frameMs: summary(frames), drawCallsPerFrame: summary(record.drawCalls),
        renderBattleMs: summary(record.renderMs), renderTargetMs: summary(record.targetMs),
        matchupLabelsCreated: record.matchupLabelsCreated, hpBarRedraws: record.hpBarRedraws,
        longTasks: { ...summary(record.longTasks), totalMs: round(record.longTasks.reduce((total, ms) => total + ms, 0)) },
        memory: { jsHeapBeforeBytes: beforeHeap, jsHeapAfterBytes: performance.memory?.usedJSHeapSize ?? null,
          jsHeapTotalBytes: performance.memory?.totalJSHeapSize ?? null },
        scene: window.__profile.sceneStats(),
      });
      output.textContent = JSON.stringify(results);
      await wait(150);
    }
  }
  results.rendererChecks = checkRendererReuse(scene);
  document.getElementById('renderer-checks').textContent = `${results.rendererChecks.assertions} renderer checks passed.`;
  status.textContent = 'Profiling complete';
  output.textContent = JSON.stringify(results);
}

/** Verify cache invalidation against the real Phaser objects after timing the fixture. */
function checkRendererReuse(scene) {
  const assert = (condition, message) => { if (!condition) throw new Error(`Renderer check: ${message}`); };
  const original = { battle: scene.battle, mode: scene.mode, chosenMove: scene.chosenMove, displayedHp: new Map(scene.displayedHp), pendingAttacks: scene.pendingAttacks, playingAttack: scene.playingAttack };
  const source = original.battle.units.find(unit => unit.id === original.battle.current);
  const enemy = original.battle.units.find(unit => unit.side !== source.side && unit.hp > 0);
  const defender = { ...enemy, x: source.x + 1, y: source.y, types: ['Water'], ability: 'Torrent' };
  let bar, originalClear;
  let hpBarRedraws = 0;
  try {
    scene.pendingAttacks = []; scene.playingAttack = undefined;
    scene.battle = { ...original.battle, units: original.battle.units.map(unit => unit.id === defender.id ? defender : unit) };
    scene.mode = 'attack'; scene.chosenMove = 'thunderbolt';
    scene.renderBattle();
    const center = tileCenter(scene.battle.map, defender.x, defender.y);
    const label = scene.labels.find(candidate => candidate.x === center.x && candidate.y === center.y - 31);
    assert(label?.text === '2×', 'water defender shows the expected effectiveness');
    const labels = [...scene.labels];
    bar = scene.hp.get(source.id); originalClear = bar.clear;
    bar.clear = function (...args) { hpBarRedraws++; return originalClear.apply(this, args); };
    scene.renderBattle();
    assert(hpBarRedraws === 0, 'unchanged HP graphics keep their command buffer');
    assert(labels.length === scene.labels.length && labels.every((candidate, index) => candidate === scene.labels[index]), 'unchanged matchups reuse their text objects');
    assert(scene.labels.length <= scene.battle.units.filter(unit => unit.hp > 0).length, 'labels stay bounded by living units');
    scene.battle = { ...scene.battle, units: scene.battle.units.map(unit => unit.id === defender.id ? { ...defender, types: ['Ground'] } : unit) };
    scene.renderBattle();
    assert(scene.labels.includes(label) && label.text === '0×', 'type changes update the reused label');

    const before = JSON.stringify(bar.commandBuffer);
    const displayed = scene.displayedHp.get(source.id) ?? source.hp;
    scene.displayedHp.set(source.id, displayed > 1 ? displayed - 1 : displayed + 1);
    scene.drawHpBar(source);
    assert(hpBarRedraws === 1 && JSON.stringify(bar.commandBuffer) !== before, 'impact HP changes rebuild the fill');
    const changedHp = JSON.stringify(bar.commandBuffer);
    const moved = { ...source, x: source.x + 1 };
    scene.drawHpBar(moved);
    const [x, y] = scene.unitCenter(moved, [moved.x, moved.y]);
    assert(hpBarRedraws === 1 && JSON.stringify(bar.commandBuffer) === changedHp && bar.x === x && bar.y === y, 'movement updates HP position without rebuilding the fill');
    scene.drawHpBar({ ...moved, maxHp: source.maxHp * 2 });
    assert(hpBarRedraws === 2, 'maximum HP changes update the fill ratio');
    scene.drawHpBar({ ...moved, maxHp: source.maxHp * 2, side: source.side === 'player' ? 'enemy' : 'player' });
    assert(hpBarRedraws === 3, 'team changes update the fill color');

    scene.mode = 'inspect'; scene.renderBattle();
    assert(scene.labels.length === 0 && !label.active, 'leaving attack mode destroys unused matchup labels');
    scene.battle = { ...scene.battle, units: scene.battle.units.map(unit => unit.id === defender.id ? { ...unit, hp: 0 } : unit) };
    scene.renderBattle();
    assert(!scene.hp.has(defender.id) && !scene.hpAppearance.has(defender.id), 'retiring a unit removes its HP cache');
    return { passed: true, assertions: 11 };
  } finally {
    if (bar && originalClear) bar.clear = originalClear;
    scene.battle = original.battle; scene.mode = original.mode; scene.chosenMove = original.chosenMove;
    scene.displayedHp = original.displayedHp;
    scene.pendingAttacks = original.pendingAttacks; scene.playingAttack = original.playingAttack;
    scene.renderBattle();
  }
}
