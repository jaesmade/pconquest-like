import type { Dispatch, SetStateAction } from 'react';
import { ITEMS, itemCanEquip, SPECIES } from '../content/data';
import type { ItemId } from '../content/items';
import type { LabConfig } from '../game/engine';
import type { Weather } from '../game/types';

export type TitleView = 'splash' | 'title' | 'options' | 'exit' | 'lab-setup';

type Props = {
  view: TitleView;
  canContinue: boolean;
  saveFailed: boolean;
  soundMuted: boolean;
  labConfig: LabConfig;
  setLabConfig: Dispatch<SetStateAction<LabConfig>>;
  onViewChange: (view: TitleView) => void;
  onContinue: () => void;
  onNewRun: () => void;
  onStartLab: () => void;
  onSoundMutedChange: (muted: boolean) => void;
};

export default function TitleScreen({ view, canContinue, saveFailed, soundMuted, labConfig, setLabConfig, onViewChange, onContinue, onNewRun, onStartLab, onSoundMutedChange }: Props) {
  return <main className={`title-screen ${view === 'splash' ? 'splash-screen' : ''}`} onClick={view === 'splash' ? () => onViewChange('title') : undefined}>
    <div className={`title-layout ${view === 'splash' ? 'splash-layout' : ''}`}>
      <header className="title-brand" aria-label="Pokémon Tactics"><h1><span>Pokémon</span><span>Tactics</span></h1></header>
      {view === 'splash' && <button className="splash-prompt" onClick={() => onViewChange('title')}>Press any key to start</button>}
      {view === 'title' && <nav className="title-menu" aria-label="Main menu" onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        if (!buttons.length) return;
        event.preventDefault();
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
      }}>
        {canContinue && <button className="menu-button" autoFocus onClick={onContinue}>Continue</button>}
        <button className="menu-button" autoFocus={!canContinue} onClick={onNewRun}>New Run</button>
        <button className="menu-button" onClick={() => onViewChange('lab-setup')}>Lab</button>
        <button className="menu-button" onClick={() => onViewChange('options')}>Options</button>
        <button className="menu-button menu-exit" onClick={() => onViewChange('exit')}>Exit</button>
      </nav>}
      {view === 'lab-setup' && <section className="title-panel lab-setup"><h2>Battle Lab</h2><p>Control both Pokémon on a 5×5 arena. All moves learned at the chosen level are available. Replaying the same seed repeats combat rolls.</p>
        {(['ally', 'enemy'] as const).map(side => <fieldset key={side}><legend>{side === 'ally' ? 'Ally' : 'Opponent'}</legend>
          <label>Pokémon<select value={labConfig[`${side}Species`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Species`]: event.target.value, [`${side}Item`]: 'None' }))}>{Object.entries(SPECIES).map(([id, species]) => <option value={id} key={id}>{species.name}</option>)}</select></label>
          <label>Level<input type="number" min="1" max="100" value={labConfig[`${side}Level`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Level`]: Math.max(1, Math.min(100, Number(event.target.value) || 1)) }))} /></label>
          <label>Held item<select value={labConfig[`${side}Item`]} onChange={event => setLabConfig(previous => ({ ...previous, [`${side}Item`]: event.target.value as ItemId }))}>{ITEMS.filter(id => itemCanEquip(id, labConfig[`${side}Species`])).map(id => <option value={id} key={id}>{id}</option>)}</select></label>
        </fieldset>)}
        <div className="lab-setup-row"><label>Weather<select value={labConfig.weather} onChange={event => setLabConfig(previous => ({ ...previous, weather: event.target.value as Weather }))}>{(['clear', 'sun', 'rain', 'snow', 'sandstorm'] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Seed<input type="number" min="1" max="4294967295" step="1" value={labConfig.seed} onChange={event => setLabConfig(previous => ({ ...previous, seed: Math.max(1, Math.min(4294967295, Math.floor(Number(event.target.value) || 1))) }))} /></label></div>
        <div className="title-actions"><button className="menu-button" autoFocus onClick={onStartLab}>Start Battle Lab</button><button className="menu-button" onClick={() => onViewChange('title')}>Back to title</button></div>
      </section>}
      {view === 'options' && <section className="title-panel"><h2>Options</h2><div className="title-actions"><button className="menu-button" autoFocus data-audio-toggle aria-pressed={!soundMuted} onClick={() => onSoundMutedChange(!soundMuted)}>Sound: {soundMuted ? 'Off' : 'On'}</button><button className="menu-button" onClick={() => onViewChange('title')}>Back</button></div></section>}
      {view === 'exit' && <section className="title-panel"><h2>Exit</h2><p>Your run is saved in this browser. Close the tab when you are ready.</p><div className="title-actions"><button className="menu-button" autoFocus onClick={() => onViewChange('title')}>Back to title</button></div></section>}
      {saveFailed && view !== 'splash' && <p className="title-save-warning" role="alert">Progress could not be saved in this browser.</p>}
    </div>
  </main>;
}
