import { levelConfig, shuffle, TRAIN_COLORS, TRAIN_RULES } from './config';
import type { Random } from './config';
import type { Network } from './network';

export interface Spawn { id: number; atMs: number; colorId: string }
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
export function createSchedule(network: Network, random: Random = Math.random, previousColors?: string[]): Spawn[] {
  const latestSpawn = TRAIN_RULES.durationMs - network.longestDistance / TRAIN_RULES.speed * 1000 - TRAIN_RULES.arrivalMarginMs;
  const times: number[] = [];
  for (let atMs = TRAIN_RULES.firstSpawnMs; atMs <= latestSpawn; atMs += spawnIntervalMs(network.level, atMs)) times.push(atMs);
  const colors = colorSequence(times.length, TRAIN_COLORS.slice(0, levelConfig(network.level).stations).map(c => c.id), random, previousColors);
  return times.map((atMs, id) => ({ id, atMs, colorId: colors[id] }));
}
