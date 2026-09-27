import { unitSet } from '../battle/unitAnimations';

export default function Sprite({ id }: { id: string }) {
  const set = unitSet(id);
  const portrait = set.normal;
  return <span className="portrait" style={{ backgroundImage: `url(${portrait ?? set.clips.idle.url})`, backgroundSize: portrait ? 'contain' : `${set.clips.idle.frames * 100}% auto`, backgroundRepeat: 'no-repeat' }} aria-hidden="true" />;
}
