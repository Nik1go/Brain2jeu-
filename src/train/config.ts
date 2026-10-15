// The first eight levels are data, rather than separate game modes.
export const TRAIN_COLORS = [
  { id: 'coral', name: 'rouge', color: '#E12E27', ink: '#FFFFFF', symbol: '●' },
  { id: 'blue', name: 'bleue', color: '#176CDB', ink: '#FFFFFF', symbol: '◆' },
  { id: 'gold', name: 'jaune', color: '#FFDC20', ink: '#29352D', symbol: '★' },
  { id: 'violet', name: 'violette', color: '#8534C6', ink: '#FFFFFF', symbol: '✿' },
  { id: 'mint', name: 'verte', color: '#05853A', ink: '#FFFFFF', symbol: '▲' },
  { id: 'pink', name: 'rose', color: '#D92188', ink: '#FFFFFF', symbol: '♥' },
  { id: 'orange', name: 'orange', color: '#F58A12', ink: '#29352D', symbol: '✚' },
  { id: 'indigo', name: 'noire', color: '#202832', ink: '#FFFFFF', symbol: '■' },
  { id: 'olive', name: 'blanche', color: '#F7F8F2', ink: '#29352D', symbol: '☾' },
  { id: 'sky', name: 'cyan', color: '#13BED4', ink: '#29352D', symbol: '⬟' },
  { id: 'brown', name: 'brune', color: '#81481E', ink: '#FFFFFF', symbol: '✦' },
] as const;
export const TRAIN_LEVELS = Array.from({ length: 8 }, (_, i) => ({ level: i + 1, stations: i + 4 }));
export const TRAIN_RULES = {
  durationMs: 120_000,
  maxErrors: 3,
  speed: 62, // SVG units / second, identical in all phases and levels.
  firstSpawnMs: 1_200,
  baseIntervalSeconds: 3.6,
  intervalDecreasePerLevel: .15,
  minimumBaseSeconds: 2.4,
  phaseMultipliers: [1.15, 1, .9, .8],
  absoluteMinimumSeconds: 1.8,
  feedbackMs: 750,
  failureFeedbackMs: 1_400,
} as const;
export const TRAIN_WAVE_RULES = {
  minimumGapMs: 1_900,
  rushSize: [5, 7],
  flowSize: [2, 4],
  levelsPerExtraRushTrain: 2,
  rushSlackFraction: [.08, .25],
  flowMultiplier: [.8, 1.2],
  recoveryMultiplier: [1.15, 1.55],
  recoveryGapMs: [2_800, 5_500],
  quietGapMs: [4_500, 6_500],
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
