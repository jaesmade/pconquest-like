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
  const record = { active: false, frames: [], drawCalls: [], longTasks: [], renderMs: [], targetMs: [] };
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
        longTasks: { ...summary(record.longTasks), totalMs: round(record.longTasks.reduce((total, ms) => total + ms, 0)) },
        memory: { jsHeapBeforeBytes: beforeHeap, jsHeapAfterBytes: performance.memory?.usedJSHeapSize ?? null,
          jsHeapTotalBytes: performance.memory?.totalJSHeapSize ?? null },
        scene: window.__profile.sceneStats(),
      });
      output.textContent = JSON.stringify(results);
      await wait(150);
    }
  }
  status.textContent = 'Profiling complete';
  output.textContent = JSON.stringify(results);
}
