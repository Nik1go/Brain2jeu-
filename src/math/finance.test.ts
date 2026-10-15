import { describe, expect, it, vi, afterEach } from 'vitest';
import { LARGE_DIFFICULTIES, MATH_LEVELS } from './config';
import { createChoices } from './distractors';
import { evaluate, generateExpression, signature } from './expressions';
import { createFinanceChoices, evaluateFinance, financeContext, financeSignature, formatFinance, generateFinance } from './finance';
import type { FinanceProblem } from './finance';
import { advanceMathGame, answerMathGame, newMathGame } from './game';
import { emptyMathProgress, finishMathGame, loadMathProgress, MATH_STORAGE_KEY } from './storage';

function seeded(seed: number) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
}
afterEach(() => vi.unstubAllGlobals());

describe('niveau Grands calculs', () => {
  it('conserve les grands nombres avec une seule opération à tous les paliers', () => {
    const random = seeded(148), seen = new Set<number>();
    let recent: string[] = [], large = 0;
    for (let stage = 0; stage < LARGE_DIFFICULTIES.length; stage++) {
      const config = LARGE_DIFFICULTIES[stage];
      for (let i = 0; i < 500; i++) {
        const expression = generateExpression(stage * 5, recent, random, 'large');
        expect(recent).not.toContain(signature(expression));
        expect(expression.operators).toHaveLength(1);
        expression.operands.forEach((n, index) => {
          const multiplied = expression.operators[index] === '×' || expression.operators[index - 1] === '×';
          expect(Math.abs(n)).toBeLessThanOrEqual(multiplied ? config.multiplyMax : config.operandMax);
          expect(Math.abs(n)).toBeGreaterThanOrEqual((multiplied ? config.multiplyMin : config.operandMin)!);
          if (Math.abs(n) >= 100) large++;
        });
        const answer = evaluate(expression), choices = createChoices(expression, random);
        expect(new Set(choices).size).toBe(4);
        expect(choices.filter(v => v === answer)).toHaveLength(1);
        expect(Math.max(...choices) - Math.min(...choices)).toBeLessThanOrEqual(30);
        seen.add(choices.indexOf(answer));
        recent = [...recent, signature(expression)].slice(-6);
      }
    }
    expect(large).toBeGreaterThan(1000);
    expect(seen.size).toBe(4);
  });
});

describe('niveau Finance', () => {
  it.each<[FinanceProblem, number]>([
    [{ kind: 'portion', amount: 250, rate: 20 }, 50],
    [{ kind: 'increase', amount: 200, rate: 15 }, 230],
    [{ kind: 'decrease', amount: 800, rate: 25 }, 600],
    [{ kind: 'successive', amount: 200, rate: 20, secondRate: -20 }, 192],
    [{ kind: 'successive', amount: 200, rate: 25, secondRate: 10 }, 275],
  ])('calcule exactement %j', (problem, answer) => {
    expect(evaluateFinance(problem)).toBe(answer);
  });
  it('distingue le montant du pourcentage du prix final et explicite les variations successives', () => {
    expect(formatFinance({ kind: 'portion', amount: 250, rate: 20 })).toBe('20 % de 250 €');
    expect(formatFinance({ kind: 'increase', amount: 200, rate: 15 })).toBe('200 € + 15 %');
    const successive: FinanceProblem = { kind: 'successive', amount: 200, rate: 20, secondRate: -20 };
    expect(formatFinance(successive)).toBe('200 € + 20 % puis − 20 %');
    expect(financeContext(successive)).toContain('successives');
    expect(financeContext({ kind: 'decrease', amount: 200, rate: 10 })).toContain('après la remise');
  });
  it('vérifie 7 000 questions : résultats entiers exacts, quatre choix, variété et absence de répétitions', () => {
    const random = seeded(99), kinds = new Set<string>(), positions = new Set<number>(), rates = new Set<number>();
    let recent: string[] = [], large = false;
    for (let stage = 0; stage < 7; stage++) for (let i = 0; i < 1000; i++) {
      const problem = generateFinance(stage * 5, recent, random), answer = evaluateFinance(problem);
      expect(Number.isSafeInteger(answer)).toBe(true);
      expect(problem.amount).toBeGreaterThanOrEqual(100);
      expect(problem.amount).toBeLessThanOrEqual(10000);
      expect(recent).not.toContain(financeSignature(problem));
      if (stage < 3) expect(problem.kind).not.toBe('successive');
      // Independent formula explicitly uses the first adjusted amount for a second change.
      let expected = problem.amount * problem.rate / 100;
      if (problem.kind === 'increase' || problem.kind === 'successive') expected += problem.amount;
      if (problem.kind === 'decrease') expected = problem.amount - expected;
      if (problem.kind === 'successive') expected += expected * problem.secondRate! / 100;
      expect(answer).toBe(expected);
      const choices = createFinanceChoices(problem, random);
      expect(new Set(choices).size).toBe(4);
      expect(choices.filter(v => v === answer)).toHaveLength(1);
      expect(choices.every(v => Number.isSafeInteger(v) && v >= 0)).toBe(true);
      kinds.add(problem.kind); rates.add(problem.rate); positions.add(choices.indexOf(answer));
      if (problem.amount > 1000) large = true;
      recent = [...recent, financeSignature(problem)].slice(-6);
    }
    expect(kinds.size).toBe(4);
    expect(rates.has(15)).toBe(true);
    expect(positions.size).toBe(4);
    expect(large).toBe(true);
  });
  it('évite de répéter une question même avec un hasard constant', () => {
    const first = generateFinance(0, [], () => 0);
    expect(financeSignature(generateFinance(0, [financeSignature(first)], () => 0))).not.toBe(financeSignature(first));
  });
  it('propose des montants proches même après deux variations de pourcentage', () => {
    const problem: FinanceProblem = { kind: 'successive', amount: 200, rate: 20, secondRate: -20 };
    const choices = createFinanceChoices(problem, seeded(9));
    expect(choices).toContain(192);
    expect(new Set(choices).size).toBe(4);
    expect(Math.max(...choices) - Math.min(...choices)).toBeLessThanOrEqual(15);
  });
});

describe('parties et records des trois niveaux', () => {
  it.each(MATH_LEVELS)('conserve le niveau $title après une réponse et au rejeu', ({ id }) => {
    let game = newMathGame(0, seeded(15), id);
    game = answerMathGame(game, 0, game.question.answer, 1000);
    game = advanceMathGame(game, 1200, seeded(16));
    expect(game.level).toBe(id);
    expect(game.question.id).toBe(1);
    expect(game.question.unit).toBe(id === 'finance' ? '€' : undefined);
    const replay = newMathGame(5000, seeded(17), id);
    expect(replay).toMatchObject({ level: id, score: 0, correct: 0, answers: 0 });
  });
  it('enregistre un nouveau record Finance indépendamment du record Petits nombres', () => {
    let progress = { ...emptyMathProgress(), best: 1000, bestByLevel: { small: 1000, large: 0, finance: 0 } };
    let game = newMathGame(0, seeded(8), 'finance');
    game = answerMathGame(game, 0, game.question.answer, 1000);
    game = advanceMathGame(game, 60000);
    const saved = finishMathGame(progress, game, 'finance');
    expect(saved.newRecord).toBe(true);
    progress = saved.progress;
    expect(progress.best).toBe(1000);
    expect(progress.bestByLevel).toEqual({ small: 1000, large: 0, finance: 100 });
    expect(saved.result.level).toBe('finance');
  });
  it('récupère les anciens records et attribue l’ancien historique au premier niveau', () => {
    const legacy = { version: 1, tutorialDone: true, best: 500, history: [{ id: 'old', date: '2026-10-15', score: 300, correct: 3, answers: 4, durationMs: 12000 }] };
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === MATH_STORAGE_KEY ? JSON.stringify(legacy) : null });
    const progress = loadMathProgress();
    expect(progress.best).toBe(500);
    expect(progress.bestByLevel).toEqual({ small: 500, large: 0, finance: 0 });
    expect(progress.history[0].level).toBe('small');
    expect(progress.tutorialDone).toBe(true);
  });
  it('recharge les records séparés sans attribuer un record Finance au premier niveau', () => {
    const progress = { ...emptyMathProgress(), best: 2000, bestByLevel: { small: 300, large: 700, finance: 2000 } };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(progress) });
    expect(loadMathProgress()).toEqual(progress);
  });
});
