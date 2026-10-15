import { describe, expect, it } from 'vitest';
import { createNearbyChoices } from './choices';
import { createChoices } from './distractors';
import { createFinanceChoices } from './finance';

function seeded(seed: number) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
}

describe('réponses proches', () => {
  it('peut proposer 48, 50, 52 et 55 pour une bonne réponse de 50', () => {
    const draws = [.34, .34, .9, .3, .999, .999, .999];
    expect(createNearbyChoices(50, () => draws.shift()!)).toEqual([48, 50, 52, 55]);
  });
  it.each([0, 1, -1, 19, -19, 20, 50, -50, 99, 100, -100, 999, 1000, -2500, 22500])('garde quatre entiers distincts et proches de %i', answer => {
    const random = seeded(123);
    for (let i = 0; i < 100; i++) {
      const choices = createNearbyChoices(answer, random);
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices.filter(value => value === answer)).toHaveLength(1);
      expect(choices.every(Number.isSafeInteger)).toBe(true);
      expect(choices.some(value => Object.is(value, -0))).toBe(false);
      const span = Math.abs(answer) < 20 ? 6 : Math.abs(answer) < 100 ? 9 : Math.abs(answer) < 1000 ? 15 : 30;
      expect(Math.max(...choices) - Math.min(...choices)).toBeLessThanOrEqual(span);
    }
  });
  it('ne place pas systématiquement le résultat au milieu, à une extrémité ou dans le même bouton', () => {
    const random = seeded(17), ranks = [0, 0, 0, 0], positions = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) {
      const choices = createNearbyChoices(50, random);
      positions[choices.indexOf(50)]++;
      ranks[[...choices].sort((a, b) => a - b).indexOf(50)]++;
    }
    for (const count of [...ranks, ...positions]) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
  it('ne donne plus un indice par le signe ou un ordre de grandeur très différent', () => {
    const random = seeded(8);
    for (let i = 0; i < 100; i++) {
      const positive = createChoices({ operands: [25, 25], operators: ['+'] }, random);
      expect(positive.every(value => value > 0 && Math.abs(value - 50) <= 9)).toBe(true);
      const negative = createChoices({ operands: [-25, 25], operators: ['−'] }, random);
      expect(negative.every(value => value < 0 && Math.abs(value + 50) <= 9)).toBe(true);
      const product = createChoices({ operands: [24, 15], operators: ['×'] }, random);
      expect(product.every(value => Math.abs(value - 360) <= 15)).toBe(true);
    }
  });
  it('applique le même principe en Finance et garde les montants positifs ou nuls', () => {
    const random = seeded(5);
    for (const amount of [100, 250, 2000]) for (let i = 0; i < 100; i++) {
      const choices = createFinanceChoices({ kind: 'portion', amount, rate: 5 }, random);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(amount * .05);
      expect(choices.every(value => value >= 0)).toBe(true);
      expect(Math.max(...choices) - Math.min(...choices)).toBeLessThanOrEqual(15);
    }
  });
  it('reste valide avec un hasard constant', () => {
    expect(new Set(createNearbyChoices(0, () => 0, true)).size).toBe(4);
    expect(new Set(createNearbyChoices(50, () => .999)).size).toBe(4);
  });
});
