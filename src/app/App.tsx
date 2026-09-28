import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import PrepareScreen from '../ui/PrepareScreen';
import PartyBuilder from '../ui/PartyBuilder';
import RouteScreen from '../ui/RouteScreen';
import RouteStopScreen from '../ui/RouteStopScreen';
import IntermissionScreen from '../ui/IntermissionScreen';
import ResultScreen from '../ui/ResultScreen';
import TitleScreen from '../ui/TitleScreen';
import type { TitleView } from '../ui/TitleScreen';
import { itemCanEquip, itemFor, MAX_EQUIPPED_MOVES, MOVES } from '../content/data';
import { MAX_RUN_POKEMON } from '../content/roster';
import { active, advanceRoute, buyShopItem, commitEnemyAction, completeBattle, createLabBattle, evolve, finishTurn, moveUnit, newRun, nextEncounter, passTurn, resolveSpecial, selectRouteNode, startBattle, useMove, useSpecial, unitAt } from '../game/engine';
import { ROUTE_COLUMNS } from '../game/route';
import { EnemyPlanner } from '../game/enemyPlanner';
import { cloneBattleForCommand } from '../game/clone';
import type { LabConfig } from '../game/engine';
import type { Battle, Run } from '../game/types';
import type { ItemId } from '../content/items';
import { freshRun, saveRun } from '../persistence/save';
import { gameAudio } from '../audio/audio';

const BattleScreen = lazy(() => import('../ui/BattleScreen'));
const defaultLab: LabConfig = { allySpecies: 'bulbasaur', enemySpecies: 'charmander', allyLevel: 13, enemyLevel: 13, allyItem: 'None', enemyItem: 'None', weather: 'clear', seed: 12345 };

export default function App({ initialRun }: { initialRun: Run }) {
  const [run, setRun] = useState<Run>(initialRun);
  const [starterDraft, setStarterDraft] = useState<string[]>([]);
  const [screen, setScreen] = useState<TitleView | 'game' | 'lab'>('splash');
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
    const mon = next.party.find(p => p.id === monId);
    if (!mon || !Number.isInteger(slot) || slot < 0 || slot >= MAX_EQUIPPED_MOVES || !mon.learned.includes(moveId)) return;
    const previousSlot = mon.equipped.indexOf(moveId);
    if (previousSlot === slot) return;
    if (previousSlot >= 0) mon.equipped[previousSlot] = mon.equipped[slot];
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
    {screen !== 'game' && screen !== 'lab' && <TitleScreen view={screen} canContinue={run.phase !== 'starter' && run.phase !== 'result'} saveFailed={saveFailed} soundMuted={soundMuted} labConfig={labConfig} setLabConfig={setLabConfig} onViewChange={setScreen} onContinue={() => setScreen('game')} onNewRun={() => { if (run.phase !== 'starter' && !window.confirm('Start a new run? This replaces the current saved run.')) return; setStarterDraft([]); setRun(freshRun(run.unlocks)); resetSelection(); setAnimating(false); setScreen('game'); }} onStartLab={startLab} onSoundMutedChange={muted => { gameAudio.setMuted(muted); setSoundMuted(muted); if (!muted) void gameAudio.unlock(); }} />}
    {screen === 'game' && run.phase !== 'battle' && run.phase !== 'starter' && run.phase !== 'route' && <header className="topbar"><div><span className="eyebrow">TACTICAL ROGUELIKE · EARLY BUILD</span><h1>Pokémon Tactics</h1></div><div className="top-status">{saveFailed && <span role="alert">Progress could not be saved in this browser. </span>}<button className="reset-run" onClick={() => setScreen('title')}>Title</button> · Column {Math.min(run.encounter + 1, ROUTE_COLUMNS)} / {ROUTE_COLUMNS} · {run.coins} coins · Pokémon {run.party.length} / {MAX_RUN_POKEMON}</div></header>}
    {screen === 'game' && <>
    {run.phase === 'starter' && <PartyBuilder selection={starterDraft} onSelectionChange={setStarterDraft} onStart={selection => setRun(newRun(selection, run.unlocks))} onBack={() => setScreen('title')} />}
    {run.phase === 'route' && <RouteScreen run={run} onChoose={id => setRun(previous => selectRouteNode(previous, id))} onBack={() => setScreen('title')} />}
    {(run.phase === 'shop' || run.phase === 'event') && <RouteStopScreen run={run} onBuy={item => { setRun(previous => buyShopItem(previous, item)); gameAudio.playItem(item); }} onContinue={() => setRun(previous => advanceRoute(previous))} onRecruit={(species, replaceId) => setRun(previous => resolveSpecial(previous, { kind: 'recruit', species, replaceId }))} onTakeCoins={() => setRun(previous => resolveSpecial(previous, { kind: 'coins' }))} />}
    {run.phase === 'prepare' && <PrepareScreen run={run} onToggle={toggleDeploy} onEquipMove={equipMove} onEquipItem={chooseItem} onDeploymentChange={deployment => patch(next => { next.deployment = deployment; })} onStart={start} />}
    {run.phase === 'battle' && battle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading battle…</h2></section></main>}><BattleScreen run={run} battle={battle} mode={mode} chosenMove={chosenMove} target={target} notice={notice} paused={paused} onTile={selectTile} onHoverTile={previewTile} onAnimationState={playing => { setAnimating(playing); setBoardReady(true); }} onMode={nextMode => { setMode(nextMode); setTarget(undefined); setNotice(''); setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next); return undefined; })) resetSelection(); }} onComplete={() => { setRun(completeBattle(run)); resetSelection(); }} onPause={() => setPaused(true)} /></Suspense>}
    {run.phase === 'intermission' && <IntermissionScreen run={run} onEvolve={id => setRun(evolve(run, id))} onContinue={() => setRun(nextEncounter(run))} />}
    {run.phase === 'result' && <ResultScreen run={run} onNewRun={() => { setStarterDraft([]); setRun(freshRun(run.unlocks)); }} />}
    {paused && <div className="pause-backdrop" role="dialog" aria-modal="true" aria-label="Paused"><div className="pause-panel"><h2>Paused</h2><button autoFocus className="primary" onClick={() => { setPaused(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.battle-pause')?.focus()); }}>Resume</button><button onClick={() => { setPaused(false); setScreen('title'); }}>Title screen</button></div></div>}
    </>}
    {screen === 'lab' && labBattle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading Battle Lab…</h2></section></main>}><BattleScreen key={labSession} run={run} battle={labBattle} labSeed={labConfig.seed} controlBoth mode={mode} chosenMove={chosenMove} target={target} notice={notice} paused={false} onTile={selectTile} onHoverTile={previewTile} onAnimationState={playing => { setAnimating(playing); setBoardReady(true); }} onMode={nextMode => { setMode(nextMode); setTarget(undefined); setNotice(''); setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next); return undefined; })) resetSelection(); }} onComplete={startLab} onPause={() => { setAnimating(false); setScreen('lab-setup'); }} onLabReset={startLab} /></Suspense>}
    {screen === 'game' && (run.phase === 'intermission' || run.phase === 'result') && <footer>Fan prototype · original placeholder art and audio · local browser save · <a href="/assets/animations/animation-manifest.json">Animation manifest</a> · <a href="/assets/audio/audio-manifest.json">Audio manifest</a></footer>}
  </div>;
}
