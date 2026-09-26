import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Sprite from './ui/Sprite';
import PrepareScreen from './ui/PrepareScreen';
import { ENCOUNTERS, ITEMS, itemCanEquip, itemFor, MAPS, MOVES, SPECIES, STARTERS } from './content/data';
import { active, applyRouteChoice, commitEnemyAction, completeBattle, createLabBattle, evolve, finishTurn, moveUnit, newRun, nextEncounter, passTurn, startBattle, statsAtLevel, useMove, useSpecial, unitAt } from './game/engine';
import { EnemyPlanner } from './game/enemyPlanner';
import { cloneBattleForCommand } from './game/clone';
import type { LabConfig } from './game/engine';
import type { Battle, PartyMon, Run, Weather } from './game/types';
import type { ItemId } from './content/items';
import { freshRun, loadRun, saveRun } from './persistence/save';
import { validateCatalog } from './content/catalog';
import { gameAudio } from './audio/audio';
import './style.css';
import './overhaul.css';

const BattleScreen = lazy(() => import('./ui/BattleScreen'));
const pretty = (id: string) => MOVES[id]?.name ?? id;
const maxHp = (mon: PartyMon) => statsAtLevel(mon.species, mon.level)[0];
const defaultLab: LabConfig = { allySpecies: 'bulbasaur', enemySpecies: 'charmander', allyLevel: 13, enemyLevel: 13, allyItem: 'None', enemyItem: 'None', weather: 'clear', seed: 12345 };

function App({ initialRun }: { initialRun: Run }) {
  const [run, setRun] = useState<Run>(initialRun);
  const [screen, setScreen] = useState<'title' | 'game' | 'options' | 'exit' | 'lab-setup' | 'lab'>('title');
  const [labConfig, setLabConfig] = useState<LabConfig>(defaultLab);
  const [labBattle, setLabBattle] = useState<Battle>();
  const [labSession, setLabSession] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<'inspect' | 'move' | 'attack'>('inspect');
  const [chosenMove, setChosenMove] = useState('');
  const [target, setTarget] = useState<[number, number] | undefined>();
  const [notice, setNotice] = useState('');
  const [animating, setAnimating] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [soundMuted, setSoundMuted] = useState(gameAudio.isMuted());
  const enemyPlanner = useRef<EnemyPlanner>(new EnemyPlanner());
  const latestRun = useRef(run);
  latestRun.current = run;
  useEffect(() => {
    const unlock = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-audio-toggle]')) return;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      void gameAudio.unlock();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => {
    gameAudio.setMusic(screen === 'lab' ? 'battle' : screen !== 'game' ? 'menu' : run.phase === 'battle' ? 'battle' : run.phase === 'starter' || run.phase === 'result' ? 'menu' : 'route');
  }, [run.phase, screen]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void saveRun(run).then(ok => { if (latestRun.current === run) setSaveFailed(!ok); });
    }, run.phase === 'battle' ? 700 : 150);
    return () => window.clearTimeout(timer);
  }, [run]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void saveRun(latestRun.current); };
    const pagehide = () => { void saveRun(latestRun.current); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', pagehide);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', pagehide); };
  }, []);
  useEffect(() => {
    if (!paused) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); setPaused(false);
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.battle-pause')?.focus());
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [paused]);
  const battle = screen === 'lab' ? labBattle : run.battle;
  useEffect(() => {
    if (screen !== 'game' || paused || run.phase !== 'battle' || !battle || battle.result || active(battle).side !== 'enemy') { enemyPlanner.current.reset(); return; }
    if (animating || !boardReady) return;
    let cancelled = false;
    let frame = 0;
    const step = () => {
      if (cancelled) return;
      const planned = enemyPlanner.current.plan(battle);
      if (planned.pending) { frame = requestAnimationFrame(step); return; }
      const nextBattle = cloneBattleForCommand(battle);
      const acted = commitEnemyAction(nextBattle, planned.action);
      enemyPlanner.current.afterCommit(planned.action, acted);
      if (cancelled) return;
      const movedUnit = planned.action.kind === 'move' ? nextBattle.units.find(unit => unit.id === battle.current) : undefined;
      if (nextBattle.visualEvents.at(-1)?.id !== battle.visualEvents.at(-1)?.id
        || (acted && movedUnit?.hp && movedUnit.visualPath?.length)) setAnimating(true);
      setRun(previous => previous.battle === battle ? { ...previous, battle: nextBattle } : previous);
    };
    frame = requestAnimationFrame(step);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [screen, paused, run.phase, battle, animating, boardReady]);
  const encounter = ENCOUNTERS.find(entry => entry.id === run.encounterId)!;
  const current = battle && !battle.result ? active(battle) : undefined;
  const patch = (change: (next: Run) => void) => setRun(previous => { const next = { ...previous, selected: [...previous.selected], deployment: { ...previous.deployment }, bag: [...previous.bag], party: previous.party.map(mon => ({ ...mon, learned: [...mon.learned], equipped: [...mon.equipped] })) }; change(next); return next; });
  const battleAction = (change: (next: Battle) => string | undefined) => {
    if (animating || paused || !battle) return false;
    const next = cloneBattleForCommand(battle);
    const message = change(next);
    if (message) { setNotice(message); return false; }
    if (next.visualEvents.at(-1)?.id !== battle.visualEvents.at(-1)?.id) setAnimating(true);
    setNotice('');
    if (screen === 'lab') setLabBattle(next);
    else setRun({ ...run, battle: next });
    return true;
  };
  const resetSelection = () => { setMode('inspect'); setChosenMove(''); setTarget(undefined); };
  const selectTile = (x: number, y: number) => {
    if (!battle || battle.result || animating || paused || (current?.side !== 'player' && screen !== 'lab')) return;
    if (mode === 'move') setTarget([x, y]);
    else if (mode === 'attack') { if (chosenMove) setTarget([x, y]); else setNotice('Choose a move first.'); }
    else { const unit = unitAt(battle, x, y); if (unit) setNotice(`${unit.name} · ${unit.types.join('/')} · ${unit.hp}/${unit.maxHp} HP · ${unit.ability}`); else setNotice(`${battle.map.tiles[y][x].kind} · elevation ${battle.map.tiles[y][x].height}`); }
  };
  const confirmMove = () => {
    if (animating || !target) return;
    const success = battleAction(next => { const error = moveUnit(next, target[0], target[1]); if (!error) finishTurn(next); return error; });
    if (success) resetSelection();
  };
  const attack = () => {
    if (animating || !target || !chosenMove) return;
    const success = battleAction(next => { const error = useMove(next, chosenMove, target[0], target[1]); if (!error) finishTurn(next); return error; });
    if (success) resetSelection();
  };
  const special = () => {
    const success = battleAction(next => { const error = useSpecial(next); if (!error) finishTurn(next); return error; });
    if (success) resetSelection();
  };
  const start = () => {
    const next = startBattle(run);
    enemyPlanner.current.reset();
    setAnimating(false);
    setBoardReady(false);
    setRun(next); resetSelection();
    gameAudio.playCue('pokemonEnter');
  };
  const toggleDeploy = (id: string) => patch(next => {
    if (next.selected.includes(id)) next.selected = next.selected.filter(selected => selected !== id);
    else if (next.selected.length < 3) next.selected.push(id);
  });
  const equipMove = (monId: string, moveId: string, slot: number) => patch(next => {
    const mon = next.party.find(p => p.id === monId)!;
    const other = mon.equipped[slot === 0 ? 1 : 0];
    if (other === moveId) return;
    mon.equipped[slot] = moveId;
  });
  const equipItem = (monId: string, item: string) => patch(next => {
    const mon = next.party.find(p => p.id === monId)!;
    if (!itemFor(item) || !itemCanEquip(item, mon.species)) return;
    const itemId = item as ItemId;
    if (itemId === mon.item) return;
    if (itemId !== 'None' && !next.bag.includes(itemId)) return;
    if (mon.item !== 'None') next.bag.push(mon.item);
    if (itemId !== 'None') next.bag.splice(next.bag.indexOf(itemId), 1);
    mon.item = itemId;
  });

  const chooseItem = (monId: string, item: string) => {
    const mon = run.party.find(candidate => candidate.id === monId);
    if (!mon || item === mon.item || !itemFor(item) || !itemCanEquip(item, mon.species)) return;
    if (item !== 'None' && !run.bag.includes(item as ItemId)) return;
    equipItem(monId, item);
    if (item !== 'None') gameAudio.playItem(item);
  };
  const startLab = () => {
    setLabBattle(createLabBattle(labConfig));
    setLabSession(previous => previous + 1);
    setAnimating(false); setBoardReady(false); setPaused(false); resetSelection(); setNotice('');
    setScreen('lab'); gameAudio.playCue('pokemonEnter');
  };

  return <div className={`${animating ? 'app-shell animating' : 'app-shell'} ${(screen === 'game' && run.phase === 'battle') || screen === 'lab' ? 'in-battle' : ''}`}>
    {screen !== 'game' && screen !== 'lab' && <main className="title-screen"><div className="title-card"><span className="eyebrow">GRID TACTICS · ROGUELIKE</span><h1>Pokémon Tactics</h1><p>Command your team across changing terrain. Make every action point count.</p>
      {screen === 'title' && <div className="title-actions">
        {run.phase !== 'starter' && <button className="primary" onClick={() => setScreen('game')}>Continue · Encounter {run.encounter + 1}</button>}
        <button onClick={() => { if (run.phase !== 'starter' && !window.confirm('Start a new run? This replaces the current saved run.')) return; setRun(freshRun(run.unlocks)); resetSelection(); setAnimating(false); setScreen('game'); }}>{run.phase === 'starter' ? 'Start game' : 'New run'}</button>
        <button onClick={() => setScreen('lab-setup')}>Battle Lab · 1v1 testing</button><button onClick={() => setScreen('options')}>Options</button><button onClick={() => setScreen('exit')}>Exit</button>
      </div>}
      {screen === 'lab-setup' && <div className="lab-setup"><h2>Battle Lab</h2><p>Control both Pokémon on a 5×5 arena. All moves learned at the chosen level are available. Replaying the same seed repeats combat rolls.</p>
        {(['ally', 'enemy'] as const).map(side => <fieldset key={side}><legend>{side === 'ally' ? 'Ally' : 'Opponent'}</legend>
          <label>Pokémon<select value={labConfig[`${side}Species`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Species`]: event.target.value, [`${side}Item`]: 'None' }))}>{Object.entries(SPECIES).map(([id, species]) => <option value={id} key={id}>{species.name}</option>)}</select></label>
          <label>Level<input type="number" min="1" max="100" value={labConfig[`${side}Level`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Level`]: Math.max(1, Math.min(100, Number(event.target.value) || 1)) }))} /></label>
          <label>Held item<select value={labConfig[`${side}Item`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Item`]: event.target.value as ItemId }))}>{ITEMS.filter(id => itemCanEquip(id, labConfig[`${side}Species`])).map(id => <option value={id} key={id}>{id}</option>)}</select></label>
        </fieldset>)}
        <div className="lab-setup-row"><label>Weather<select value={labConfig.weather} onChange={event => setLabConfig(previous => ({ ...previous, weather: event.target.value as Weather }))}>{(['clear', 'sun', 'rain', 'snow', 'sandstorm'] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Seed<input type="number" min="1" max="4294967295" step="1" value={labConfig.seed} onChange={event => setLabConfig(previous => ({ ...previous, seed: Math.max(1, Math.min(4294967295, Math.floor(Number(event.target.value) || 1))) }))} /></label></div>
        <div className="title-actions"><button className="primary" onClick={startLab}>Start Battle Lab</button><button onClick={() => setScreen('title')}>Back to title</button></div>
      </div>}
      {screen === 'options' && <div className="title-actions"><h2>Options</h2><button data-audio-toggle aria-pressed={!soundMuted} onClick={() => { const next = !soundMuted; gameAudio.setMuted(next); setSoundMuted(next); if (!next) void gameAudio.unlock(); }}>Sound: {soundMuted ? 'Off' : 'On'}</button><button onClick={() => setScreen('title')}>Back</button></div>}
      {screen === 'exit' && <div className="title-actions"><h2>Exit</h2><p>Your run is saved in this browser. Close the tab when you are ready.</p><button onClick={() => setScreen('title')}>Back to title</button></div>}
      {saveFailed && <p role="alert">Progress could not be saved in this browser.</p>}
    </div></main>}
    {screen === 'game' && run.phase !== 'battle' && <header className="topbar"><div><span className="eyebrow">TACTICAL ROGUELIKE · EARLY BUILD</span><h1>Pokémon Tactics</h1></div><div className="top-status">{saveFailed && <span role="alert">Progress could not be saved in this browser. </span>}<button className="reset-run" onClick={() => setScreen('title')}>Title</button>{run.phase !== 'starter' && <> · Encounter {Math.min(run.encounter + 1, ENCOUNTERS.length)} / {ENCOUNTERS.length} · Party {run.party.length} / 6</>}</div></header>}
    {screen === 'game' && <>
    {run.phase === 'starter' && <main className="narrow"><section className="hero"><span className="eyebrow">NEW RUN</span><h2>Choose your lead Pokémon</h2><p>Two companions join your starting party. Pick three before each tactical battle and grow your team along the route.</p></section><div className="starter-grid">{STARTERS.map(id => <button className="starter-card" key={id} onClick={() => setRun(newRun(id, run.unlocks))}><Sprite id={id} /><strong>{SPECIES[id].name}</strong><span>{SPECIES[id].types.join(' / ')}</span><small>{SPECIES[id].ability} · {SPECIES[id].moves.map(pretty).join(' / ')}</small></button>)}</div></main>}
    {run.phase === 'route' && <main className="narrow"><section className="hero"><span className="eyebrow">ROUTE {run.encounter + 1}</span><h2>{MAPS[encounter.mapId].name}</h2><p>Choose a stop before the next encounter. Rest restores 40% max HP to the whole party. Recruit adds a Pokémon until the party reaches six.</p></section><div className="route-choice"><button className="choice" onClick={() => setRun(applyRouteChoice(run, 'rest'))}><b>✚ Rest camp</b><span>Restore and revive your party.</span></button><button className="choice" disabled={run.party.length >= 6} onClick={() => setRun(applyRouteChoice(run, 'recruit'))}><b>◇ Recruit trail</b><span>Meet another Pokémon for your run.</span></button></div><PartyList run={run} /></main>}
    {run.phase === 'prepare' && <PrepareScreen run={run} onToggle={toggleDeploy} onEquipMove={equipMove} onEquipItem={chooseItem} onDeploymentChange={deployment => patch(next => { next.deployment = deployment; })} onStart={start} />}
    {run.phase === 'battle' && battle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading battle…</h2></section></main>}><BattleScreen run={run} battle={battle} mode={mode} chosenMove={chosenMove} target={target} notice={notice} paused={paused} onTile={selectTile} onAnimationState={playing => { setAnimating(playing); setBoardReady(true); }} onMode={nextMode => { setMode(nextMode); setTarget(undefined); setNotice(''); if (nextMode !== 'attack') setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onMove={confirmMove} onAttack={attack} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next); return undefined; })) resetSelection(); }} onComplete={() => { setRun(completeBattle(run)); resetSelection(); }} onPause={() => setPaused(true)} /></Suspense>}
    {run.phase === 'intermission' && <main className="narrow"><section className="hero"><span className="eyebrow">ENCOUNTER CLEARED</span><h2>Party growth</h2><p>Every party member gained XP, including reserves. You can evolve eligible Pokémon now and adjust learned moves before the next battle.</p></section><div className="report">{run.report.map((item, i) => <p key={i}>{item}</p>)}</div><div className="prep-list">{run.party.map(mon => { const evolution = SPECIES[mon.species].evolves; return <article className="prep-card" key={mon.id}><div className="prep-head"><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small> Lv {mon.level} · {mon.hp}/{maxHp(mon)} HP</small></div></div><p>Learned: {mon.learned.map(pretty).join(', ')}</p>{evolution && mon.level >= evolution.level && <button onClick={() => setRun(evolve(run, mon.id))}>Evolve into {SPECIES[evolution.into].name}</button>}</article>; })}</div><div className="sticky-actions"><button className="primary" onClick={() => setRun(nextEncounter(run))}>{!encounter.nextId ? 'Complete run →' : 'Continue route →'}</button></div></main>}
    {run.phase === 'result' && <main className="narrow"><section className="hero result"><span className="eyebrow">RUN COMPLETE</span><h2>{run.result === 'win' ? 'Citadel secured' : 'Your team fell'}</h2><p>{run.result === 'win' ? 'The next run is ready. Your first victory has been saved locally.' : 'The route ends here. Try a different lead, moves, or terrain approach.'}</p><button className="primary" onClick={() => setRun(freshRun(run.unlocks))}>Start a new run</button></section></main>}
    {paused && <div className="pause-backdrop" role="dialog" aria-modal="true" aria-label="Paused"><div className="pause-panel"><h2>Paused</h2><button autoFocus className="primary" onClick={() => { setPaused(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.battle-pause')?.focus()); }}>Resume</button><button onClick={() => { setPaused(false); setScreen('title'); }}>Title screen</button></div></div>}
    </>}
    {screen === 'lab' && labBattle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading Battle Lab…</h2></section></main>}><BattleScreen key={labSession} run={run} battle={labBattle} labSeed={labConfig.seed} controlBoth mode={mode} chosenMove={chosenMove} target={target} notice={notice} paused={false} onTile={selectTile} onAnimationState={playing => { setAnimating(playing); setBoardReady(true); }} onMode={nextMode => { setMode(nextMode); setTarget(undefined); setNotice(''); if (nextMode !== 'attack') setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onMove={confirmMove} onAttack={attack} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next); return undefined; })) resetSelection(); }} onComplete={startLab} onPause={() => { setAnimating(false); setScreen('lab-setup'); }} onLabReset={startLab} /></Suspense>}
    {screen === 'game' && run.phase !== 'battle' && <footer>Fan prototype · original placeholder art and audio · local browser save · <a href="/assets/animations/animation-manifest.json">Animation manifest</a> · <a href="/assets/audio/audio-manifest.json">Audio manifest</a></footer>}
  </div>;
}
function PartyList({ run }: { run: Run }) { return <section className="party-list"><span className="eyebrow">YOUR PARTY</span>{run.party.map(mon => <div key={mon.id}><Sprite id={mon.species} /><b>{SPECIES[mon.species].name}</b><span>Lv {mon.level}</span><span>{mon.hp}/{maxHp(mon)} HP</span><small>{mon.item}</small></div>)}</section>; }

const contentErrors = validateCatalog();
function AppLoader() {
  const [initialRun, setInitialRun] = useState<Run>();
  useEffect(() => {
    let mounted = true;
    void loadRun().then(loaded => { if (mounted) setInitialRun(loaded); });
    return () => { mounted = false; };
  }, []);
  return initialRun ? <App initialRun={initialRun} /> : <main className="narrow"><section className="hero"><h2>Loading run…</h2></section></main>;
}
createRoot(document.getElementById('root')!).render(contentErrors.length
  ? <main className="narrow"><h1>Content needs attention</h1><p>Fix these catalog references before starting a run:</p><ul>{contentErrors.map(error => <li key={error}>{error}</li>)}</ul></main>
  : <React.StrictMode><AppLoader /></React.StrictMode>);
