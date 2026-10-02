import { useEffect, useMemo, useState } from 'react';
import { MOVES, SPECIES } from '../content/data';
import { encounterDefinition, MAX_LEVEL, statsAtLevel, xpForLevel } from '../game/engine';
import { routeNode } from '../game/route';
import type { Run } from '../game/types';
import Sprite from './Sprite';

type Props = { run: Run; onContinue: () => void; onChooseMove: (monId: string, moveId: string, replaceSlot?: number) => void };

export default function IntermissionScreen({ run, onContinue, onChooseMove }: Props) {
  const earnedXp = encounterDefinition(run).xp;
  const participantIds = useMemo(() => new Set(Object.keys(run.deployment)), [run.deployment]);
  const awards = useMemo(() => run.party.map(mon => {
    const deployed = participantIds.has(mon.id);
    const monEarnedXp = deployed ? earnedXp : 0;
    const initialXp = mon.level >= MAX_LEVEL ? mon.xp : Math.max(0, mon.xp - monEarnedXp);
    let previousLevel = mon.level;
    while (previousLevel > 1 && initialXp < xpForLevel(previousLevel)) previousLevel--;
    return { mon, deployed, monEarnedXp, initialXp, previousLevel, maxHp: statsAtLevel(mon.species, mon.level)[0] };
  }), [run.party, participantIds, earnedXp]);
  const rewardedCount = awards.filter(award => award.deployed).length;
  const [awardProgress, setAwardProgress] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAwardProgress(1);
      return;
    }
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / 1350);
      setAwardProgress(progress);
      if (progress === 1) window.clearInterval(timer);
    }, 40);
    return () => window.clearInterval(timer);
  }, [run.currentNodeId, earnedXp]);
  const { coinsEarned, notes } = useMemo(() => {
    const coinReport = run.report.find(line => /^Earned \d+ coins\.$/.test(line));
    return {
      coinsEarned: coinReport?.match(/\d+/)?.[0],
      notes: run.report.filter(line => line !== coinReport && !/ gained \d+ XP\.$/.test(line)),
    };
  }, [run.report]);
  const completedNode = routeNode(run.route, run.currentNodeId);
  const isBoss = completedNode?.kind === 'boss';
  const pending = run.pendingMoves[0];
  const learner = pending && run.party.find(mon => mon.id === pending.monId);
  const offeredMove = pending && MOVES[pending.moveId];

  return <main className="growth-screen route-modal-screen">
    <div className="route-modal-frame growth-frame">
      <header className="growth-header">
        <span className="growth-eyebrow">COLUMN {completedNode?.column ?? run.encounter + 1} / 10 · ENCOUNTER CLEARED</span>
        <h2>Experience Gained</h2>
        <p>Only Pokémon deployed in this battle receive XP. Reserves keep their current XP.</p>
        <div className="growth-summary" aria-label="Battle rewards">
          <span><b>+{earnedXp}</b> XP per participant</span>
          {coinsEarned && <span><b>+{coinsEarned}</b> coins</span>}
          <span><b>{rewardedCount}</b> Pokémon rewarded</span>
        </div>
      </header>
      <div className="growth-grid" role="list" aria-label="Party experience gains">
        {awards.map(({ mon, deployed, monEarnedXp, initialXp, previousLevel, maxHp }, index) => {
          const displayedXp = Math.min(mon.xp, initialXp + Math.round(monEarnedXp * awardProgress));
          let displayedLevel = mon.level;
          while (displayedLevel > 1 && displayedXp < xpForLevel(displayedLevel)) displayedLevel--;
          const atMax = displayedLevel >= MAX_LEVEL;
          const levelStart = xpForLevel(displayedLevel);
          const levelNeed = atMax ? 1 : xpForLevel(displayedLevel + 1) - levelStart;
          const levelProgress = atMax ? levelNeed : Math.max(0, displayedXp - levelStart);
          const progress = atMax ? 100 : Math.max(0, Math.min(100, Math.round(levelProgress / levelNeed * 100)));
          const leveledUp = displayedLevel > previousLevel;
          const name = SPECIES[mon.species].name;
          return <article className={`growth-card${leveledUp ? ' growth-card-leveled' : ''}`} role="listitem" key={mon.id} aria-label={`${name} gained ${monEarnedXp} experience points`} style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}>
            <span className="growth-card-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div className="growth-portrait"><Sprite id={mon.species} /></div>
            <div className="growth-card-copy">
              <div className="growth-card-top"><h3>{name}</h3><span>Lv {displayedLevel}</span></div>
              <div className="growth-reward-line"><strong className={awardProgress >= 1 || monEarnedXp === 0 ? 'growth-xp-complete' : ''}>+{Math.round(monEarnedXp * awardProgress)} XP</strong>{leveledUp && <span className="growth-level-up">LEVEL UP!</span>}</div>
              <div className="growth-progress-head"><span>{atMax ? 'Maximum level' : 'Next level'}</span><span>{atMax ? 'MAX' : `${levelProgress} / ${levelNeed}`}</span></div>
              <div className="growth-meter" role="progressbar" aria-label={`${name} level progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="growth-card-foot"><span>{mon.hp}/{maxHp} HP</span><span>{deployed ? 'Deployed' : 'Reserve'}</span></div>
            </div>
          </article>;
        })}
      </div>
      {pending && learner && offeredMove && <section className="growth-move-choice" aria-label="Choose a newly learned move">
        <div className="growth-move-heading"><strong>{SPECIES[learner.species].name} can learn {offeredMove.name}</strong><span>{run.pendingMoves.length} choice{run.pendingMoves.length === 1 ? '' : 's'} remaining</span></div>
        <p>{offeredMove.type} · {offeredMove.category} · {offeredMove.power ? `Power ${offeredMove.power} · ` : ''}Range {offeredMove.range} · {offeredMove.detail}</p>
        <div className="growth-move-actions">
          {learner.equipped.length < 4 ? <button type="button" onClick={() => onChooseMove(learner.id, pending.moveId, learner.equipped.length)}>Learn {offeredMove.name}</button>
            : learner.equipped.map((id, slot) => <button type="button" key={`${slot}-${id}`} onClick={() => onChooseMove(learner.id, pending.moveId, slot)}>Replace {MOVES[id]?.name ?? id}</button>)}
          <button type="button" className="growth-move-skip" onClick={() => onChooseMove(learner.id, pending.moveId)}>Keep current moves</button>
        </div>
      </section>}
      <footer className="growth-footer">
        {notes.length > 0 && <div className="growth-milestones"><strong>NEW MILESTONES</strong><div className="growth-notes" aria-label="Level and move rewards">{notes.map((note, index) => <span className={note.includes(' learned ') ? 'growth-note-move' : 'growth-note-level'} key={index}>{note}</span>)}</div></div>}
        <button type="button" className="growth-continue" disabled={!!pending} onClick={onContinue}>{pending ? 'Choose a move first' : isBoss ? 'Complete run' : 'OK'}</button>
      </footer>
    </div>
  </main>;
}
