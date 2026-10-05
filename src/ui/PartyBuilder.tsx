import { useEffect, useMemo, useState } from 'react';
import { RECRUITS, SPECIES, STARTERS } from '../content/data';
import { MAX_RUN_POKEMON, STARTING_PARTY_POINTS, partyCost, partyDraftCost } from '../content/roster';
import { RUN_START_LEVEL, statsAtLevel } from '../game/engine';
import SpeciesPortrait from './SpeciesPortrait';
import PixelIcon from './PixelIcon';

type Props = {
  selection: string[];
  onSelectionChange: (selection: string[]) => void;
  onStart: (selection: string[]) => void;
  onBack: () => void;
};

const PAGE_SIZE = 20;
const statNames = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed', 'Movement'] as const;
const catalog = [...new Set([...STARTERS, ...RECRUITS])].filter(id => SPECIES[id] && SPECIES[id].form?.kind !== 'mega');
const types = [...new Set(catalog.flatMap(id => SPECIES[id].types))].sort();

export default function PartyBuilder({ selection, onSelectionChange, onStart, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hoveredId, setHoveredId] = useState<string>();
  const [focusedId, setFocusedId] = useState<string>();
  const [feedback, setFeedback] = useState('Choose at least one Pokémon to begin.');
  const spent = partyDraftCost(selection);
  const remaining = STARTING_PARTY_POINTS - spent;
  const filtered = useMemo(() => catalog.filter(id => {
    const species = SPECIES[id];
    const query = search.trim().toLocaleLowerCase();
    return (typeFilter === 'all' || species.types.includes(typeFilter))
      && (!query || `${species.name} ${species.types.join(' ')} ${species.ability}`.toLocaleLowerCase().includes(query));
  }), [search, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleSpecies = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const previewId = focusedId ?? hoveredId ?? selection.at(-1) ?? visibleSpecies[0];
  const preview = previewId ? SPECIES[previewId] : undefined;
  const previewStats = preview ? statsAtLevel(previewId!, RUN_START_LEVEL) : undefined;

  useEffect(() => { if (page >= pageCount) setPage(pageCount - 1); }, [page, pageCount]);

  const toggle = (id: string) => {
    const name = SPECIES[id].name;
    if (selection.includes(id)) {
      onSelectionChange(selection.filter(candidate => candidate !== id));
      setFeedback(`${name} removed. ${remaining + partyCost(id)} points available.`);
    } else if (selection.length < MAX_RUN_POKEMON && spent + partyCost(id) <= STARTING_PARTY_POINTS) {
      onSelectionChange([...selection, id]);
      setFeedback(`${name} added. ${remaining - partyCost(id)} points available.`);
    } else setFeedback(`${name} needs ${partyCost(id)} points. Remove a teammate to free points.`);
  };

  return <main className="party-builder-screen">
    <section className="party-builder-frame" aria-label="Choose your starting party">
      <header className="party-builder-topbar">
        <button type="button" className="party-builder-back" onClick={onBack} aria-label="Back to title"><PixelIcon name="arrow-left" size={16} /> Back</button>
        <div><span className="party-kicker">NEW RUN · STARTING TEAM</span><h1>Choose your party</h1></div>
        <span className="party-level-tag">LEVEL {RUN_START_LEVEL}</span>
      </header>

      <div className="party-builder-content">
        <aside className="party-draft-column" aria-label="Your party">
          <div className="party-draft-heading"><span className="party-section-label">YOUR PARTY</span><strong>{selection.length} chosen</strong></div>
          <div className="party-budget" aria-label={`${remaining} of ${STARTING_PARTY_POINTS} points remaining`}>
            <div><span>Party points</span><strong>{remaining}<small> / {STARTING_PARTY_POINTS} left</small></strong></div>
            <div className="party-budget-meter" aria-hidden="true">{Array.from({ length: STARTING_PARTY_POINTS }, (_, index) => <i key={index} className={index < spent ? 'used' : ''} />)}</div>
            <p>Most Pokémon cost 2 points. Your roster can grow to {MAX_RUN_POKEMON} during the run.</p>
          </div>
          <div className="party-draft-list">
            {selection.length === 0 && <div className="party-draft-empty"><PixelIcon name="party" size={32} /><strong>Your team starts here</strong><p>Choose a Pokémon from the roster to add it to your starting party.</p></div>}
            {selection.map((id, index) => <article className="party-draft-card" data-type={SPECIES[id].types[0]} key={id} onMouseEnter={() => setHoveredId(id)} onMouseLeave={() => setHoveredId(undefined)}>
              <span className="party-draft-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="party-draft-portrait"><SpeciesPortrait id={id} /></span>
              <span className="party-draft-info"><strong>{SPECIES[id].name}</strong><small>{SPECIES[id].types.join(' / ')}</small><em>{partyCost(id)} pts</em></span>
              <button type="button" aria-label={`Remove ${SPECIES[id].name}`} title={`Remove ${SPECIES[id].name}`} onFocus={() => setFocusedId(id)} onBlur={() => setFocusedId(undefined)} onClick={() => toggle(id)}><PixelIcon name="close" size={16} /></button>
            </article>)}
          </div>
          <p className="party-draft-tip">You can recruit more Pokémon on the route.</p>
        </aside>

        <section className="party-catalog-panel" aria-labelledby="party-catalog-title">
          <div className="party-catalog-header"><div><span className="party-section-label">AVAILABLE POKÉMON</span><h2 id="party-catalog-title">Build your lineup</h2></div><span className="party-catalog-count">{filtered.length} choices</span></div>
          <div className="party-catalog-tools">
            <label className="party-search"><span className="sr-only">Search Pokémon</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search name or ability" /></label>
            <label className="party-type-filter"><span className="sr-only">Filter by type</span><select value={typeFilter} onChange={event => { setTypeFilter(event.target.value); setPage(0); }}><option value="all">All types</option>{types.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          </div>

          <section className="party-hover-stats" data-type={preview?.types[0]} aria-label="Pokémon stats preview">
            {preview && previewStats ? <>
              <div className="party-hover-identity"><span className="party-hover-portrait"><SpeciesPortrait id={previewId!} /></span><span><small>LEVEL {RUN_START_LEVEL} · {partyCost(previewId!)} POINTS</small><b>{preview.name}</b><em>{preview.types.join(' / ')} · {preview.ability}</em></span></div>
              <div className="party-hover-stat-grid">{previewStats.map((value, index) => <span key={statNames[index]}><small>{statNames[index]}</small><b>{value}</b></span>)}</div>
            </> : <p>Choose a Pokémon to see its stats.</p>}
          </section>

          <div className="party-species-grid" aria-label="Available Pokémon">
            {visibleSpecies.map(id => {
              const species = SPECIES[id], chosen = selection.includes(id), cost = partyCost(id);
              const unaffordable = !chosen && (selection.length >= MAX_RUN_POKEMON || remaining < cost);
              return <button type="button" key={id} data-type={species.types[0]} className={`party-species-card${chosen ? ' chosen' : ''}${unaffordable ? ' unaffordable' : ''}`}
                aria-pressed={chosen} aria-disabled={unaffordable}
                title={unaffordable ? `${species.name} costs ${cost} points; ${remaining} remaining` : `${chosen ? 'Remove' : 'Add'} ${species.name} · ${cost} points`}
                onClick={() => toggle(id)} onMouseEnter={() => setHoveredId(id)} onMouseLeave={() => setHoveredId(undefined)}
                onFocus={() => setFocusedId(id)} onBlur={() => setFocusedId(undefined)}>
                <span className="party-species-portrait"><SpeciesPortrait id={id} /><span className="party-card-state">{chosen ? <PixelIcon name="check" size={16} /> : `${cost} pts`}</span></span>
                <strong className="party-species-name">{species.name}</strong>
                <small className="party-species-type">{species.types.join(' / ')}</small>
              </button>;
            })}
            {visibleSpecies.length === 0 && <div className="party-no-results"><p>No Pokémon match your search. Try another name or type.</p><button type="button" onClick={() => { setSearch(''); setTypeFilter('all'); setPage(0); }}>Clear filters</button></div>}
          </div>

          <footer className="party-catalog-footer">
            {pageCount > 1 && <nav className="party-pagination" aria-label="Pokémon catalog pages">
              <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><PixelIcon name="arrow-left" size={16} /></button>
              <span>{page + 1} / {pageCount}</span>
              <button type="button" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><PixelIcon name="arrow-right" size={16} /></button>
            </nav>}
            <span className="party-footer-hint" role="status">{feedback}</span>
            <button type="button" className="party-start-button" disabled={!selection.length} onClick={() => onStart(selection)}>Begin run <PixelIcon name="arrow-right" size={16} /></button>
          </footer>
        </section>
      </div>
    </section>
  </main>;
}
