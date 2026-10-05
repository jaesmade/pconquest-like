import { useEffect, useMemo, useRef, useState } from 'react';
import { itemFor, SPECIES } from '../content/data';
import { MAX_RUN_POKEMON } from '../content/roster';
import { SHOP_STOCK } from '../content/shop';
import { offerRecruits } from '../game/engine';
import type { Run } from '../game/types';
import type { ItemId } from '../content/items';
import SpeciesPortrait from './SpeciesPortrait';
import PixelIcon from './PixelIcon';

type Props = {
  run: Run;
  onBuy: (item: ItemId) => void;
  onContinue: () => void;
  onRecruit: (species: string, replaceId?: string) => void;
  onClaim: () => void;
};

export default function RouteStopScreen({ run, onBuy, onContinue, onRecruit, onClaim }: Props) {
  const [pendingSpecies, setPendingSpecies] = useState<string>();
  const [replaceId, setReplaceId] = useState<string>();
  const [purchaseMessage, setPurchaseMessage] = useState('Choose an item to buy.');
  const replacementHeading = useRef<HTMLHeadingElement>(null);
  const recruitTriggers = useRef(new Map<string, HTMLButtonElement>());
  const bagGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of run.bag) counts.set(item, (counts.get(item) ?? 0) + 1);
    return [...counts];
  }, [run.bag]);
  const rosterFull = run.party.length >= MAX_RUN_POKEMON;
  const leaving = run.party.find(mon => mon.id === replaceId);
  useEffect(() => {
    if (pendingSpecies) replacementHeading.current?.focus();
  }, [pendingSpecies]);
  return <main className="route-stop-screen"><div className="route-stop-frame"><section className="route-stop-panel">
    {run.phase === 'shop' ? <>
      <div className="route-stop-topline"><span className="eyebrow">COLUMN {run.encounter + 1} / 10 · STORE</span><span className="route-stop-wallet"><PixelIcon name="coin" /> {run.coins} coins</span></div><h2>Traveling Store</h2>
      <p>Buy supplies for your next battle. Equip held items from Party; use TMs and evolution items from Bag when you return to the route.</p>
      <div className="shop-grid">{SHOP_STOCK.map(offer => {
        const shortfall = Math.max(0, offer.price - run.coins);
        return <button key={offer.item} type="button" disabled={shortfall > 0} aria-label={`Buy ${offer.item} for ${offer.price} coins${shortfall ? `, need ${shortfall} more coins` : ''}`} onClick={() => { onBuy(offer.item); setPurchaseMessage(`${offer.item} added to your bag.`); }}>
          <img src={`/assets/ui/icons/item-${offer.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" />
          <span className="shop-item-copy"><strong>{offer.item}</strong><small>{itemFor(offer.item)?.description}</small><em>{shortfall ? `Need ${shortfall} more coins` : 'Buy item'}</em></span><b>{offer.price}<small>COINS</small></b>
        </button>;
      })}</div>
      <div className="route-stop-bag"><b><PixelIcon name="bag" /> Bag · {run.bag.length}</b><span>{bagGroups.length ? bagGroups.map(([item, count]) => <span key={item}>{item} <strong>×{count}</strong></span>) : <span>Empty</span>}</span></div>
      <footer className="route-stop-actions"><p role="status" aria-live="polite">{purchaseMessage}</p><button type="button" className="primary" onClick={onContinue}>Continue route <PixelIcon name="arrow-right" /></button></footer>
    </> : <>
      {(() => {
        const nodeKind = run.route.nodes.find(node => node.id === run.currentNodeId)?.kind;
        const event = run.pendingRouteEvent;
        const title = nodeKind === 'recruit' ? 'Recruitment camp' : 'A hidden clearing';
        const eventCopy = event?.kind === 'coins' ? `A traveler left behind ${event.amount} coins.`
          : event?.kind === 'loss-coins' ? 'A trap springs. You will lose half your coins.'
            : event?.kind === 'item' ? `A traveler left behind a ${event.item}.`
              : event?.kind === 'heal' ? 'A warm spring can restore 25% HP to every Pokémon.'
                : event?.kind === 'ambush' ? 'A cave ambush will deal 20% HP damage to the whole roster.'
                  : 'Choose one Pokémon to join your roster.';
        const offered = offerRecruits(run);
        return <>
      <div className="route-stop-topline"><span className="eyebrow">COLUMN {run.encounter + 1} / 10 · {nodeKind === 'recruit' ? 'RECRUIT' : 'SPECIAL'}</span><span className="route-stop-wallet"><PixelIcon name="coin" /> {run.coins} coins</span></div><h2>{title}</h2>
      <p>{eventCopy}</p>
      {nodeKind === 'recruit' ? <><p className="route-recruit-step">{rosterFull ? '1 · Choose a recruit, then make room in your roster.' : `Choose your free recruit · ${run.party.length} / ${MAX_RUN_POKEMON} owned`}</p><div className="special-options">{offered.map(species => <button key={species} ref={element => { if (element) recruitTriggers.current.set(species, element); else recruitTriggers.current.delete(species); }} type="button" aria-pressed={rosterFull ? pendingSpecies === species : undefined} onClick={() => {
        if (rosterFull) { setPendingSpecies(species); setReplaceId(undefined); }
        else onRecruit(species);
      }}><span className="special-choice-portrait"><SpeciesPortrait id={species} /></span><b>{SPECIES[species].name}</b><span>{SPECIES[species].types.join(' / ')}</span><span className="special-recruit-action">{pendingSpecies === species ? 'SELECTED' : 'RECRUIT'} <PixelIcon name={pendingSpecies === species ? 'check' : 'plus'} /></span></button>)}</div></> : <><div className={`route-event-reward${event?.kind === 'loss-coins' || event?.kind === 'ambush' ? ' setback' : ''}`}><PixelIcon name={event?.kind === 'coins' || event?.kind === 'loss-coins' ? 'coin' : event?.kind === 'heal' || event?.kind === 'ambush' ? 'heart' : 'bag'} /><span><b>{event?.kind === 'loss-coins' || event?.kind === 'ambush' ? 'Setback' : 'Discovery'}</b><small>{event?.kind === 'coins' ? `+${event.amount} coins` : event?.kind === 'loss-coins' ? 'Lose 50% of current coins' : event?.kind === 'heal' ? 'Restore 25% roster HP' : event?.kind === 'ambush' ? 'Lose 20% roster HP' : event?.kind === 'item' ? event.item : 'Claim this encounter to continue.'}</small></span></div><footer className="route-stop-actions"><p>Resolve this encounter to open the next route choices.</p><button type="button" className="primary" onClick={onClaim}>Accept encounter <PixelIcon name="arrow-right" /></button></footer></>}
      {rosterFull && pendingSpecies && nodeKind === 'recruit' && <section className="special-replacement" aria-label="Replace a roster member">
        <h3 ref={replacementHeading} tabIndex={-1}>2 · Make room for {SPECIES[pendingSpecies].name}</h3>
        <p>Choose one Pokémon to release. Its held item returns to your bag. The recruit takes its roster slot and, if selected, its party slot.</p>
        <div className="special-replacement-list" role="group" aria-label="Pokémon to release">{run.party.map(mon => <button key={mon.id} type="button" className={replaceId === mon.id ? 'chosen' : ''} aria-pressed={replaceId === mon.id} onClick={() => setReplaceId(mon.id)}>
          <SpeciesPortrait id={mon.species} /><span><b>{SPECIES[mon.species].name}</b><small>Lv {mon.level} · {mon.hp} HP{mon.item !== 'None' ? ` · ${mon.item}` : ''}{run.selected.includes(mon.id) ? ' · In party' : ''}</small></span>
        </button>)}</div>
        <p className="special-replacement-summary" role="status">{leaving ? `${SPECIES[leaving.species].name} will leave; ${SPECIES[pendingSpecies].name} will join.` : 'Select a Pokémon above to continue.'}</p>
        <div className="special-replacement-actions"><button type="button" onClick={() => { const trigger = recruitTriggers.current.get(pendingSpecies); setPendingSpecies(undefined); setReplaceId(undefined); requestAnimationFrame(() => trigger?.focus()); }}>Cancel</button><button type="button" className="primary" disabled={!leaving} onClick={() => { if (leaving) onRecruit(pendingSpecies, leaving.id); }}>Confirm replacement <PixelIcon name="check" /></button></div>
      </section>}
        </>;
      })()}
    </>}
  </section></div></main>;
}
