import { SPECIES } from '../content/data';
import { encounterDefinition, MAX_LEVEL, statsAtLevel, xpForLevel } from '../game/engine';
import { routeNode } from '../game/route';
import type { Run } from '../game/types';
import Sprite from './Sprite';

type Props = { run: Run; onContinue: () => void };

export default function IntermissionScreen({ run, onContinue }: Props) {
  const earnedXp = encounterDefinition(run).xp;
  const coinReport = run.report.find(line => /^Earned \d+ coins\.$/.test(line));
  const coinsEarned = coinReport?.match(/\d+/)?.[0];
  const notes = run.report.filter(line => line !== coinReport && !/ gained \d+ XP\.$/.test(line));
  const isBoss = routeNode(run.route, run.currentNodeId)?.kind === 'boss';

  return <main className="growth-screen route-modal-screen">
    <div className="route-modal-frame growth-frame">
      <header className="growth-header">
        <span className="growth-eyebrow">ENCOUNTER CLEARED</span>
        <h2>Experience Gained</h2>
        <p>Every owned Pokémon receives battle XP, including reserves.</p>
        <div className="growth-summary" aria-label="Battle rewards">
          <span><b>+{earnedXp}</b> XP each</span>
          {coinsEarned && <span><b>+{coinsEarned}</b> coins</span>}
          <span><b>{run.party.length}</b> Pokémon rewarded</span>
        </div>
      </header>
      <div className="growth-grid" role="list" aria-label="Party experience gains">
        {run.party.map((mon, index) => {
          const atMax = mon.level >= MAX_LEVEL;
          const levelStart = xpForLevel(mon.level);
          const levelNeed = atMax ? 1 : xpForLevel(mon.level + 1) - levelStart;
          const levelProgress = atMax ? levelNeed : Math.max(0, mon.xp - levelStart);
          const progress = atMax ? 100 : Math.max(0, Math.min(100, Math.round(levelProgress / levelNeed * 100)));
          const leveledUp = !atMax && mon.xp - earnedXp < levelStart;
          const name = SPECIES[mon.species].name;
          return <article className={`growth-card${leveledUp ? ' growth-card-leveled' : ''}`} role="listitem" key={mon.id} aria-label={`${name} gained ${earnedXp} experience points`} style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}>
            <span className="growth-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className="growth-portrait"><Sprite id={mon.species} /></div>
            <div className="growth-card-copy">
              <div className="growth-card-top"><h3>{name}</h3><span>Lv {mon.level}</span></div>
              <div className="growth-reward-line"><strong>+{earnedXp} XP</strong>{leveledUp && <span className="growth-level-up">LEVEL UP!</span>}</div>
              <div className="growth-progress-head"><span>{atMax ? 'Maximum level' : 'Next level'}</span><span>{atMax ? 'MAX' : `${levelProgress} / ${levelNeed}`}</span></div>
              <div className="growth-meter" role="progressbar" aria-label={`${name} level progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="growth-card-foot"><span>{mon.hp}/{statsAtLevel(mon.species, mon.level)[0]} HP</span><span>{run.selected.includes(mon.id) ? 'Deployed' : 'Reserve'}</span></div>
            </div>
          </article>;
        })}
      </div>
      <footer className="growth-footer">
        {notes.length > 0 && <div className="growth-milestones"><strong>NEW MILESTONES</strong><div className="growth-notes" aria-label="Level and move rewards">{notes.map((note, index) => <span className={note.includes(' learned ') ? 'growth-note-move' : 'growth-note-level'} key={index}>{note}</span>)}</div></div>}
        <button type="button" className="growth-continue" onClick={onContinue}>{isBoss ? 'Complete run' : 'OK'}</button>
      </footer>
    </div>
  </main>;
}
