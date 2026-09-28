import { useState } from 'react';
import { itemCanEquip, ITEMS, MAPS, MAX_EQUIPPED_MOVES, MOVES, SPECIES } from '../content/data';
import { encounterDefinition, statsAtLevel } from '../game/engine';
import { canDeploy, resolvePlayerDeployment } from '../game/deployment';
import type { GridPoint, PartyMon, Run } from '../game/types';
import DeploymentBoard from './DeploymentBoard';
import Sprite from './Sprite';

type Props = {
  run: Run;
  onToggle: (id: string) => void;
  onEquipMove: (monId: string, moveId: string, slot: number) => void;
  onEquipItem: (monId: string, item: string) => void;
  onDeploymentChange: (deployment: Record<string, GridPoint>) => void;
  onStart: () => void;
};

export default function PrepareScreen({ run, onToggle, onEquipMove, onEquipItem, onDeploymentChange, onStart }: Props) {
  const [focused, setFocused] = useState('');
  const [placementNotice, setPlacementNotice] = useState('');
  const encounter = encounterDefinition(run);
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

  return <main className="prepare-screen">
    <header className="prepare-title"><span className="eyebrow">COLUMN {run.encounter + 1} · {map.name} · {map.weather} weather</span><h2>Choose Position</h2><p>Select up to six healthy Pokémon, then click a green tile on the rendered map. An occupied tile swaps the two Pokémon when both placements are legal.</p></header>
    <div className="prepare-layout">
      <aside className="prepare-roster" aria-label="Your party"><h3>Your Party <small>{selected.length} / 6</small></h3>
        <div className="prepare-roster-grid">{run.party.map(mon => {
          const deployed = run.selected.includes(mon.id), active = focusedMon?.id === mon.id;
          return <article key={mon.id} className={`prepare-roster-card${deployed ? ' selected' : ''}${active ? ' focused' : ''}${mon.hp <= 0 ? ' fainted' : ''}`}>
            <button type="button" className="prepare-roster-focus" disabled={mon.hp <= 0 || (!deployed && selected.length >= 6)} onClick={() => { if (!deployed) onToggle(mon.id); setFocused(mon.id); }} aria-pressed={active}>
              <Sprite id={mon.species} /><strong>{SPECIES[mon.species].name}</strong><small>Lv {mon.level} · {mon.hp}/{statsAtLevel(mon.species, mon.level)[0]} HP</small>
            </button>
            <label><input type="checkbox" checked={deployed} disabled={mon.hp <= 0 || (!deployed && selected.length >= 6)} onChange={() => { onToggle(mon.id); setFocused(mon.id); }} /> Deploy</label>
          </article>;
        })}</div>
      </aside>
      <section className="prepare-map-panel" aria-label="Choose a position on the battle map">
        <div className="prepare-map-head"><div><b>{map.name}</b><span>Allies deploy at the bottom · Enemies enter at the top</span></div><span>{encounter.enemies.length} opponents · Lv {encounter.enemyLevel}</span></div>
        <DeploymentBoard map={map} selected={selected} focused={focusedMon} placements={placements} onPlace={place} />
        <div className="prepare-map-footer"><span role="status">{placementNotice || (focusedMon ? `Placing ${SPECIES[focusedMon.species].name}. Choose a green tile.` : 'Select a healthy Pokémon.')}</span><button type="button" className="primary" disabled={!selected.length || selected.some(mon => !placements[mon.id])} onClick={onStart}>Enter battle →</button></div>
      </section>
    </div>
    <details className="prepare-loadout"><summary>Moves and held items</summary><div className="prep-list">{run.party.map(mon => <article className="prep-card" key={mon.id}>
      <div className="prep-head"><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small>Lv {mon.level} · {mon.hp}/{statsAtLevel(mon.species, mon.level)[0]} HP</small></div></div>
      <div className="prep-controls">{Array.from({ length: MAX_EQUIPPED_MOVES }, (_, slot) => <label key={slot}>Move {slot + 1} <select value={mon.equipped[slot]} onChange={event => onEquipMove(mon.id, event.target.value, slot)}>{mon.learned.map(id => <option value={id} key={id}>{MOVES[id].name}</option>)}</select></label>)}<label>Held item <select value={mon.item} onChange={event => onEquipItem(mon.id, event.target.value)}>{[mon.item, ...ITEMS.filter(item => (item === 'None' || run.bag.includes(item)) && itemCanEquip(item, mon.species))].filter((item, index, all) => all.indexOf(item) === index).map(item => <option key={item}>{item}</option>)}</select></label></div>
    </article>)}</div></details>
  </main>;
}
