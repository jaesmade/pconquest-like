import { MOVES, SPECIES } from '../content/data';
import { statsAtLevel } from '../game/engine';
import { routeNode } from '../game/route';
import type { Run } from '../game/types';
import Sprite from './Sprite';

type Props = { run: Run; onEvolve: (id: string) => void; onContinue: () => void };

export default function IntermissionScreen({ run, onEvolve, onContinue }: Props) {
  return <main className="narrow">
    <section className="hero"><span className="eyebrow">ENCOUNTER CLEARED</span><h2>Party growth</h2><p>Every party member gained XP, including reserves. You can evolve eligible Pokémon now and adjust learned moves before the next battle.</p></section>
    <div className="report">{run.report.map((item, i) => <p key={i}>{item}</p>)}</div>
    <div className="prep-list">{run.party.map(mon => {
      const evolution = SPECIES[mon.species].evolves;
      return <article className="prep-card" key={mon.id}><div className="prep-head"><Sprite id={mon.species} /><div><strong>{SPECIES[mon.species].name}</strong><small> Lv {mon.level} · {mon.hp}/{statsAtLevel(mon.species, mon.level)[0]} HP</small></div></div><p>Learned: {mon.learned.map(id => MOVES[id]?.name ?? id).join(', ')}</p>{evolution && mon.level >= evolution.level && <button onClick={() => onEvolve(mon.id)}>Evolve into {SPECIES[evolution.into].name}</button>}</article>;
    })}</div>
    <div className="sticky-actions"><button className="primary" onClick={onContinue}>{routeNode(run.route, run.currentNodeId)?.kind === 'boss' ? 'Complete run →' : 'Continue route →'}</button></div>
  </main>;
}
