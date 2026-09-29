import { random } from './rng';

export const ROUTE_COLUMNS = 10;
export type RouteNodeKind = 'battle' | 'elite' | 'heal' | 'store' | 'special' | 'recruit' | 'boss';
export type RouteNode = { id: string; column: number; lane: number; kind: RouteNodeKind };
export type RouteLink = { from: string; to: string };
export type RoutePlan = { nodes: RouteNode[]; links: RouteLink[]; visited: string[] };

const middleLanes: Record<number, number[]> = { 2: [0, 3], 3: [0, 1.5, 3], 4: [0, 1, 2, 3] };
const guaranteedKinds: Partial<Record<number, RouteNodeKind[]>> = {
  2: ['heal', 'store'], 3: ['special', 'elite'], 5: ['battle', 'recruit'],
  7: ['special', 'store'], 9: ['elite', 'battle'],
};
const routeKinds: RouteNodeKind[] = ['battle', 'elite', 'heal', 'store', 'special', 'recruit'];

function shuffled<T>(values: T[], state: { rngState: number }): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(random(state) * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function addLink(links: RouteLink[], seen: Set<string>, from: RouteNode, to: RouteNode) {
  const key = `${from.id}:${to.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  links.push({ from: from.id, to: to.id });
}

/** Route generation has its own RNG stream, so revealing the map never consumes combat rolls. */
export function createRoute(seed: number): RoutePlan {
  const state = { rngState: (seed ^ 0x726f7574) >>> 0 };
  const nodes: RouteNode[] = [{ id: 'route-1-1', column: 1, lane: 1.5, kind: 'battle' }];
  for (let column = 2; column < ROUTE_COLUMNS; column++) {
    const count = column === 4 || column === 7 ? 4 : 2 + Math.floor(random(state) * 3);
    const kinds = [...(guaranteedKinds[column] ?? ['battle'])];
    for (const kind of shuffled(routeKinds, state)) if (kinds.length < count && !kinds.includes(kind)) kinds.push(kind);
    const orderedKinds = shuffled(kinds.slice(0, count), state);
    for (let index = 0; index < count; index++) nodes.push({
      id: `route-${column}-${index + 1}`, column, lane: middleLanes[count][index], kind: orderedKinds[index],
    });
  }
  nodes.push({ id: 'route-10-1', column: ROUTE_COLUMNS, lane: 1.5, kind: 'boss' });
  const links: RouteLink[] = [];
  const seen = new Set<string>();
  for (let column = 1; column < ROUTE_COLUMNS; column++) {
    const from = nodes.filter(node => node.column === column), to = nodes.filter(node => node.column === column + 1);
    if (column === 1 || column === 9) {
      for (const source of from) for (const target of to) addLink(links, seen, source, target);
      continue;
    }
    for (const source of from) {
      const nearest = [...to].sort((a, b) => Math.abs(a.lane - source.lane) - Math.abs(b.lane - source.lane));
      addLink(links, seen, source, nearest[0]);
      if (nearest[1] && (from.length < to.length || random(state) < .68)) addLink(links, seen, source, nearest[1]);
    }
    for (const target of to) {
      const nearest = [...from].sort((a, b) => Math.abs(a.lane - target.lane) - Math.abs(b.lane - target.lane))[0];
      addLink(links, seen, nearest, target);
    }
  }
  return { nodes, links, visited: [] };
}

export function routeNode(route: RoutePlan, id: string | undefined): RouteNode | undefined {
  return route.nodes.find(node => node.id === id);
}

export function availableRouteNodes(route: RoutePlan): RouteNode[] {
  const column = route.visited.length + 1;
  const previous = routeNode(route, route.visited.at(-1));
  return route.nodes.filter(node => node.column === column && (!previous || route.links.some(link => link.from === previous.id && link.to === node.id)));
}

export function routeIsValid(route: RoutePlan, seed: number): boolean {
  if (!route || !Array.isArray(route.nodes) || !Array.isArray(route.links) || !Array.isArray(route.visited)) return false;
  const expected = createRoute(seed);
  if (JSON.stringify(route.nodes) !== JSON.stringify(expected.nodes) || JSON.stringify(route.links) !== JSON.stringify(expected.links) || route.visited.length > ROUTE_COLUMNS) return false;
  const progress: RoutePlan = { nodes: route.nodes, links: route.links, visited: [] };
  for (const id of route.visited) {
    if (!availableRouteNodes(progress).some(node => node.id === id)) return false;
    progress.visited.push(id);
  }
  return true;
}

/** Rebuilds an older saved graph while keeping the same progress and node kinds when possible. */
export function migrateRoutePlan(route: RoutePlan, seed: number): RoutePlan {
  const migrated = createRoute(seed);
  for (const id of route.visited) {
    const oldNode = routeNode(route, id);
    const available = availableRouteNodes(migrated);
    if (!available.length) break;
    const sameKind = oldNode ? available.filter(node => node.kind === oldNode.kind) : [];
    const candidates = sameKind.length ? sameKind : available;
    const chosen = [...candidates].sort((a, b) => Math.abs(a.lane - (oldNode?.lane ?? 1.5)) - Math.abs(b.lane - (oldNode?.lane ?? 1.5)))[0];
    migrated.visited.push(chosen.id);
  }
  return migrated;
}

export function legacyRoute(seed: number, completed: number, active: boolean): RoutePlan {
  const route = createRoute(seed);
  const count = Math.min(ROUTE_COLUMNS, completed + (active ? 1 : 0));
  for (let i = 0; i < count; i++) {
    const next = availableRouteNodes(route);
    route.visited.push([...next].sort((a, b) => Math.abs(a.lane - 1.5) - Math.abs(b.lane - 1.5))[0].id);
  }
  return route;
}
