import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import Board from '../src/battle/Board';
import DeploymentBoard from '../src/ui/DeploymentBoard';
import { MAPS } from '../src/content/maps';
import { newRun, startBattle } from '../src/game/engine';
import { syncMobility } from '../src/game/mobility';
import '../src/styles/base.css';
import '../src/styles/battle.css';
import '../src/styles/route.css';
import '../src/styles/deployment.css';

function ForestPreview() {
  const [mapId, setMapId] = useState('mossveil-grove');
  const [mode, setMode] = useState<'battle' | 'deployment'>('battle');
  const [ready, setReady] = useState(false);
  const [cameraAction, setCameraAction] = useState({ id: 0, command: 'fit' as const });
  const map = MAPS[mapId];
  useEffect(() => { setReady(false); }, [mapId, mode]);
  useEffect(() => { if (ready) setCameraAction(previous => ({ id: previous.id + 1, command: 'fit' })); }, [ready]);
  const { battle, party, placements } = useMemo(() => {
    const run = startBattle(newRun(['bulbasaur', 'charmander', 'squirtle']));
    const battle = run.battle!;
    battle.map = structuredClone(map);
    battle.weather = map.weather;
    battle.objective = map.capture ? 'defeat-and-capture' : 'defeat';
    for (const side of ['player', 'enemy'] as const) battle.units.filter(unit => unit.side === side).forEach((unit, index) => {
      [unit.x, unit.y] = (side === 'player' ? map.playerSpawns : map.enemySpawns)[index];
      syncMobility(unit, map.tiles[unit.y][unit.x]);
    });
    return { battle, party: run.party, placements: Object.fromEntries(run.party.map((mon, index) => [mon.id, map.playerSpawns[index]])) };
  }, [map]);
  return <main className="forest-preview">
    <header>
      <div><p>WOODLAND EXPEDITIONS</p><h1>{map.name}</h1></div>
      <label>Battlefield <select value={mapId} onChange={event => setMapId(event.target.value)}>{Object.values(MAPS).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <div className="forest-preview-actions">
        <button aria-pressed={mode === 'battle'} onClick={() => setMode('battle')}>Battle view</button>
        <button aria-pressed={mode === 'deployment'} onClick={() => setMode('deployment')}>Deployment view</button>
        {mode === 'battle' && <button onClick={() => setCameraAction(previous => ({ id: previous.id + 1, command: 'fit' }))}>Fit map</button>}
      </div>
    </header>
    <section aria-label={map.name}>
      {mode === 'battle' ? <Board key={mapId} battle={battle} mode="inspect" onTile={() => {}} cameraAction={cameraAction}
        onViewChange={() => { setReady(true); }} />
        : <DeploymentBoard map={map} selected={party} placements={placements} onPlace={() => {}} />}
    </section>
    <footer>{map.tiles[0].length} × {map.tiles.length} · {map.weather} weather · {mode === 'deployment' ? 'Deployment layout' : ready ? 'Drag to explore, scroll to zoom' : 'Loading woodland...'}</footer>
    <style>{`
      html, body, #root { margin:0; width:100%; height:100%; background:#101f27; }
      .forest-preview { height:100dvh; display:flex; flex-direction:column; color:#e8edd3; }
      .forest-preview header { display:flex; align-items:center; gap:24px; flex-wrap:wrap; padding:18px 26px; background:#182e32; border-bottom:1px solid #3c5550; }
      .forest-preview header p { margin:0 0 5px; color:#b4cd83; font-size:10px; letter-spacing:3px; }
      .forest-preview h1 { margin:0; font-size:23px; }
      .forest-preview label { margin-left:auto; display:flex; flex-direction:column; gap:5px; font-size:11px; color:#b4c6b4; }
      .forest-preview select { background:#243d3c; color:#e8edd3; padding:8px 12px; border:1px solid #648273; border-radius:6px; }
      .forest-preview-actions { display:flex; gap:8px; }
      .forest-preview button { background:#243d3c; color:#e8edd3; border:1px solid #648273; padding:9px 12px; border-radius:6px; }
      .forest-preview button[aria-pressed="true"] { background:#b4cd83; color:#1c332b; }
      .forest-preview section { min-height:0; flex:1; position:relative; }
      .forest-preview .board { position:absolute; width:100%; height:100%; }
      .forest-preview .deploy-map-wrap { height:100%; width:100%; border:0; border-radius:0; }
      .forest-preview .deploy-map { width:100%; height:100%; max-height:none; }
      .forest-preview footer { padding:10px 26px; font-size:11px; color:#abc1ac; background:#182e32; }
      @media(max-width:680px) { .forest-preview header { padding:12px; gap:12px; } .forest-preview h1 { font-size:18px; } .forest-preview label { margin-left:0; } }
    `}</style>
  </main>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<ForestPreview />);
import.meta.hot?.dispose(() => root.unmount());
