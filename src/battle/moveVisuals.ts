import manifest from '../../public/assets/animations/animation-manifest.json';
import { MOVES } from '../content/moves';
import { moveAssetRole } from '../content/moveAssetRoles';

type VisualStyle = 'melee' | 'projectile' | 'area' | 'self' | 'weather';
type VisualAsset = { url: string; style: VisualStyle };
const assets = manifest.attacks as Record<string, VisualAsset>;
const placeholderIds = ['placeholderMelee', 'placeholderProjectile', 'placeholderArea', 'placeholderSelf', 'placeholderHazard', 'placeholderWeather'];
const visualStyles = new Set<VisualStyle>(['melee', 'projectile', 'area', 'self', 'weather']);

const typeTints: Record<string, number> = {
  Normal: 0xd4d2c9, Fire: 0xff9256, Water: 0x62b9ee, Grass: 0x8ddc71,
  Electric: 0xffd64b, Ice: 0x9ce9ef, Fighting: 0xe1846a, Poison: 0xbb82d1,
  Ground: 0xd7af75, Flying: 0xa9c8f1, Psychic: 0xf58cae, Bug: 0xaaca65,
  Rock: 0xc5ac80, Ghost: 0x9e91d5, Dragon: 0x9291ed, Dark: 0x9c9aa5,
  Steel: 0xb5cbd1, Fairy: 0xf2aee0,
};

export function moveVisualFor(moveId: string): { id: string; asset: VisualAsset; tint?: number } {
  const move = MOVES[moveId];
  // A named move sheet replaces its placeholder without editing the move definition.
  const role = moveAssetRole(move);
  const defaultId = `placeholder${role[0].toUpperCase()}${role.slice(1)}`;
  const id = assets[moveId] ? moveId : move?.visualId && assets[move.visualId] ? move.visualId : defaultId;
  return { id, asset: assets[id], tint: id.startsWith('placeholder') ? typeTints[move?.type ?? 'Normal'] : undefined };
}

export function validateMoveVisuals(): string[] {
  const errors = Object.entries(MOVES).flatMap(([id, move]) => move.visualId && !assets[move.visualId]
    ? [`Move ${id}: unknown visualId ${move.visualId} in animation-manifest.json attacks`]
    : []);
  for (const id of placeholderIds) if (!assets[id]) errors.push(`Animation manifest: missing ${id} move placeholder`);
  for (const [id, asset] of Object.entries(assets)) if (!visualStyles.has(asset.style)) errors.push(`Animation manifest: invalid style for ${id}`);
  return errors;
}
