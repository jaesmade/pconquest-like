/** Developer-only UI gallery. No persistence or audio APIs are imported. */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { itemCanEquip, itemFor, MOVES, SPECIES } from '../src/content/data';
import type { ItemId } from '../src/content/items';
import {
  advanceRoute, buyShopItem, cancelPreparation, completeBattle, defaultLoadoutAtLevel,
  evolve, learnedAtLevel, newRun, nextEncounter, recruit, resolveLevelMove,
  resolveSpecial, selectRouteNode, startBattle, statsAtLevel, teachTm,
  useEvolutionItem, xpForLevel, type LabConfig,
} from '../src/game/engine';
import { createRoute, ROUTE_COLUMNS, type RouteNode, type RoutePlan } from '../src/game/route';
import type { Run } from '../src/game/types';
import IntermissionScreen from '../src/ui/IntermissionScreen';
import PartyBuilder from '../src/ui/PartyBuilder';
import PrepareScreen from '../src/ui/PrepareScreen';
import ResultScreen from '../src/ui/ResultScreen';
import RouteScreen from '../src/ui/RouteScreen';
import RouteStopScreen from '../src/ui/RouteStopScreen';
import TitleScreen, { type TitleView } from '../src/ui/TitleScreen';
import '../src/styles/base.css';
import '../src/styles/battle.css';
import '../src/styles/menus.css';
import '../src/styles/route.css';
import '../src/styles/battle-actions.css';
import '../src/styles/theme.css';
import '../src/styles/party-builder.css';
import '../src/styles/battle-menu.css';
import '../src/styles/route-overlays.css';
import '../src/styles/route-party.css';
import '../src/styles/deployment.css';
import '../src/styles/pixel-system.css';

const screens = ['splash', 'title', 'options', 'exit', 'lab', 'draft', 'draft-full', 'route', 'route-full', 'shop', 'event', 'event-loss', 'recruit', 'recruit-full', 'prepare', 'prepare-full', 'growth', 'growth-clear', 'growth-full', 'win', 'loss'] as const;
type PreviewScreen = typeof screens[number];
const titleScreens = new Set<PreviewScreen>(['splash', 'title', 'options', 'exit', 'lab']);
const seed = 0x127501;
const defaultDraft = ['bulbasaur', 'pikachu', 'squirtle'];

function pathTo(route: RoutePlan, node: RouteNode): string[] {
  if (node.column === 1) return [node.id];
  const parent = route.links.find(link => link.to === node.id);
  const from = route.nodes.find(candidate => candidate.id === parent?.from);
  if (!from) throw new Error(`Preview route lacks a path to ${node.id}`);
  return [...pathTo(route, from), node.id];
}

function baseRun(count = 8): Run {
  let run = newRun(defaultDraft);
  const roster = ['vulpix', 'charmander', 'lapras', 'geodude', 'meowth', ...Object.keys(SPECIES).filter(id => !SPECIES[id].form)];
  for (const species of [...new Set(roster)]) {
    if (run.party.length >= count) break;
    if (!run.party.some(mon => mon.species === species)) run = recruit(run, species);
  }
  // Repeated species are legal recruits; fill the cap even with this small catalog.
  while (run.party.length < count) run = recruit(run, roster[run.party.length % roster.length]);
  // Deterministic display data: wounded allies, one fainted reserve, a ready evolution.
  run.party = run.party.map((mon, index) => {
    const level = index === 0 ? 16 : 10 + index % 8;
    const maxHp = statsAtLevel(mon.species, level)[0];
    return { ...mon, id: `preview-mon-${index}`, level, xp: xpForLevel(level),
      hp: index === 6 ? 0 : Math.max(1, maxHp - index * 3),
      learned: learnedAtLevel(mon.species, level), equipped: defaultLoadoutAtLevel(mon.species, level) };
  });
  return { ...run, seed, rngState: seed, route: createRoute(seed), coins: 32,
    selected: run.party.slice(0, 6).map(mon => mon.id),
    bag: ['TM Swift', 'TM Thunderbolt', 'Fire Stone', 'Sitrus Berry', 'Sitrus Berry', 'X Attack', 'Leftovers', 'Charizardite X'],
  };
}

function chooseFixtureNode(run: Run, node: RouteNode): Run {
  const path = pathTo(run.route, node);
  return selectRouteNode({ ...run, phase: 'route', route: { ...run.route, visited: path.slice(0, -1) }, encounter: node.column - 1, currentNodeId: undefined }, node.id);
}

function growthFixture(run: Run, pending = true): Run {
  const node = run.route.nodes.find(candidate => candidate.kind === 'elite')!;
  let prepared = chooseFixtureNode(run, node);
  prepared = { ...prepared, party: prepared.party.map((mon, index) => {
    if (index >= 4) return mon;
    const entry = Object.entries(SPECIES[mon.species].learn).find(([at, move]) => Number(at) >= 11 && defaultLoadoutAtLevel(mon.species, Number(at) - 1).length >= 4 && !defaultLoadoutAtLevel(mon.species, Number(at) - 1).includes(move));
    const level = entry ? Number(entry[0]) - 1 : mon.level;
    return { ...mon, level, xp: xpForLevel(level), hp: statsAtLevel(mon.species, level)[0] - 8,
      learned: learnedAtLevel(mon.species, level), equipped: defaultLoadoutAtLevel(mon.species, level) };
  }) };
  const fighting = startBattle(prepared);
  if (!fighting.battle) throw new Error('Preview battle could not be initialized.');
  // UI review intentionally resolves a fixture victory; no battle command/save is changed.
  fighting.battle.result = 'win';
  let won = completeBattle(fighting);
  if (pending && !won.pendingMoves.length) {
    const mon = won.party[0];
    const moveId = Object.keys(MOVES).find(id => !mon.equipped.includes(id))!;
    won = { ...won, pendingMoves: [{ monId: mon.id, moveId }], party: won.party.map(candidate => candidate.id === mon.id ? { ...candidate, learned: [...candidate.learned, moveId] } : candidate) };
  }
  if (!pending) while (won.pendingMoves.length) {
    const offer = won.pendingMoves[0];
    won = resolveLevelMove(won, offer.monId, offer.moveId);
  }
  return won;
}

function fixture(screen: PreviewScreen): Run {
  const run = baseRun(screen.endsWith('-full') ? 20 : 8);
  if (screen === 'shop') return chooseFixtureNode(run, run.route.nodes.find(node => node.kind === 'store')!);
  if (screen === 'event' || screen === 'event-loss') return { ...chooseFixtureNode(run, run.route.nodes.find(node => node.kind === 'special')!), pendingRouteEvent: screen === 'event-loss' ? { kind: 'ambush' } : { kind: 'coins', amount: 80 } };
  if (screen === 'recruit' || screen === 'recruit-full') return chooseFixtureNode(run, run.route.nodes.find(node => node.kind === 'recruit')!);
  if (screen === 'prepare' || screen === 'prepare-full') return chooseFixtureNode(run, run.route.nodes.find(node => node.kind === 'elite')!);
  if (screen === 'growth' || screen === 'growth-full' || screen === 'growth-clear') return growthFixture(run, screen !== 'growth-clear');
  if (screen === 'win' || screen === 'loss') {
    const node = run.route.nodes.find(candidate => screen === 'win' ? candidate.kind === 'boss' : candidate.column === 7)!;
    return { ...run, phase: 'result', result: screen === 'win' ? 'win' : 'loss', currentNodeId: node.id, encounter: node.column - 1, route: { ...run.route, visited: pathTo(run.route, node) } };
  }
  const anchor = run.route.nodes.find(node => node.column === 3 && node.kind === 'special')!;
  return { ...run, encounter: 3, route: { ...run.route, visited: pathTo(run.route, anchor) } };
}

const queried = new URLSearchParams(location.search).get('screen') as PreviewScreen;
const initialScreen = screens.includes(queried) ? queried : 'route';

function Preview() {
  const [screen, setScreen] = useState<PreviewScreen>(initialScreen);
  const [run, setRun] = useState(() => fixture(initialScreen));
  const [draft, setDraft] = useState(initialScreen === 'draft-full' ? defaultDraft : []);
  const [muted, setMuted] = useState(false);
  const [labConfig, setLabConfig] = useState<LabConfig>({ allySpecies: 'bulbasaur', enemySpecies: 'charmander', allyLevel: 13, enemyLevel: 13, allyItem: 'None', enemyItem: 'None', weather: 'clear', seed: 12345 });

  const navigate = (next: PreviewScreen) => {
    const url = new URL(location.href);
    url.searchParams.set('screen', next);
    history.replaceState(null, '', url);
    setScreen(next);
    setRun(fixture(next));
    setDraft(next === 'draft-full' ? defaultDraft : []);
  };
  useEffect(() => {
    if (screen !== 'splash') return;
    const key = (event: KeyboardEvent) => { if (!['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) navigate('title'); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [screen]);

  const equip = (monId: string, item: string) => setRun(previous => {
    const mon = previous.party.find(candidate => candidate.id === monId);
    if (previous.phase !== 'route' || !mon || !itemFor(item) || !itemCanEquip(item, mon.species) || (item !== 'None' && !previous.bag.includes(item as ItemId)) || item === mon.item) return previous;
    const next = structuredClone(previous), recipient = next.party.find(candidate => candidate.id === monId)!;
    if (recipient.item !== 'None') next.bag.push(recipient.item);
    if (item !== 'None') next.bag.splice(next.bag.indexOf(item as ItemId), 1);
    recipient.item = item as ItemId;
    return next;
  });
  const route = (backdropOnly = false) => <RouteScreen run={run} backdropOnly={backdropOnly} onBack={() => navigate('title')} onChoose={id => setRun(previous => selectRouteNode(previous, id))} onEquipItem={equip} onEvolve={id => setRun(previous => evolve(previous, id))} onTeachTm={(item, id, slot) => setRun(previous => teachTm(previous, item, id, slot))} onUseEvolutionItem={(item, id) => setRun(previous => useEvolutionItem(previous, item, id))} />;
  const isTitle = titleScreens.has(screen), isDraft = screen === 'draft' || screen === 'draft-full';
  const topbar = !isTitle && !isDraft && ['shop', 'event', 'result'].includes(run.phase);

  return <div className="app-shell">
    <style>{`.ui-review-menu{position:fixed;right:8px;bottom:8px;z-index:200;max-width:280px;border:2px solid #17303e;background:#f7f7e9;box-shadow:3px 3px 0 #17303e;color:#17303e;font:12px/1.4 monospace}.ui-review-menu summary{cursor:pointer;padding:6px 8px;min-height:28px}.ui-review-menu>div{display:grid;gap:8px;padding:10px}.ui-review-menu label{display:grid;gap:5px}.ui-review-menu select{width:100%;font-size:14px}.ui-review-menu p{font:12px/1.4 monospace;color:#17303e;margin:0}.ui-review-menu button{min-height:36px;font-size:14px;border:2px solid #17303e;background:#ffcb3d}.app-shell:has(.route-party-overlay)>.ui-review-menu{display:none}`}</style>
    <details className="ui-review-menu"><summary>UI review</summary><div><p>Isolated fixtures. Nothing on this page writes your saved run.</p><label>Scenario<select aria-label="UI review scenario" value={screen} onChange={event => navigate(event.target.value as PreviewScreen)}>{screens.map(name => <option value={name} key={name}>{name}</option>)}</select></label><button type="button" onClick={() => navigate(screen)}>Reset fixture</button><p>Preparation’s Enter battle previews a resolved fixture victory.</p></div></details>
    {isTitle && <TitleScreen view={screen === 'lab' ? 'lab-setup' : screen as TitleView} canContinue saveFailed={false} soundMuted={muted} labConfig={labConfig} setLabConfig={setLabConfig} continueSummary="Column 4 / 10 · 8 Pokémon · 32 coins" onViewChange={view => navigate(view === 'lab-setup' ? 'lab' : view)} onContinue={() => navigate('route')} onNewRun={() => navigate('draft')} onStartLab={() => navigate('prepare')} onSoundMutedChange={setMuted} />}
    {isDraft && <PartyBuilder selection={draft} onSelectionChange={setDraft} onBack={() => navigate('title')} onStart={selection => { setRun({ ...newRun(selection), seed, rngState: seed, route: createRoute(seed) }); setScreen('route'); }} />}
    {topbar && <header className="topbar"><div><span className="eyebrow">TACTICAL ROGUELIKE · EARLY BUILD</span><h1>Pokémon Tactics</h1></div><div className="top-status"><button className="reset-run" onClick={() => navigate('title')}>Title</button> · Column {Math.min(run.encounter + 1, ROUTE_COLUMNS)} / {ROUTE_COLUMNS} · {run.coins} coins · Pokémon {run.party.length} / 20</div></header>}
    {!isTitle && !isDraft && <>
      {(run.phase === 'prepare' || run.phase === 'intermission') && <div className="route-scene-backdrop" aria-hidden="true">{route(true)}</div>}
      {run.phase === 'route' && route()}
      {(run.phase === 'shop' || run.phase === 'event') && <RouteStopScreen run={run} onBuy={item => setRun(previous => buyShopItem(previous, item))} onContinue={() => setRun(previous => advanceRoute(previous))} onRecruit={(species, replaceId) => setRun(previous => resolveSpecial(previous, { kind: 'recruit', species, replaceId }))} onClaim={() => setRun(previous => resolveSpecial(previous, { kind: 'claim' }))} />}
      {run.phase === 'prepare' && <PrepareScreen run={run} onToggle={id => setRun(previous => ({ ...previous, selected: previous.selected.includes(id) ? previous.selected.filter(candidate => candidate !== id) : previous.selected.length < 6 ? [...previous.selected, id] : previous.selected }))} onDeploymentChange={deployment => setRun(previous => ({ ...previous, deployment }))} onBack={() => setRun(previous => cancelPreparation(previous))} onStart={() => setRun(previous => { const playing = startBattle(previous); if (playing.battle) playing.battle.result = 'win'; return completeBattle(playing); })} />}
      {run.phase === 'intermission' && <IntermissionScreen key={`${screen}-${run.currentNodeId}`} run={run} onChooseMove={(id, move, slot) => setRun(previous => resolveLevelMove(previous, id, move, slot))} onContinue={() => setRun(previous => nextEncounter(previous))} />}
      {run.phase === 'result' && <ResultScreen run={run} onTitle={() => navigate('title')} onNewRun={() => navigate('draft')} />}
      {run.phase === 'result' && <footer>Fan prototype · original placeholder art and audio · local browser save · <a href="/assets/animations/animation-manifest.json">Animation manifest</a> · <a href="/assets/audio/audio-manifest.json">Audio manifest</a></footer>}
    </>}
  </div>;
}

// Keep the module independent of production App and every persistence API.
createRoot(document.getElementById('root')!).render(<Preview />);
