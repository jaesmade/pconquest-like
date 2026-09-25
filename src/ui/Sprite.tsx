import { STARTERS } from '../content/data';

export default function Sprite({ id }: { id: string }) {
  const texture = STARTERS.includes(id) ? id : 'placeholder';
  return <span className="portrait" style={{ backgroundImage: `url(/assets/animations/units/${texture}/${texture}-battle-32px.png)` }} aria-hidden="true" />;
}
