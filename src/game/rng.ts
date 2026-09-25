/** All gameplay rolls advance saved state, so a run can be reproduced from its seed. */
export type RandomState = { rngState: number };

export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function random(state: RandomState): number {
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 0x100000000;
}
