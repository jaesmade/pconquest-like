import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Sprite from './ui/Sprite';
import { ENCOUNTERS, itemCanEquip, itemFor, ITEMS, MAPS, MOVES, SPECIES, STARTERS } from './content/data';
import { active, advanceEnemies, applyRouteChoice, completeBattle, evolve, finishTurn, moveUnit, newRun, nextEncounter, passTurn, startBattle, useMove, useSpecial, unitAt } from './game/engine';
import type { PartyMon, Run } from './game/types';
import type { ItemId } from './content/items';
import { freshRun, loadRun, saveRun } from './persistence/save';
import { validateCatalog } from './content/catalog';
import './style.css';

const BattleScreen = lazy(() => import('./ui/BattleScreen'));
const pretty = (id: string) => MOVES[id]?.name ?? id;
const maxHp = (mon: PartyMon) => Math.round(SPECIES[mon.species].stats[0] * (1 + 0.07 * (mon.level - 2)));

function App() {
  const [run, setRun] = useState<Run>(loadRun);
  const [mode, setMode] = useState<'inspect' | 'move' | 'attack'>('inspect');
  const [chosenMove, setChosenMove] = useState('');
  const [target, setTarget] = useState<[number, number] | undefined>();
  const [notice, setNotice] = useState('');
  const [animating, setAnimating] = useState(false);
  useEffect(() => { saveRun(run); }, [run]);
  const battle = run.battle;
  const encounter = ENCOUNTERS.find(entry => entry.id === run.encounterId)!;
  const current = battle && !battle.result ? active(battle) : undefined;
  const patch = (change: (next: Run) => void) => setRun(previous => { const next = structuredClone(previous); change(next); return next; });
  const battleAction = (change: (next: Run) => string | undefined) => {
    if (animating) return false;
    const next: Run = { ...run, battle: run.battle ? structuredClone(run.battle) : undefined };
    const message = change(next);
    if (message) { setNotice(message); return false; }
    if (next.battle?.visualEvents.at(-1)?.id !== run.battle?.visualEvents.at(-1)?.id) setAnimating(true);
    setNotice(''); setRun(next);
    return true;
  };
  const resetSelection = () => { setMode('inspect'); setChosenMove(''); setTarget(undefined); };
  const selectTile = (x: number, y: number) => {
    if (!battle || battle.result || animating || current?.side !== 'player') return;
    if (mode === 'move') {
      const success = battleAction(next => { const error = moveUnit(next.battle!, x, y); if (!error) finishTurn(next.battle!); return error; });
      if (success) resetSelection();
    }
    else if (mode === 'attack') { if (chosenMove) setTarget([x, y]); else setNotice('Choose a move first.'); }
    else { const unit = unitAt(battle, x, y); if (unit) setNotice(`${unit.name} · ${unit.types.join('/')} · ${unit.hp}/${unit.maxHp} HP · ${unit.ability}`); else setNotice(`${battle.map.tiles[y][x].kind} · elevation ${battle.map.tiles[y][x].height}`); }
  };
  const attack = () => {
    if (animating || !target || !chosenMove) return;
    const success = battleAction(next => { const error = useMove(next.battle!, chosenMove, target[0], target[1]); if (!error) finishTurn(next.battle!); return error; });
    if (success) resetSelection();
  };
  const special = () => {
    const success = battleAction(next => { const error = useSpecial(next.battle!); if (!error) finishTurn(next.battle!); return error; });
    if (success) resetSelection();
  };
  const start = () => {
    let next = startBattle(run);
    if (next.battle) advanceEnemies(next.battle);
    setAnimating(!!next.battle?.visualEvents.length);
    setRun(next); resetSelection();
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

  return <div className={animating ? "app-shell animating" : "app-shell"}>
    <header className="topbar"><div><span className="eyebrow">TACTICAL ROGUELIKE · EARLY BUILD</span><h1>Pokémon Tactics</h1></div><div className="top-status">{run.phase !== 'starter' && <>Encounter {Math.min(run.encounter + 1, ENCOUNTERS.length)} / {ENCOUNTERS.length} · Party {run.party.length} / 6 <button className="reset-run" onClick={() => { setRun(freshRun(run.unlocks)); resetSelection(); setAnimating(false); }}>New run</button></>}</div></header>
    {run.phase === 'starter' && <main className="narrow"><section className="hero"><span className="eyebrow">NEW RUN</span><h2>Choose your lead Pokémon</h2><p>Two companions join your starting party. Pick three before each tactical battle and grow your team along the route.</p></section><div className="starter-grid">{STARTERS.map(id => <button className="starter-card" key={id} onClick={() => setRun(newRun(id, run.unlocks))}><Sprite id={id} /><strong>{SPECIES[id].name}</strong><span>{SPECIES[id].types.join(' / ')}</span><small>{SPECIES[id].ability} · {SPECIES[id].moves.map(pretty).join(' / ')}</small></button>)}</div></main>}
    {run.phase === 'route' && <main className="narrow"><section className="hero"><span className="eyebrow">ROUTE {run.encounter + 1}</span><h2>{MAPS[encounter.mapId].name}</h2><p>Choose a stop before the next encounter. Rest restores 40% max HP to the whole party. Recruit adds a Pokémon until the party reaches six.</p></section><div className="route-choice"><button className="choice" onClick={() => setRun(applyRouteChoice(run, 'rest'))}><b>✚ Rest camp</b><span>Restore and revive your party.</span></button><button className="choice" disabled={run.party.length >= 6} onClick={() => setRun(applyRouteChoice(run, 'recruit'))}><b>◇ Recruit trail</b><span>Meet another Pokémon for your run.</span></button></div><PartyList run={run} /></main>}
    {run.phase === 'prepare' && <main className="narrow"><section className="hero"><span className="eyebrow">BATTLE PREPARATION</span><h2>Deploy up to three</h2><p>{MAPS[encounter.mapId].name} · Starting weather: {MAPS[encounter.mapId].weather}. Select healthy Pokémon, equip two learned moves each, and assign held items.</p></section><div className="prep-list">{run.party.map(mon => <article className={`prep-card ${run.selected.includes(mon.id) ? 'selected' : ''}`} key={mon.id}><div className="prep-head"><label><input type="checkbox" checked={run.selected.includes(mon.id)} disabled={mon.hp <= 0 || (!run.selected.includes(mon.id) && run.selected.length >= 3)} onChange={() => toggleDeploy(mon.id)} /> Deploy</label><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small> Lv {mon.level} · {mon.hp}/{maxHp(mon)} HP · {SPECIES[mon.species].types.join('/')}</small></div></div><div className="prep-controls"><label>Move 1 <select value={mon.equipped[0]} onChange={event => equipMove(mon.id, event.target.value, 0)}>{mon.learned.map(id => <option value={id} key={id}>{pretty(id)}</option>)}</select></label><label>Move 2 <select value={mon.equipped[1]} onChange={event => equipMove(mon.id, event.target.value, 1)}>{mon.learned.map(id => <option value={id} key={id}>{pretty(id)}</option>)}</select></label><label>Held item <select value={mon.item} onChange={event => equipItem(mon.id, event.target.value)}>{[mon.item, ...ITEMS.filter(item => (item === 'None' || run.bag.includes(item)) && itemCanEquip(item, mon.species))].filter((item, index, all) => all.indexOf(item) === index).map(item => <option key={item}>{item}</option>)}</select></label></div></article>)}</div><div className="sticky-actions"><span>{run.selected.length} / 3 selected</span><button className="primary" disabled={!run.selected.some(id => run.party.some(mon => mon.id === id && mon.hp > 0))} onClick={start}>Enter battle →</button></div></main>}
    {run.phase === 'battle' && battle && <Suspense fallback={<main className="narrow"><section className="hero"><h2>Loading battle…</h2></section></main>}><BattleScreen run={run} battle={battle} mode={mode} chosenMove={chosenMove} target={target} notice={notice} onTile={selectTile} onAnimationState={setAnimating} onMode={nextMode => { setMode(nextMode); setTarget(undefined); if (nextMode === 'move') setChosenMove(''); }} onChooseMove={id => { setChosenMove(id); setTarget(MOVES[id].target === 'self' && current ? [current.x, current.y] : undefined); }} onAttack={attack} onSpecial={special} onPass={() => { if (battleAction(next => { passTurn(next.battle!); return undefined; })) resetSelection(); }} onComplete={() => { setRun(completeBattle(run)); resetSelection(); }} /></Suspense>}
    {run.phase === 'intermission' && <main className="narrow"><section className="hero"><span className="eyebrow">ENCOUNTER CLEARED</span><h2>Party growth</h2><p>Every party member gained XP, including reserves. You can evolve eligible Pokémon now and adjust learned moves before the next battle.</p></section><div className="report">{run.report.map((item, i) => <p key={i}>{item}</p>)}</div><div className="prep-list">{run.party.map(mon => { const evolution = SPECIES[mon.species].evolves; return <article className="prep-card" key={mon.id}><div className="prep-head"><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small> Lv {mon.level} · {mon.hp}/{maxHp(mon)} HP</small></div></div><p>Learned: {mon.learned.map(pretty).join(', ')}</p>{evolution && mon.level >= evolution.level && <button onClick={() => setRun(evolve(run, mon.id))}>Evolve into {SPECIES[evolution.into].name}</button>}</article>; })}</div><div className="sticky-actions"><button className="primary" onClick={() => setRun(nextEncounter(run))}>{!encounter.nextId ? 'Complete run →' : 'Continue route →'}</button></div></main>}
    {run.phase === 'result' && <main className="narrow"><section className="hero result"><span className="eyebrow">RUN COMPLETE</span><h2>{run.result === 'win' ? 'Citadel secured' : 'Your team fell'}</h2><p>{run.result === 'win' ? 'The next run is ready. Your first victory has been saved locally.' : 'The route ends here. Try a different lead, moves, or terrain approach.'}</p><button className="primary" onClick={() => setRun(freshRun(run.unlocks))}>Start a new run</button></section></main>}
    <footer>Fan prototype · original placeholder art · local browser save · <a href="/assets/animations/animation-manifest.json">Animation manifest</a></footer>
  </div>;
}
function PartyList({ run }: { run: Run }) { return <section className="party-list"><span className="eyebrow">YOUR PARTY</span>{run.party.map(mon => <div key={mon.id}><Sprite id={mon.species} /><b>{SPECIES[mon.species].name}</b><span>Lv {mon.level}</span><span>{mon.hp}/{maxHp(mon)} HP</span><small>{mon.item}</small></div>)}</section>; }

const contentErrors = validateCatalog();
createRoot(document.getElementById('root')!).render(contentErrors.length
  ? <main className="narrow"><h1>Content needs attention</h1><p>Fix these catalog references before starting a run:</p><ul>{contentErrors.map(error => <li key={error}>{error}</li>)}</ul></main>
  : <React.StrictMode><App /></React.StrictMode>);
