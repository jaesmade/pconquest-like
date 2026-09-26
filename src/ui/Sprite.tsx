import manifest from '../../public/assets/animations/animation-manifest.json';

export default function Sprite({ id }: { id: string }) {
  const units: Record<string, string> = manifest.units;
  return <span className="portrait" style={{ backgroundImage: `url(${units[id] ?? units[manifest.fallbackUnit]})` }} aria-hidden="true" />;
}
