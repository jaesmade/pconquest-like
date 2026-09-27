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
  onRecruit: (species: string) => void;
  onTakeCoins: () => void;
};

export default function RouteStopScreen({ run, onBuy, onContinue, onRecruit, onTakeCoins }: Props) {
  return <main className="route-stop-screen"><section className="route-stop-panel">
    {run.phase === 'shop' ? <>
      <span className="eyebrow">COLUMN {run.encounter + 1} · STORE</span><h2>Traveling Store</h2>
      <p>You have <b>{run.coins} coins</b>. Purchased items go into your bag and can be assigned to a Pokémon during preparation.</p>
      <div className="shop-grid">{SHOP_STOCK.map(offer => <button key={offer.item} type="button" disabled={run.coins < offer.price} onClick={() => onBuy(offer.item)}><img src={`/assets/ui/icons/item-${offer.item.toLowerCase().replaceAll(' ', '-')}.svg`} alt="" /><span><strong>{offer.item}</strong><small>{itemFor(offer.item)?.description}</small></span><b>{offer.price} coins</b></button>)}</div>
      <p>Bag: {run.bag.length ? run.bag.join(', ') : 'Empty'}</p>
      <button className="primary" onClick={onContinue}>Continue route →</button>
    </> : <>
      <span className="eyebrow">COLUMN {run.encounter + 1} · SPECIAL</span><h2>A hidden clearing</h2>
      <p>Two wandering Pokémon offer to join you. Nearby, you spot a cache of coins. Choose one reward.</p>
      <div className="special-options">{offerRecruits(run).map(species => <button key={species} disabled={run.party.length >= MAX_RUN_POKEMON} onClick={() => onRecruit(species)}><Sprite id={species} /><b>Recruit {SPECIES[species].name}</b><span>Free recruit · {run.party.length} / {MAX_RUN_POKEMON} owned</span></button>)}<button onClick={onTakeCoins}><b>Take the cache</b><span>Gain 18 coins</span></button></div>
    </>}
  </section></main>;
}
