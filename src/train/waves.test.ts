import { describe, expect, it } from 'vitest';
import { TRAIN_COLORS, TRAIN_LEVELS, TRAIN_RULES, TRAIN_WAVE_RULES } from './config';
import { createSchedule } from './waves';

function seeded(initial: number) {
  let seed = initial;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function timings(level: number, seed: number) {
  return createSchedule({ level }, seeded(seed)).map(s => s.atMs);
}
function gaps(times: number[]) { return times.slice(1).map((t, i) => t - times[i]); }

describe('arrivées par vagues irrégulières', () => {
  it('mêle rushs, accalmies et trains isolés dans chaque niveau', () => {
    for (const { level } of TRAIN_LEVELS) for (let seed = 1; seed <= 120; seed++) {
      const times = timings(level, seed), intervals = gaps(times);
      expect(times[0]).toBe(TRAIN_RULES.firstSpawnMs);
      expect(times.at(-1)).toBeLessThan(TRAIN_RULES.durationMs);
      expect(times.at(-1)).toBeGreaterThanOrEqual(TRAIN_RULES.durationMs - TRAIN_WAVE_RULES.quietGapMs[1]);
      expect(intervals.every(gap => gap >= TRAIN_WAVE_RULES.minimumGapMs && gap <= TRAIN_WAVE_RULES.quietGapMs[1])).toBe(true);
      // Several close trains, and a single train with quiet on both sides.
      expect(intervals.some((gap, i) => gap < 2700 && intervals[i + 1] < 2700)).toBe(true);
      expect(intervals.some((gap, i) => gap >= TRAIN_WAVE_RULES.quietGapMs[0] && intervals[i + 1] >= TRAIN_WAVE_RULES.quietGapMs[0])).toBe(true);
      expect(intervals.every(gap => gap - 50 / TRAIN_RULES.speed * 1000 > 1000)).toBe(true);
    }
  });
  it('renouvelle les horaires au rejeu et permet de reproduire une partie avec sa graine', () => {
    for (const { level } of TRAIN_LEVELS) {
      const schedules = Array.from({ length: 40 }, (_, i) => timings(level, i + 1));
      expect(new Set(schedules.map(times => times.join('|'))).size).toBe(40);
      expect(timings(level, 42)).toEqual(timings(level, 42));
    }
  });
  it('augmente la densité avec le niveau sans rendre les rushs impossibles', () => {
    const counts = TRAIN_LEVELS.map(({ level }) => Array.from({ length: 120 }, (_, i) => timings(level, i + 1).length));
    const means = counts.map(values => values.reduce((sum, n) => sum + n, 0) / values.length);
    expect(means[0]).toBeGreaterThan(30);
    expect(means[0]).toBeLessThan(40);
    expect(means[7]).toBeGreaterThan(43);
    expect(means[7]).toBeLessThan(55);
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeGreaterThan(means[i - 1]);
  });
  it('conserve des identifiants uniques et des sacs de couleurs équilibrés malgré les rushs', () => {
    for (const { level, stations } of TRAIN_LEVELS) {
      const schedule = createSchedule({ level }, seeded(level));
      const colors = TRAIN_COLORS.slice(0, stations).map(c => c.id).sort();
      expect(schedule.map(s => s.id)).toEqual(schedule.map((_, i) => i));
      for (let i = 0; i + stations <= schedule.length; i += stations) {
        expect(schedule.slice(i, i + stations).map(s => s.colorId).sort()).toEqual(colors);
      }
    }
  });
  it('reste borné même avec des tirages toujours proches d’une extrémité', () => {
    for (const { level } of TRAIN_LEVELS) for (const roll of [0, 1 - Number.EPSILON]) {
      const schedule = createSchedule({ level }, () => roll), intervals = gaps(schedule.map(s => s.atMs));
      expect(schedule.length).toBeGreaterThan(25);
      expect(schedule.length).toBeLessThan(65);
      expect(intervals.every(gap => gap >= TRAIN_WAVE_RULES.minimumGapMs && gap <= TRAIN_WAVE_RULES.quietGapMs[1])).toBe(true);
    }
  });
});
