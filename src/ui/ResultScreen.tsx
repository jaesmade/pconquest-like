import type { Run } from '../game/types';

export default function ResultScreen({ run, onNewRun }: { run: Run; onNewRun: () => void }) {
  return <main className="narrow"><section className="hero result">
    <span className="eyebrow">RUN COMPLETE</span>
    <h2>{run.result === 'win' ? 'Citadel secured' : 'Your team fell'}</h2>
    <p>{run.result === 'win' ? 'The next run is ready. Your first victory has been saved locally.' : 'The route ends here. Try a different lead, moves, or terrain approach.'}</p>
    <button className="primary" onClick={onNewRun}>Start a new run</button>
  </section></main>;
}
