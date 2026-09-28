import { useState } from 'react';
import { itemFor, SPECIES } from '../content/data';
import { MAX_RUN_POKEMON } from '../content/roster';
import { SHOP_STOCK } from '../content/shop';
import { offerRecruits } from '../game/engine';
import type { Run } from '../game/types';
import type { ItemId } from '../content/items';
import Sprite from './Sprite';

type Props = {
  run: Run;
  onBuy: (item: ItemId) => void;
  onContinue: () => void;
  onRecruit: (species: string, replaceId?: string) => void;
  onTakeCoins: () => void;
};

export default function RouteStopScreen({ run, onBuy, onContinue, onRecruit, onTakeCoins }: Props) {
  const [pendingSpecies, setPendingSpecies] = useState<string>();
  const [replaceId, setReplaceId] = useState<string>();
  const rosterFull = run.party.length >= MAX_RUN_POKEMON;
  const leaving = run.party.find(mon => mon.id === replaceId);
  return <main className="route-stop-screen"><div className="route-stop-frame"><section className="route-stop-panel">
    {run.phase === 'shop' ? <>
      <span className="eyebrow">COLUMN {run.encounter + 1} · STORE</span><h2>Traveling Store</h2>
      <p>You have <b>{run.coins} coins</b>. Purchased items go into your bag and can be assigned to a Pokémon at the next route choice.</p>
      <div className="shop-grid">{SHOP_STOCK.map(offer => <button key={offer.item} type="button" disabled={run.coins < offer.price} onClick={() => onBuy(offer.item)}><img src={`/assets/ui/icons/item-${offer.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" /><span><strong>{offer.item}</strong><small>{itemFor(offer.item)?.description}</small></span><b>{offer.price} coins</b></button>)}</div>
      <p>Bag: {run.bag.length ? run.bag.join(', ') : 'Empty'}</p>
      <button className="primary" onClick={onContinue}>Continue route →</button>
    </> : <>
      <span className="eyebrow">COLUMN {run.encounter + 1} · SPECIAL</span><h2>A hidden clearing</h2>
      <p>Two wandering Pokémon offer to join you. Nearby, you spot a cache of coins. Choose one reward.</p>
      <div className="special-options">{offerRecruits(run).map(species => <button key={species} type="button" aria-pressed={rosterFull ? pendingSpecies === species : undefined} onClick={() => {
        if (rosterFull) { setPendingSpecies(species); setReplaceId(undefined); }
        else onRecruit(species);
      }}><Sprite id={species} /><b>Recruit {SPECIES[species].name}</b><span>{rosterFull ? 'Choose a roster member to replace' : 'Free recruit'} · {run.party.length} / {MAX_RUN_POKEMON} owned</span></button>)}<button type="button" onClick={onTakeCoins}><b>Take the cache</b><span>Gain 18 coins</span></button></div>
      {rosterFull && pendingSpecies && <section className="special-replacement" aria-label="Replace a roster member">
        <h3>Make room for {SPECIES[pendingSpecies].name}</h3>
        <p>Choose one Pokémon to release. Its held item returns to your bag. The recruit takes its roster slot and, if selected, its party slot.</p>
        <div className="special-replacement-list" role="group" aria-label="Pokémon to release">{run.party.map(mon => <button key={mon.id} type="button" className={replaceId === mon.id ? 'chosen' : ''} aria-pressed={replaceId === mon.id} onClick={() => setReplaceId(mon.id)}>
          <Sprite id={mon.species} /><span><b>{SPECIES[mon.species].name}</b><small>Lv {mon.level} · {mon.hp} HP{mon.item !== 'None' ? ` · ${mon.item}` : ''}{run.selected.includes(mon.id) ? ' · In party' : ''}</small></span>
        </button>)}</div>
        <p className="special-replacement-summary">{leaving ? `${SPECIES[leaving.species].name} will leave; ${SPECIES[pendingSpecies].name} will join.` : 'Select a Pokémon above to continue.'}</p>
        <div className="special-replacement-actions"><button type="button" onClick={() => { setPendingSpecies(undefined); setReplaceId(undefined); }}>Cancel</button><button type="button" className="primary" disabled={!leaving} onClick={() => { if (leaving) onRecruit(pendingSpecies, leaving.id); }}>Confirm replacement</button></div>
      </section>}
    </>}
  </section></div></main>;
}
