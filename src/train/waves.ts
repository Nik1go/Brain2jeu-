import { levelConfig, shuffle, TRAIN_COLORS, TRAIN_RULES, TRAIN_WAVE_RULES } from './config';
import type { Random } from './config';
import type { Network } from './network';

export interface Spawn { id: number; atMs: number; colorId: string }
type Rhythm = 'rush' | 'flow' | 'solo';
function between([min, max]: readonly [number, number], random: Random): number {
  return min + (max - min) * random();
}
function groupSize(rhythm: Rhythm, level: number, random: Random): number {
  if (rhythm === 'solo') return 1;
  const extra = Math.floor((level - 1) / TRAIN_WAVE_RULES.levelsPerExtraRushTrain);
  const [min, max] = TRAIN_WAVE_RULES[rhythm === 'rush' ? 'rushSize' : 'flowSize'];
  return min + Math.floor((max - min + 1) * random()) + (rhythm === 'rush' ? extra : Math.floor(extra / 2));
}
function groupGapMs(rhythm: Rhythm, level: number, atMs: number, random: Random): number {
  const base = spawnIntervalMs(level, atMs), minimum = TRAIN_WAVE_RULES.minimumGapMs;
  // Keep a little jitter even inside a rush; never accelerate the trains themselves.
  return rhythm === 'rush'
    ? minimum + Math.max(0, base - minimum) * between(TRAIN_WAVE_RULES.rushSlackFraction, random)
    : Math.max(minimum, base * between(TRAIN_WAVE_RULES.flowMultiplier, random));
}
function transitionGapMs(previous: Rhythm, next: Rhythm, level: number, atMs: number, random: Random): number {
  // A solo train is surrounded by quiet; a rush is followed by a recovery.
  if (previous === 'solo' || next === 'solo') return between(TRAIN_WAVE_RULES.quietGapMs, random);
  if (previous !== 'rush') return groupGapMs('flow', level, atMs, random);
  const [min, max] = TRAIN_WAVE_RULES.recoveryGapMs;
  return Math.max(min, Math.min(max, spawnIntervalMs(level, atMs) * between(TRAIN_WAVE_RULES.recoveryMultiplier, random)));
}
// Density increases through the round; this is a reference, not a fixed interval.
export function spawnIntervalMs(level: number, atMs: number): number {
  const base = Math.max(TRAIN_RULES.minimumBaseSeconds, TRAIN_RULES.baseIntervalSeconds - TRAIN_RULES.intervalDecreasePerLevel * (level - 1));
  const phase = Math.min(3, Math.floor(atMs / (TRAIN_RULES.durationMs / 4)));
  return Math.max(TRAIN_RULES.absoluteMinimumSeconds, base * TRAIN_RULES.phaseMultipliers[phase]) * 1000;
}
export function colorSequence(count: number, colorIds: string[], random: Random = Math.random, previous?: string[]): string[] {
  const result: string[] = [];
  while (result.length < count) {
    const bag = shuffle(colorIds, random);
    for (let i = 0; i < bag.length && result.length < count; i++) {
      const n = result.length;
      if (n >= 2 && result[n - 1] === bag[i] && result[n - 2] === bag[i]) {
        const other = bag.findIndex((c, j) => j > i && c !== bag[i]);
        [bag[i], bag[other]] = [bag[other], bag[i]];
      }
      result.push(bag[i]);
    }
  }
  // Rotate every color label, preserving bag balance and the run-length limit.
  if (previous && result.join('|') === previous.join('|')) return result.map(c => colorIds[(colorIds.indexOf(c) + 1) % colorIds.length]);
  return result;
}
export function createSchedule(network: Pick<Network, 'level'>, random: Random = Math.random, previousColors?: string[]): Spawn[] {
  const times: number[] = [];
  let rhythms: Rhythm[] = [], previous: Rhythm | undefined, atMs = TRAIN_RULES.firstSpawnMs;
  while (atMs < TRAIN_RULES.durationMs) {
    if (!rhythms.length) {
      // Each bag includes all three rhythms, without a predictable order or a repeat at its boundary.
      rhythms = shuffle<Rhythm>(['rush', 'flow', 'solo'], random);
      if (rhythms[0] === previous) [rhythms[0], rhythms[1]] = [rhythms[1], rhythms[0]];
    }
    const rhythm = rhythms.shift()!;
    if (previous) atMs += Math.round(transitionGapMs(previous, rhythm, network.level, atMs, random));
    const count = groupSize(rhythm, network.level, random);
    for (let i = 0; i < count && atMs < TRAIN_RULES.durationMs; i++) {
      times.push(atMs);
      if (i < count - 1) atMs += Math.round(groupGapMs(rhythm, network.level, atMs, random));
    }
    previous = rhythm;
  }
  const colors = colorSequence(times.length, TRAIN_COLORS.slice(0, levelConfig(network.level).stations).map(c => c.id), random, previousColors);
  return times.map((atMs, id) => ({ id, atMs, colorId: colors[id] }));
}
