import { useState } from 'react';
import { ENCOUNTERS, itemCanEquip, ITEMS, MAPS, MOVES, SPECIES } from '../content/data';
import { statsAtLevel } from '../game/engine';
import { canDeploy, resolvePlayerDeployment } from '../game/deployment';
import type { GridPoint, PartyMon, Run } from '../game/types';
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
  const encounter = ENCOUNTERS.find(entry => entry.id === run.encounterId)!;
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
    setPlacementNotice('');
  };

  return <main className="narrow">
    <section className="hero"><span className="eyebrow">BATTLE PREPARATION</span><h2>Deploy up to three</h2><p>{map.name} · Starting weather: {map.weather}. Select healthy Pokémon, equip two learned moves each, assign held items, and choose ally-zone deployment tiles.</p></section>
    <section className="deployment-panel" aria-label="Deployment zones">
      <div className="deployment-head"><div><span className="eyebrow">DEPLOYMENT</span><h3>Choose starting tiles</h3><p>Select a Pokémon, then choose a green ally-zone tile. Occupied tiles swap positions when both Pokémon can use them.</p></div><div className="deployment-legend"><span>● Ally</span><span>● Neutral</span><span>● Enemy</span></div></div>
      <div className="deployment-roster">{selected.map((mon, index) => <button key={mon.id} type="button" className={focusedMon?.id === mon.id ? 'active' : ''} onClick={() => setFocused(mon.id)}>{index + 1}. {SPECIES[mon.species].name} <small>{placements[mon.id] ? `(${placements[mon.id][0] + 1}, ${placements[mon.id][1] + 1})` : 'No tile'}</small></button>)}</div>
      <div className="deployment-scroll"><div className="deployment-grid" style={{ gridTemplateColumns: `repeat(${map.tiles[0].length}, 36px)` }}>
        {map.tiles.flatMap((row, y) => row.map((tile, x) => {
          const zone = map.zones[y][x];
          const occupantIndex = selected.findIndex(mon => placements[mon.id]?.[0] === x && placements[mon.id]?.[1] === y);
          const legal = !!focusedMon && canDeploy(map, focusedMon.species, [x, y], 'ally');
          const marker = occupantIndex >= 0 ? String(occupantIndex + 1) : tile.kind === 'wall' ? '■' : tile.kind === 'water' ? '≈' : tile.kind === 'lava' ? '◆' : '';
          return <button key={`${x},${y}`} type="button" className={`deployment-tile zone-${zone} terrain-${tile.kind}${occupantIndex >= 0 ? ' occupied' : ''}${focusedMon && placements[focusedMon.id]?.[0] === x && placements[focusedMon.id]?.[1] === y ? ' focused' : ''}`} disabled={!legal} onClick={() => place([x, y])} aria-label={`Column ${x + 1}, row ${y + 1}: ${zone} zone, ${tile.kind}${occupantIndex >= 0 ? `, ${SPECIES[selected[occupantIndex]!.species].name}` : ''}`}>{marker}</button>;
        }))}
      </div></div>
      {placementNotice && <p className="notice" role="status">{placementNotice}</p>}
    </section>
    <div className="prep-list">{run.party.map(mon => <article className={`prep-card ${run.selected.includes(mon.id) ? 'selected' : ''}`} key={mon.id}>
      <div className="prep-head"><label><input type="checkbox" checked={run.selected.includes(mon.id)} disabled={mon.hp <= 0 || (!run.selected.includes(mon.id) && run.selected.length >= 3)} onChange={() => { onToggle(mon.id); setFocused(mon.id); }} /> Deploy</label><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small> Lv {mon.level} · {mon.hp}/{statsAtLevel(mon.species, mon.level)[0]} HP · {SPECIES[mon.species].types.join('/')}</small></div></div>
      <div className="prep-controls"><label>Move 1 <select value={mon.equipped[0]} onChange={event => onEquipMove(mon.id, event.target.value, 0)}>{mon.learned.map(id => <option value={id} key={id}>{MOVES[id].name}</option>)}</select></label><label>Move 2 <select value={mon.equipped[1]} onChange={event => onEquipMove(mon.id, event.target.value, 1)}>{mon.learned.map(id => <option value={id} key={id}>{MOVES[id].name}</option>)}</select></label><label>Held item <img className="held-item-icon" src={`/assets/ui/icons/item-${mon.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" /><select value={mon.item} onChange={event => onEquipItem(mon.id, event.target.value)}>{[mon.item, ...ITEMS.filter(item => (item === 'None' || run.bag.includes(item)) && itemCanEquip(item, mon.species))].filter((item, index, all) => all.indexOf(item) === index).map(item => <option key={item}>{item}</option>)}</select></label></div>
    </article>)}</div>
    <div className="sticky-actions"><span>{selected.length} / 3 selected · {Object.keys(placements).length} placed</span><button className="primary" disabled={!selected.length || selected.some(mon => !placements[mon.id])} onClick={onStart}>Enter battle →</button></div>
  </main>;
}
