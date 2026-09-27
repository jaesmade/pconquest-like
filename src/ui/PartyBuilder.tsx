import { useEffect, useMemo, useState } from 'react';
import { RECRUITS, SPECIES, STARTERS } from '../content/data';
import { MAX_RUN_POKEMON, STARTING_PARTY_POINTS, partyCost, partyDraftCost } from '../content/roster';
import { RUN_START_LEVEL, statsAtLevel } from '../game/engine';
import Sprite from './Sprite';

type Props = {
  selection: string[];
  onSelectionChange: (selection: string[]) => void;
  onStart: (selection: string[]) => void;
  onBack: () => void;
};

const PAGE_SIZE = 20;
const statNames = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed', 'Movement'] as const;
const catalog = [...new Set([...STARTERS, ...RECRUITS])].filter(id => SPECIES[id] && SPECIES[id].form?.kind !== 'mega');

export default function PartyBuilder({ selection, onSelectionChange, onStart, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const spent = partyDraftCost(selection);
  const remaining = STARTING_PARTY_POINTS - spent;
  const filtered = useMemo(() => catalog.filter(id => {
    const species = SPECIES[id];
    const query = search.trim().toLocaleLowerCase();
    return !query || `${species.name} ${species.types.join(' ')} ${species.ability}`.toLocaleLowerCase().includes(query);
  }), [search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleSpecies = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const previewId = hoveredId ?? focusedId ?? selection.at(-1);
  const preview = previewId ? SPECIES[previewId] : undefined;
  const previewStats = preview ? statsAtLevel(previewId!, RUN_START_LEVEL) : undefined;

  useEffect(() => { if (page >= pageCount) setPage(pageCount - 1); }, [page, pageCount]);

  const toggle = (id: string) => {
    const chosen = selection.includes(id);
    if (chosen) onSelectionChange(selection.filter(candidate => candidate !== id));
    else if (selection.length < MAX_RUN_POKEMON && spent + partyCost(id) <= STARTING_PARTY_POINTS) onSelectionChange([...selection, id]);
  };

  return <main className="party-builder-screen">
    <section className="party-builder-frame" aria-label="Create a party">
      <button type="button" className="party-builder-back" aria-label="Back to title" title="Back to title" onClick={onBack}>←</button>
      <aside className="party-draft-column">
        <h1>Your<br />Party</h1>
        <div className="party-draft-list" aria-label={`Selected Pokémon, ${selection.length} of ${MAX_RUN_POKEMON}`}>
          {selection.length === 0 && <p className="party-draft-empty">Choose Pokémon from the catalog.</p>}
          {selection.map((id, index) => <article className="party-draft-card" key={`${id}-${index}`}>
            <Sprite id={id} />
            <div><strong>{SPECIES[id].name}</strong><small>{SPECIES[id].types.join(' / ')}</small><small>{partyCost(id)} pts</small></div>
            <button type="button" aria-label={`Remove ${SPECIES[id].name}`} onClick={() => toggle(id)}>×</button>
          </article>)}
          <p className="party-count">{selection.length} / {MAX_RUN_POKEMON} Pokémon</p>
        </div>
      </aside>

      <section className="party-catalog-panel">
        <header className="party-catalog-header">
          <h2>Create a Party</h2>
          <div className="party-catalog-tools">
            <label className="party-search"><span className="sr-only">Search Pokémon</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search" /></label>
            <strong className="party-points"><span>{remaining}</span> pts Left</strong>
          </div>
        </header>

        <section className="party-hover-stats" aria-live="polite" aria-label="Pokémon stats preview">
          {preview && previewStats ? <>
            <div className="party-hover-identity"><Sprite id={previewId!} /><span><b>{preview.name}</b><small>{preview.types.join(' / ')} · {preview.ability}</small></span></div>
            <div className="party-hover-stat-grid">{previewStats.map((value, index) => <span key={statNames[index]}><small>{statNames[index]}</small><b>{value}</b></span>)}</div>
          </> : <p>Hover over or focus a Pokémon to see its stats.</p>}
        </section>

        <div className="party-species-grid" aria-label="Available Pokémon">
          {visibleSpecies.map(id => {
            const species = SPECIES[id], chosen = selection.includes(id), cost = partyCost(id);
            const disabled = !chosen && (selection.length >= MAX_RUN_POKEMON || remaining < cost);
            return <button type="button" key={id} className={`party-species-card ${chosen ? 'chosen' : ''}`} aria-pressed={chosen} disabled={disabled}
              onClick={() => toggle(id)} onMouseEnter={() => setHoveredId(id)} onMouseLeave={() => setHoveredId(undefined)}
              onFocus={() => setFocusedId(id)} onBlur={() => setFocusedId(undefined)}>
              <span className="party-species-portrait"><Sprite id={id} /><small>{cost}</small></span>
              <span className="party-species-name">{species.name}</span>
            </button>;
          })}
          {visibleSpecies.length === 0 && <p className="party-no-results">No Pokémon match “{search}”.</p>}
        </div>

        <footer className="party-catalog-footer">
          <span>{filtered.length} available · {STARTING_PARTY_POINTS} point starting budget</span>
          <nav className="party-pagination" aria-label="Pokémon catalog pages">
            <button type="button" aria-label="First page" disabled={page === 0} onClick={() => setPage(0)}>«</button>
            <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>‹</button>
            <span>{page + 1} / {pageCount}</span>
            <button type="button" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}>›</button>
            <button type="button" aria-label="Last page" disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>»</button>
          </nav>
          <button type="button" className="party-start-button" disabled={!selection.length} onClick={() => onStart(selection)}>Start Run</button>
        </footer>
      </section>
    </section>
  </main>;
}
