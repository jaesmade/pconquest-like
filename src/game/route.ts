import { random } from './rng';

export const ROUTE_COLUMNS = 10;
export type RouteNodeKind = 'battle' | 'elite' | 'heal' | 'store' | 'special' | 'boss';
export type RouteNode = { id: string; column: number; lane: number; kind: RouteNodeKind };
export type RouteLink = { from: string; to: string };
export type RoutePlan = { nodes: RouteNode[]; links: RouteLink[]; visited: string[] };

const pick = <T,>(values: T[], state: { rngState: number }): T => values[Math.floor(random(state) * values.length)];

/** Route generation has its own RNG stream, so revealing the map never consumes combat rolls. */
export function createRoute(seed: number): RoutePlan {
  const state = { rngState: (seed ^ 0x726f7574) >>> 0 };
  const nodes: RouteNode[] = [{ id: 'route-1-1', column: 1, lane: 1, kind: 'battle' }];
  const choices: Partial<Record<number, [RouteNodeKind, RouteNodeKind]>> = {
    2: ['heal', 'store'], 3: ['special', 'elite'], 5: ['battle', 'special'],
    7: ['special', 'store'], 9: ['elite', 'battle'],
  };
  for (let column = 2; column < ROUTE_COLUMNS; column++) {
    const kinds = choices[column] ?? [pick<RouteNodeKind>(['battle', 'elite', 'heal'], state), pick<RouteNodeKind>(['battle', 'store', 'special'], state)];
    for (const [index, kind] of kinds.entries()) {
      const lane = index * 2;
      nodes.push({ id: `route-${column}-${lane}`, column, lane, kind });
    }
  }
  nodes.push({ id: 'route-10-1', column: ROUTE_COLUMNS, lane: 1, kind: 'boss' });
  const links: RouteLink[] = [];
  for (let column = 1; column < ROUTE_COLUMNS; column++) {
    const from = nodes.filter(node => node.column === column), to = nodes.filter(node => node.column === column + 1);
    if (column === 1 || column === 9) {
      for (const source of from) for (const target of to) links.push({ from: source.id, to: target.id });
      continue;
    }
    for (const source of from) links.push({ from: source.id, to: to.find(target => target.lane === source.lane)!.id });
    const crossLane = column === 4 ? 0 : column === 6 ? 2 : random(state) < 0.5 ? 0 : 2;
    links.push({ from: from.find(node => node.lane === crossLane)!.id, to: to.find(node => node.lane !== crossLane)!.id });
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

export function legacyRoute(seed: number, completed: number, active: boolean): RoutePlan {
  const route = createRoute(seed);
  const count = Math.min(ROUTE_COLUMNS, completed + (active ? 1 : 0));
  for (let i = 0; i < count; i++) {
    const next = availableRouteNodes(route);
    route.visited.push((next.find(node => node.lane === 0) ?? next[0]).id);
  }
  return route;
}
