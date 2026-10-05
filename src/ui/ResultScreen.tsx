import type { Run } from '../game/types';
import { useEffect, useRef } from 'react';
import { SPECIES } from '../content/data';
import { ROUTE_COLUMNS, routeNode } from '../game/route';
import SpeciesPortrait from './SpeciesPortrait';
import PixelIcon from './PixelIcon';

export default function ResultScreen({ run, onNewRun, onTitle }: { run: Run; onNewRun: () => void; onTitle: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const won = run.result === 'win';
  const stoppedAt = routeNode(run.route, run.currentNodeId)?.column ?? Math.min(ROUTE_COLUMNS, run.encounter + 1);
  const cleared = won ? ROUTE_COLUMNS : Math.max(0, run.route.visited.length - 1);
  return <main className="result-screen"><div className="result-frame"><section className={'result-panel ' + (won ? 'won' : 'lost')}>
    <span className="result-emblem"><PixelIcon name={won ? 'trophy' : 'flag'} size={48} /></span>
    <span className="eyebrow">{won ? 'VICTORY · RUN COMPLETE' : `RUN ENDED · COLUMN ${stoppedAt}`}</span>
    <h2 ref={heading} tabIndex={-1}>{won ? 'Heartwood secured!' : 'Your team fell'}</h2>
    <p>{won ? 'The final battle is won and the capture point is yours. Your team completed the route.' : 'Your journey ends here. Take what you learned into a fresh team and a new route.'}</p>
    <dl className="result-summary" aria-label="Run summary"><div><dt>Route cleared</dt><dd>{cleared}<small> / {ROUTE_COLUMNS}</small></dd></div><div><dt>Coins remaining</dt><dd>{run.coins}</dd></div><div><dt>Pokémon owned</dt><dd>{run.party.length}</dd></div></dl>
    <div className="result-team" aria-label="Your final team">{run.party.map(mon => <div className="result-team-member" key={mon.id}><SpeciesPortrait id={mon.species} /><span>{SPECIES[mon.species].name}</span><small>Lv {mon.level}</small></div>)}</div>
    <div className="result-actions"><button type="button" className="primary" onClick={onNewRun}>Start a new run</button><button type="button" className="result-title-button" onClick={onTitle}>Back to title</button></div>
  </section></div></main>;
}
