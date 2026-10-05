import { useMemo, useState } from 'react';
import { MAPS, MOVES, SPECIES } from '../content/data';
import { defaultLoadoutAtLevel, encounterDefinition, statsAtLevel } from '../game/engine';
import { enemyRankSummary, RANK_LABELS, RANK_MULTIPLIERS } from '../game/enemyRanks';
import { canDeploy, resolvePlayerDeployment } from '../game/deployment';
import type { GridPoint, PartyMon, Run } from '../game/types';
import DeploymentBoard from './DeploymentBoard';
import SpeciesPortrait from './SpeciesPortrait';
import PixelIcon from './PixelIcon';

type Props = {
  run: Run;
  onToggle: (id: string) => void;
  onDeploymentChange: (deployment: Record<string, GridPoint>) => void;
  onStart: () => void;
  onBack: () => void;
};
const MAX_DEPLOY = 6;

export default function PrepareScreen({ run, onToggle, onDeploymentChange, onStart, onBack }: Props) {
  const [focused, setFocused] = useState('');
  const [placementNotice, setPlacementNotice] = useState('');
  const encounter = useMemo(() => encounterDefinition(run), [run.route.nodes, run.currentNodeId, run.encounterId, run.seed]);
  const enemyRoster = useMemo(() => ({
    summary: enemyRankSummary(encounter.enemies),
    entries: encounter.enemies.map(enemy => ({
      rank: enemy.rank,
      name: SPECIES[enemy.species].name,
      moves: defaultLoadoutAtLevel(enemy.species, encounter.enemyLevel).map(id => MOVES[id].name).join(', '),
    })),
  }), [encounter]);
  const map = MAPS[encounter.mapId];
  const placements = resolvePlayerDeployment(run, map);
  const selected = run.selected.map(id => run.party.find(mon => mon.id === id)).filter((mon): mon is PartyMon => !!mon && mon.hp > 0);
  const focusedMon = selected.find(mon => mon.id === focused) ?? selected[0];

  const place = (point: GridPoint) => {
    if (!focusedMon || !canDeploy(map, focusedMon.species, point, 'ally')) return;
    const next = { ...placements };
    const other = selected.find(mon => mon.id !== focusedMon.id && next[mon.id]?.[0] === point[0] && next[mon.id]?.[1] === point[1]);
    if (other) {
      const old = next[focusedMon.id];
      if (!old || !canDeploy(map, other.species, old, 'ally')) {
        setPlacementNotice(`${SPECIES[other.species].name} cannot use that tile.`);
        return;
      }
      next[other.id] = old;
    }
    next[focusedMon.id] = point;
    onDeploymentChange(next);
    setPlacementNotice(`${SPECIES[focusedMon.species].name} placed at column ${point[0] + 1}, row ${point[1] + 1}.`);
  };

  return <main className="prepare-screen route-modal-screen">
    <div className="route-modal-frame prepare-frame">
    <header className="prepare-title"><span className="eyebrow">COLUMN {run.encounter + 1} · {map.name} · {map.weather} WEATHER</span><h2>Choose Positions</h2><p>Pick a Pokémon from the roster, then choose a highlighted tile in the ally zone.</p></header>
    <div className="prepare-layout">
      <aside className="prepare-roster" aria-label="Your party"><div className="prepare-roster-head"><div><span>STEP 01 · SELECT</span><h3>Your Party</h3></div><b>{selected.length} / {MAX_DEPLOY}</b></div>
        <div className="prepare-roster-meter" aria-label={`${selected.length} of ${MAX_DEPLOY} Pokémon selected`}>{Array.from({ length: MAX_DEPLOY }, (_, index) => <i key={index} className={index < selected.length ? 'filled' : ''} />)}</div>
        <div className="prepare-roster-grid">{run.party.map(mon => {
          const deployed = run.selected.includes(mon.id), active = focusedMon?.id === mon.id;
          const maxHp = statsAtLevel(mon.species, mon.level)[0], species = SPECIES[mon.species];
          const slot = selected.findIndex(candidate => candidate.id === mon.id) + 1;
          return <article key={mon.id} className={`prepare-roster-card${deployed ? ' selected' : ''}${active ? ' focused' : ''}${mon.hp <= 0 ? ' fainted' : ''}`}>
            <button type="button" className="prepare-roster-focus" disabled={mon.hp <= 0 || (!deployed && selected.length >= MAX_DEPLOY)} onClick={() => { if (!deployed) onToggle(mon.id); setFocused(mon.id); setPlacementNotice(''); }} aria-pressed={active} aria-label={`${active ? 'Positioning' : deployed ? 'Position' : 'Add and position'} ${species.name}, level ${mon.level}, ${mon.hp} of ${maxHp} HP`}>
              <span className="prepare-roster-portrait"><SpeciesPortrait id={mon.species} /></span>
              <span className="prepare-roster-copy"><strong>{species.name}</strong><small>Lv {mon.level} · {species.types.join(' / ')}</small><span className="prepare-roster-hp"><b>HP</b><b>{mon.hp}/{maxHp}</b></span><span className="prepare-roster-health" role="progressbar" aria-label={`${species.name} HP`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={mon.hp}><i style={{ width: `${Math.max(0, Math.min(100, mon.hp / maxHp * 100))}%` }} /></span></span>
            </button>
            <div className="prepare-roster-action"><span>{mon.hp <= 0 ? 'FAINTED' : active ? `POSITIONING #${slot}` : deployed ? `DEPLOYED #${slot}` : 'RESERVE'}</span><button type="button" disabled={mon.hp <= 0 || (!deployed && selected.length >= MAX_DEPLOY)} aria-label={`${deployed ? 'Remove' : 'Add'} ${species.name} ${deployed ? 'from' : 'to'} battle team`} onClick={() => { onToggle(mon.id); setFocused(deployed ? '' : mon.id); setPlacementNotice(''); }}>{deployed ? 'Remove' : 'Add'}</button></div>
          </article>;
        })}</div>
      </aside>
      <section className="prepare-map-panel" aria-label="Choose a position on the battle map">
        <div className="prepare-map-head"><div><small>STEP 02 · PLACE</small><b>{map.name}</b><span>Choose a green tile · tap an ally to swap positions</span></div><div className="prepare-map-opponents"><b>{encounter.enemies.length}</b><span>OPPONENTS<br />LV {encounter.enemyLevel}</span></div></div>
        <details className="prepare-enemy-roster"><summary>Lv {encounter.enemyLevel} opponents · {enemyRoster.summary}</summary><ul>{enemyRoster.entries.map((enemy, index) => <li key={index}><b>{RANK_LABELS[enemy.rank]} {enemy.name}</b><span>{RANK_MULTIPLIERS[enemy.rank]}× combat stats · {enemy.moves}</span></li>)}</ul></details>
        <DeploymentBoard map={map} selected={selected} focused={focusedMon} placements={placements} onPlace={place} />
        <div className="prepare-map-footer"><div className="prepare-placement-status"><span>{focusedMon ? 'NOW POSITIONING' : 'SELECT A POKÉMON'}</span><strong role="status">{placementNotice || (focusedMon ? `${SPECIES[focusedMon.species].name} · choose a green tile` : 'Choose a healthy Pokémon from your party.')}</strong></div><button type="button" className="primary" disabled={!selected.length || selected.some(mon => !placements[mon.id])} onClick={onStart}>Enter battle <PixelIcon name="arrow-right" /></button></div>
      </section>
    </div>
    </div>
    <button type="button" className="route-modal-back" aria-label="Return to route selection" onClick={onBack}><PixelIcon name="arrow-left" /></button>
  </main>;
}
