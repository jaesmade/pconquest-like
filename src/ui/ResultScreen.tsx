import type { Run } from '../game/types';

export default function ResultScreen({ run, onNewRun }: { run: Run; onNewRun: () => void }) {
  const won = run.result === 'win';
  return <main className="result-screen"><div className="result-frame"><section className={'result-panel ' + (won ? 'won' : 'lost')}>
    <span className="eyebrow">RUN COMPLETE</span>
    <h2>{won ? 'Citadel secured' : 'Your team fell'}</h2>
    <p>{won ? 'The next run is ready. Your first victory has been saved locally.' : 'The route ends here. Try a different lead, moves, or terrain approach.'}</p>
    <button type="button" className="primary" onClick={onNewRun}>Start a new run</button>
  </section></div></main>;
}
