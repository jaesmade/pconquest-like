import chartCsv from '../../pokemon_single_type_chart.csv?raw';

const [heading, ...lines] = chartCsv.trim().split(/\r?\n/).map(line => line.split(','));
export const TYPES = heading.slice(1);
export const TYPE_CHART: Record<string, Record<string, number>> = Object.fromEntries(
  lines.map(row => [row[0], Object.fromEntries(row.slice(1).map((value, i) => [TYPES[i], Number(value)]))]),
);

export function effectiveness(attack: string, defenders: string[]): number {
  return defenders.reduce((value, type) => value * (TYPE_CHART[type]?.[attack] ?? 1), 1);
}
