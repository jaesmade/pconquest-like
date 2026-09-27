import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Sprite from './ui/Sprite';
import PrepareScreen from './ui/PrepareScreen';
import PartyBuilder from './ui/PartyBuilder';
import RouteScreen from './ui/RouteScreen';
import { SHOP_STOCK } from './content/shop';
import { ITEMS, itemCanEquip, itemFor, MOVES, SPECIES } from './content/data';
import { MAX_RUN_POKEMON } from './content/roster';
import { active, advanceRoute, buyShopItem, commitEnemyAction, completeBattle, createLabBattle, evolve, finishTurn, moveUnit, newRun, nextEncounter, offerRecruits, passTurn, resolveSpecial, selectRouteNode, startBattle, statsAtLevel, useMove, useSpecial, unitAt } from './game/engine';
import { ROUTE_COLUMNS, routeNode } from './game/route';
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
  const [starterDraft, setStarterDraft] = useState<string[]>([]);
  const [screen, setScreen] = useState<'splash' | 'title' | 'game' | 'options' | 'exit' | 'lab-setup' | 'lab'>('splash');
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
  const actionPending = useRef(false);
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
    if (screen !== 'splash') return;
    const begin = () => setScreen('title');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') event.preventDefault();
      begin();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', begin);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('pointerdown', begin); };
  }, [screen]);
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
  useEffect(() => { actionPending.current = false; }, [battle]);
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
  const current = battle && !battle.result ? active(battle) : undefined;
  const patch = (change: (next: Run) => void) => setRun(previous => { const next = { ...previous, selected: [...previous.selected], deployment: { ...previous.deployment }, bag: [...previous.bag], party: previous.party.map(mon => ({ ...mon, learned: [...mon.learned], equipped: [...mon.equipped] })) }; change(next); return next; });
  const battleAction = (change: (next: Battle) => string | undefined) => {
    if (actionPending.current || animating || paused || !battle) return false;
    const next = cloneBattleForCommand(battle);
    const message = change(next);
    if (message) { setNotice(message); return false; }
    if (next.visualEvents.at(-1)?.id !== battle.visualEvents.at(-1)?.id) setAnimating(true);
    actionPending.current = true;
    setNotice('');
    if (screen === 'lab') setLabBattle(next);
    else setRun({ ...run, battle: next });
    return true;
  };
  const resetSelection = () => { setMode('inspect'); setChosenMove(''); setTarget(undefined); };
  const moveTo = (x: number, y: number) => {
    const success = battleAction(next => { const error = moveUnit(next, x, y); if (!error) finishTurn(next); return error; });
    if (success) resetSelection();
  };
  const attackAt = (x: number, y: number) => {
    if (!chosenMove) { setNotice('Choose a move first.'); return; }
    const success = battleAction(next => { const error = useMove(next, chosenMove, x, y); if (!error) finishTurn(next); return error; });
    if (success) resetSelection();
  };
  const previewTile = (x: number, y: number) => {
    if (!battle || battle.result || animating || paused || (current?.side !== 'player' && screen !== 'lab')) return;
    if (mode === 'move' || (mode === 'attack' && chosenMove)) setTarget(previous => previous?.[0] === x && previous[1] === y ? previous : [x, y]);
  };
  const selectTile = (x: number, y: number) => {
    if (!battle || battle.result || animating || paused || (current?.side !== 'player' && screen !== 'lab')) return;
    if (mode === 'move') { setTarget([x, y]); moveTo(x, y); }
    else if (mode === 'attack') { setTarget([x, y]); attackAt(x, y); }
    else { const unit = unitAt(battle, x, y); if (unit) setNotice(`${unit.name} · ${unit.types.join('/')} · ${unit.hp}/${unit.maxHp} HP · ${unit.ability}`); else { const tile = battle.map.tiles[y][x]; setNotice(`${tile.object ?? tile.kind} · elevation ${tile.height}${tile.slope ? ` · ${tile.slope} slope` : ''}`); } }
  };
  const confirmMove = () => {
    if (animating || !target) return;
    moveTo(target[0], target[1]);
  };
  const attack = () => {
    if (animating || !target) return;
    attackAt(target[0], target[1]);
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
    else if (next.selected.length < 6) next.selected.push(id);
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
    {screen !== 'game' && screen !== 'lab' && <main className={`title-screen ${screen === 'splash' ? 'splash-screen' : ''}`} onClick={screen === 'splash' ? () => setScreen('title') : undefined}>
      <div className={`title-layout ${screen === 'splash' ? 'splash-layout' : ''}`}>
        <header className="title-brand" aria-label="Pokémon Tactics"><h1><span>Pokémon</span><span>Tactics</span></h1></header>
        {screen === 'splash' && <button className="splash-prompt" onClick={() => setScreen('title')}>Press any key to start</button>}
        {screen === 'title' && <nav className="title-menu" aria-label="Main menu" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          if (!buttons.length) return;
          event.preventDefault();
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next].focus();
        }}>
          {run.phase !== 'starter' && run.phase !== 'result' && <button className="menu-button" autoFocus onClick={() => setScreen('game')}>Continue</button>}
          <button className="menu-button" autoFocus={run.phase === 'starter' || run.phase === 'result'} onClick={() => { if (run.phase !== 'starter' && !window.confirm('Start a new run? This replaces the current saved run.')) return; setStarterDraft([]); setRun(freshRun(run.unlocks)); resetSelection(); setAnimating(false); setScreen('game'); }}>New Run</button>
          <button className="menu-button" onClick={() => setScreen('lab-setup')}>Lab</button>
          <button className="menu-button" onClick={() => setScreen('options')}>Options</button>
          <button className="menu-button menu-exit" onClick={() => setScreen('exit')}>Exit</button>
        </nav>}
        {screen === 'lab-setup' && <section className="title-panel lab-setup"><h2>Battle Lab</h2><p>Control both Pokémon on a 5×5 arena. All moves learned at the chosen level are available. Replaying the same seed repeats combat rolls.</p>
        {(['ally', 'enemy'] as const).map(side => <fieldset key={side}><legend>{side === 'ally' ? 'Ally' : 'Opponent'}</legend>
          <label>Pokémon<select value={labConfig[`${side}Species`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Species`]: event.target.value, [`${side}Item`]: 'None' }))}>{Object.entries(SPECIES).map(([id, species]) => <option value={id} key={id}>{species.name}</option>)}</select></label>
          <label>Level<input type="number" min="1" max="100" value={labConfig[`${side}Level`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Level`]: Math.max(1, Math.min(100, Number(event.target.value) || 1)) }))} /></label>
          <label>Held item<select value={labConfig[`${side}Item`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Item`]: event.target.value as ItemId }))}>{ITEMS.filter(id => itemCanEquip(id, labConfig[`${side}Species`])).map(id => <option value={id} key={id}>{id}</option>)}</select></label>
        </fieldset>)}
        <div className="lab-setup-row"><label>Weather<select value={labConfig.weather} onChange={event => setLabConfig(previous => ({ ...previous, weather: event.target.value as Weather }))}>{(['clear', 'sun', 'rain', 'snow', 'sandstorm'] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Seed<input type="number" min="1" max="4294967295" step="1" value={labConfig.seed} onChange={event => setLabConfig(previous => ({ ...previous, seed: Math.max(1, Math.min(4294967295, Math.floor(Number(event.target.value) || 1))) }))} /></label></div>
        <div className="title-actions"><button className="menu-button" autoFocus onClick={startLab}>Start Battle Lab</button><button className="menu-button" onClick={() => setScreen('title')}>Back to title</button></div>
        </section>}
        {screen === 'options' && <section className="title-panel"><h2>Options</h2><div className="title-actions"><button className="menu-button" autoFocus data-audio-toggle aria-pressed={!soundMuted} onClick={() => { const next = !soundMuted; gameAudio.setMuted(next); setSoundMuted(next); if (!next) void gameAudio.unlock(); }}>Sound: {soundMuted ? 'Off' : 'On'}</button><button className="menu-button" onClick={() => setScreen('title')}>Back</button></div></section>}
        {screen === 'exit' && <section className="title-panel"><h2>Exit</h2><p>Your run is saved in this browser. Close the tab when you are ready.</p><div className="title-actions"><button className="menu-button" autoFocus onClick={() => setScreen('title')}>Back to title</button></div></section>}
        {saveFailed && screen !== 'splash' && <p className="title-save-warning" role="alert">Progress could not be saved in this browser.</p>}
      </div>
    </main>}
    {screen === 'game' && run.phase !== 'battle' && run.phase !== 'starter' && <header className="topbar"><div><span className="eyebrow">TACTICAL ROGUELIKE · EARLY BUILD</span><h1>Pokémon Tactics</h1></div><div className="top-status">{saveFailed && <span role="alert">Progress could not be saved in this browser. </span>}<button className="reset-run" onClick={() => setScreen('title')}>Title</button> · Column {Math.min(run.encounter + 1, ROUTE_COLUMNS)} / {ROUTE_COLUMNS} · {run.coins} coins · Pokémon {run.party.length} / {MAX_RUN_POKEMON}</div></header>}
    {screen === 'game' && <>
    {run.phase === 'starter' && <PartyBuilder selection={starterDraft} onSelectionChange={setStarterDraft} onStart={selection => setRun(newRun(selection, run.unlocks))} onBack={() => setScreen('title')} />}
    {run.phase === 'route' && <RouteScreen run={run} onChoose={id => setRun(previous => selectRouteNode(previous, id))} />}
    {run.phase === 'shop' && <main className="route-stop-screen"><section className="route-stop-panel"><span className="eyebrow">COLUMN {run.encounter + 1} · STORE</span><h2>Traveling Store</h2><p>You have <b>{run.coins} coins</b>. Purchased items go into your bag and can be assigned to a Pokémon during preparation.</p><div className="shop-grid">{SHOP_STOCK.map(offer => <button key={offer.item} type="button" disabled={run.coins < offer.price} onClick={() => { setRun(previous => buyShopItem(previous, offer.item)); gameAudio.playItem(offer.item); }}><img src={`/assets/ui/icons/item-${offer.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" /><span><strong>{offer.item}</strong><small>{itemFor(offer.item)?.description}</small></span><b>{offer.price} coins</b></button>)}</div><p>Bag: {run.bag.length ? run.bag.join(', ') : 'Empty'}</p><button className="primary" onClick={() => setRun(previous => advanceRoute(previous))}>Continue route →</button></section></main>}
    {run.phase === 'event' && <main className="route-stop-screen"><section className="route-stop-panel"><span className="eyebrow">COLUMN {run.encounter + 1} · SPECIAL</span><h2>A hidden clearing</h2><p>Two wandering Pokémon offer to join you. Nearby, you spot a cache of coins. Choose one reward.</p><div className="special-options">{offerRecruits(run).map(species => <button key={species} disabled={run.party.length >= MAX_RUN_POKEMON} onClick={() => setRun(previous => resolveSpecial(previous, { kind: 'recruit', species }))}><Sprite id={species} /><b>Recruit {SPECIES[species].name}</b><span>Free recruit · {run.party.length} / {MAX_RUN_POKEMON} owned</span></button>)}<button onClick={() => setRun(previous => resolveSpecial(previous, { kind: 'coins' }))}><b>Take the cache</b><span>Gain 18 coins</span></button></div></section></main>}
    {run.phase === 'prepare' && <PrepareScreen run={run} onToggle={toggleDeploy} onEquipMove={equipMove} onEquipItem={chooseItem} onDeploymentChange={deployment => patch(next => { next.deployment = deployment; })} onStart={start} />}
    {run.phase === 'battle' && battle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading battle…</h2></section></main>}><BattleScreen run={run} battle={battle} mode={mode} chosenMove={chosenMove} target={target} notice={notice} paused={paused} onTile={selectTile} onHoverTile={previewTile} onAnimationState={playing => { setAnimating(playing); setBoardReady(true); }} onMode={nextMode => { setMode(nextMode); setTarget(undefined); setNotice(''); if (nextMode !== 'attack') setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onMove={confirmMove} onAttack={attack} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next); return undefined; })) resetSelection(); }} onComplete={() => { setRun(completeBattle(run)); resetSelection(); }} onPause={() => setPaused(true)} /></Suspense>}
    {run.phase === 'intermission' && <main className="narrow"><section className="hero"><span className="eyebrow">ENCOUNTER CLEARED</span><h2>Party growth</h2><p>Every party member gained XP, including reserves. You can evolve eligible Pokémon now and adjust learned moves before the next battle.</p></section><div className="report">{run.report.map((item, i) => <p key={i}>{item}</p>)}</div><div className="prep-list">{run.party.map(mon => { const evolution = SPECIES[mon.species].evolves; return <article className="prep-card" key={mon.id}><div className="prep-head"><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small> Lv {mon.level} · {mon.hp}/{maxHp(mon)} HP</small></div></div><p>Learned: {mon.learned.map(pretty).join(', ')}</p>{evolution && mon.level >= evolution.level && <button onClick={() => setRun(evolve(run, mon.id))}>Evolve into {SPECIES[evolution.into].name}</button>}</article>; })}</div><div className="sticky-actions"><button className="primary" onClick={() => setRun(nextEncounter(run))}>{routeNode(run.route, run.currentNodeId)?.kind === 'boss' ? 'Complete run →' : 'Continue route →'}</button></div></main>}
    {run.phase === 'result' && <main className="narrow"><section className="hero result"><span className="eyebrow">RUN COMPLETE</span><h2>{run.result === 'win' ? 'Citadel secured' : 'Your team fell'}</h2><p>{run.result === 'win' ? 'The next run is ready. Your first victory has been saved locally.' : 'The route ends here. Try a different lead, moves, or terrain approach.'}</p><button className="primary" onClick={() => { setStarterDraft([]); setRun(freshRun(run.unlocks)); }}>Start a new run</button></section></main>}
    {paused && <div className="pause-backdrop" role="dialog" aria-modal="true" aria-label="Paused"><div className="pause-panel"><h2>Paused</h2><button autoFocus className="primary" onClick={() => { setPaused(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.battle-pause')?.focus()); }}>Resume</button><button onClick={() => { setPaused(false); setScreen('title'); }}>Title screen</button></div></div>}
    </>}
    {screen === 'lab' && labBattle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading Battle Lab…</h2></section></main>}><BattleScreen key={labSession} run={run} battle={labBattle} labSeed={labConfig.seed} controlBoth mode={mode} chosenMove={chosenMove} target={target} notice={notice} paused={false} onTile={selectTile} onHoverTile={previewTile} onAnimationState={playing => { setAnimating(playing); setBoardReady(true); }} onMode={nextMode => { setMode(nextMode); setTarget(undefined); setNotice(''); if (nextMode !== 'attack') setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onMove={confirmMove} onAttack={attack} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next); return undefined; })) resetSelection(); }} onComplete={startLab} onPause={() => { setAnimating(false); setScreen('lab-setup'); }} onLabReset={startLab} /></Suspense>}
    {screen === 'game' && (run.phase === 'intermission' || run.phase === 'result') && <footer>Fan prototype · original placeholder art and audio · local browser save · <a href="/assets/animations/animation-manifest.json">Animation manifest</a> · <a href="/assets/audio/audio-manifest.json">Audio manifest</a></footer>}
  </div>;
}
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
