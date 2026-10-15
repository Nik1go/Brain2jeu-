// The first eight levels are data, rather than separate game modes.
export const TRAIN_COLORS = [
  { id: 'coral', name: 'corail', color: '#CF594B', symbol: '●' },
  { id: 'blue', name: 'bleue', color: '#427BC0', symbol: '◆' },
  { id: 'gold', name: 'dorée', color: '#BD890F', symbol: '★' },
  { id: 'violet', name: 'violette', color: '#8653B1', symbol: '✿' },
  { id: 'mint', name: 'menthe', color: '#248574', symbol: '▲' },
  { id: 'pink', name: 'rose', color: '#BC4F88', symbol: '♥' },
  { id: 'orange', name: 'orange', color: '#C76B20', symbol: '✚' },
  { id: 'indigo', name: 'indigo', color: '#53549E', symbol: '■' },
  { id: 'olive', name: 'olive', color: '#687B27', symbol: '☾' },
] as const;
export const TRAIN_LEVELS = Array.from({ length: 8 }, (_, i) => ({ level: i + 1, stations: i + 2 }));
export const TRAIN_RULES = {
  durationMs: 120_000,
  maxErrors: 3,
  speed: 62, // SVG units / second, identical in all phases and levels.
  firstSpawnMs: 1_200,
  baseIntervalSeconds: 5,
  intervalDecreasePerLevel: .3,
  minimumBaseSeconds: 2.8,
  phaseMultipliers: [1.15, 1, .9, .8],
  absoluteMinimumSeconds: 1.8,
  arrivalMarginMs: 500,
  feedbackMs: 750,
} as const;
export type TrainColor = typeof TRAIN_COLORS[number];
export type Random = () => number;
export function levelConfig(level: number) {
  const config = TRAIN_LEVELS[level - 1];
  if (!config) throw new RangeError(`Unknown train level: ${level}`);
  return config;
}
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
