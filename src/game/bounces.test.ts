import { describe, expect, it } from 'vitest';
import { BOUNCE_PROFILES, bounceDistribution, sampleBounces } from './bounces';
import { generateBoard, LEVELS, simulate } from './engine';

function seeded(initial: number) {
  let state = initial >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

describe('difficulté des rebonds', () => {
  it('augmente progressivement le centre et les bornes avec une cible réalisable à chaque niveau', () => {
    expect(BOUNCE_PROFILES).toHaveLength(LEVELS.length);
    BOUNCE_PROFILES.forEach((profile, i) => {
      expect(profile.min).toBeGreaterThanOrEqual(1);
      expect(profile.mean).toBeGreaterThanOrEqual(profile.min);
      expect(profile.mean).toBeLessThanOrEqual(profile.max);
      expect(profile.max).toBeLessThanOrEqual(LEVELS[i].mirrors);
      expect(profile.max).toBeLessThan(2 * LEVELS[i].size);
      if (i) {
        expect(profile.mean).toBeGreaterThan(BOUNCE_PROFILES[i - 1].mean);
        expect(profile.mean - BOUNCE_PROFILES[i - 1].mean).toBeLessThanOrEqual(.5);
        if (i >= 8) expect(profile.mean - BOUNCE_PROFILES[i - 1].mean).toBe(.5);
        expect(profile.min).toBeGreaterThanOrEqual(BOUNCE_PROFILES[i - 1].min);
        expect(profile.max).toBeGreaterThanOrEqual(BOUNCE_PROFILES[i - 1].max);
      }
      const probabilities = bounceDistribution(profile);
      expect(probabilities.reduce((sum, item) => sum + item.probability, 0)).toBeCloseTo(1, 12);
      expect(probabilities.every(item => item.probability > 0)).toBe(true);
      const expectedHits = probabilities.reduce((sum, item) => sum + item.hits * item.probability, 0);
      if (i) expect(expectedHits).toBeGreaterThan(bounceDistribution(BOUNCE_PROFILES[i - 1]).reduce((sum, item) => sum + item.hits * item.probability, 0));
      if (i >= 7) {
        expect(profile.mean).toBe(3 + (i - 7) * .5);
        expect(expectedHits).toBeCloseTo(profile.mean, 12);
      }
    });
    expect(BOUNCE_PROFILES[4]).toMatchObject({ min: 1, max: 3 });
    expect(BOUNCE_PROFILES[7]).toEqual({ mean: 3, standardDeviation: .7, min: 2, max: 4 });
  });

  it('utilise des poids gaussiens normalisés, sans accumuler les tirages hors limites aux extrémités', () => {
    const [left, centre, right] = bounceDistribution(BOUNCE_PROFILES[7]);
    const tailWeight = Math.exp(-1 / (2 * .7 ** 2));
    expect(centre.probability).toBeCloseTo(1 / (1 + 2 * tailWeight), 12);
    expect(left.probability).toBeCloseTo(tailWeight / (1 + 2 * tailWeight), 12);
    expect(left.probability).toBe(right.probability);
    expect(centre.probability).toBeGreaterThan(left.probability);
    expect(sampleBounces(BOUNCE_PROFILES[7], () => 0)).toBe(2);
    expect(sampleBounces(BOUNCE_PROFILES[7], () => .5)).toBe(3);
    expect(sampleBounces(BOUNCE_PROFILES[7], () => .999999999)).toBe(4);
  });

  it('génère le nombre exact tiré une fois, même si une autre longueur serait plus facile à trouver', () => {
    BOUNCE_PROFILES.forEach((profile, i) => {
      for (let seed = 1; seed <= 100; seed++) {
        const expected = sampleBounces(profile, seeded(seed * 982451653));
        const board = generateBoard(i + 1, seeded(seed * 982451653));
        expect(board.hits).toBe(expected);
        const actual = simulate(board.size, board.mirrors, board.entry);
        expect(actual?.hits).toBe(expected);
        expect(actual?.path).toEqual(board.path);
        expect(actual?.exit).toEqual(board.exit);
      }
    });
  });

  it('respecte toutes les cibles avec des sources aléatoires dégénérées, sans parcours excessif ni boucle infinie', () => {
    BOUNCE_PROFILES.forEach((profile, i) => {
      let cumulative = 0;
      for (const item of bounceDistribution(profile)) {
        const firstDraw = cumulative + item.probability / 2;
        cumulative += item.probability;
        for (const constant of [0, .25, .5, .75, .999999999]) {
          let first = true;
          const random = () => { if (first) { first = false; return firstDraw; } return constant; };
          const board = generateBoard(i + 1, random);
          expect(board.hits).toBe(item.hits);
          expect(board.mirrors).toHaveLength(LEVELS[i].mirrors);
          expect(new Set(board.mirrors.map(m => `${m.row}:${m.col}`)).size).toBe(LEVELS[i].mirrors);
          expect(board.mirrors.every(m => m.row >= 0 && m.row < board.size && m.col >= 0 && m.col < board.size)).toBe(true);
          expect(simulate(board.size, board.mirrors, board.entry)?.hits).toBe(item.hits);
        }
      }
    });
  }, 15000);

  it.each([8, 9, 12, 17])('retrouve la loi et la moyenne attendues sur les parcours réellement joués au niveau %s', level => {
    const random = seeded(123456789);
    const profile = BOUNCE_PROFILES[level - 1];
    const counts = new Map<number, number>();
    for (let i = 0; i < 5000; i++) {
      const hits = generateBoard(level, random).hits;
      counts.set(hits, (counts.get(hits) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: profile.max - profile.min + 1 }, (_, i) => profile.min + i));
    for (const item of bounceDistribution(profile)) expect(Math.abs((counts.get(item.hits) ?? 0) / 5000 - item.probability)).toBeLessThan(.025);
    expect(Math.abs([...counts].reduce((sum, [hits, count]) => sum + hits * count, 0) / 5000 - profile.mean)).toBeLessThan(.04);
  });

  it('borne aussi le profil utilisé pour les niveaux hors plage', () => {
    for (const [input, expected] of [[0, 1], [-10, 1], [NaN, 1], [100, LEVELS.length]]) {
      expect(generateBoard(input, seeded(1234))).toEqual(generateBoard(expected, seeded(1234)));
    }
  });

  it('refuse un profil incohérent au lieu de produire une probabilité invalide', () => {
    for (const patch of [{ standardDeviation: 0 }, { mean: NaN }, { min: 0 }, { min: 4 }, { max: 2.5 }]) {
      expect(() => bounceDistribution({ ...BOUNCE_PROFILES[7], ...patch })).toThrow('Invalid bounce profile');
    }
  });
});
