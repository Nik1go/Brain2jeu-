import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjustClock, createClock, remainingMs } from './clock';
import { difficultyStage, MATH_DIFFICULTIES, MATH_RULES } from './config';
import { createChoices } from './distractors';
import { displayNumber, evaluate, formatExpression, generateExpression, signature } from './expressions';
import type { Expression } from './expressions';
import { advanceMathGame, answerMathGame, newMathGame } from './game';
import { accuracy } from './scoring';
import { emptyMathProgress, finishMathGame, loadMathProgress, MATH_STORAGE_KEY, saveMathProgress } from './storage';

function seeded(seed: number) {
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
}
afterEach(() => vi.unstubAllGlobals());

describe('calculs et distracteurs', () => {
  it.each<[Expression, number]>([
    [{ operands: [3, -1], operators: ['−'] }, 4],
    [{ operands: [-3, -4], operators: ['×'] }, 12],
    [{ operands: [6, -2], operators: ['−'] }, 8],
    [{ operands: [3, 4, 5], operators: ['+', '×'] }, 23],
    [{ operands: [3, -4, -5], operators: ['−', '×'] }, -17],
    [{ operands: [-3, 4, -5], operators: ['×', '−'] }, -7],
    [{ operands: [0, -4, -5], operators: ['−', '×'] }, -20],
    [{ operands: [-3, -4, -5], operators: ['×', '×'] }, -60],
  ])('respecte les signes et les priorités : %j', (expression, expected) => {
    expect(evaluate(expression)).toBe(expected);
  });
  it('parenthèse les nombres négatifs et normalise zéro', () => {
    expect(formatExpression({ operands: [6, -2], operators: ['−'] })).toBe('6 − (−2)');
    expect(displayNumber(-0)).toBe('0');
  });
  it('propose des résultats proches, et gère un résultat nul', () => {
    const close = createChoices({ operands: [3, -1], operators: ['−'] }, () => .999);
    expect(close).toContain(4);
    expect(Math.max(...close) - Math.min(...close)).toBeLessThanOrEqual(6);
    const choices = createChoices({ operands: [3, -3], operators: ['+'] });
    expect(new Set(choices).size).toBe(4);
    expect(choices.filter(v => v === 0)).toHaveLength(1);
    expect(choices.some(v => Object.is(v, -0))).toBe(false);
  });
  it('progresse par cinq bonnes réponses et reste borné', () => {
    expect([0, 4, 5, 9, 10, 14, 15, 19, 20, 24, 25, 29, 30, 500].map(difficultyStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });
  it('vérifie 7 000 questions : limites, absence de répétition, quatre choix uniques, une bonne réponse', () => {
    const random = seeded(42), positions = new Set<number>();
    let recent: string[] = [], sawZero = false;
    for (let stage = 0; stage < MATH_DIFFICULTIES.length; stage++) {
      const config = MATH_DIFFICULTIES[stage];
      for (let i = 0; i < 1000; i++) {
        const expression = generateExpression(stage * 5, recent, random), key = signature(expression);
        expect(recent).not.toContain(key);
        expect(expression.operators.every(op => config.operators.includes(op))).toBe(true);
        expect(expression.operators.length).toBeLessThanOrEqual(stage < 4 ? 1 : 2);
        expression.operands.forEach((n, index) => {
          const multiplied = expression.operators[index] === '×' || expression.operators[index - 1] === '×';
          expect(Math.abs(n)).toBeLessThanOrEqual(multiplied ? config.multiplyMax : config.operandMax);
          expect(Number.isInteger(n)).toBe(true);
          if (n === 0) sawZero = true;
        });
        const answer = evaluate(expression), choices = createChoices(expression, random);
        expect(choices).toHaveLength(4);
        expect(new Set(choices).size).toBe(4);
        expect(choices.filter(v => v === answer)).toHaveLength(1);
        expect(choices.every(Number.isSafeInteger)).toBe(true);
        positions.add(choices.indexOf(answer));
        recent = [...recent, key].slice(-6);
      }
    }
    expect(positions.size).toBe(4);
    expect(sawZero).toBe(true);
  });
  it('termine aussi avec une source aléatoire constante', () => {
    const first = generateExpression(0, [], () => 0);
    expect(signature(generateExpression(0, [signature(first)], () => 0))).not.toBe(signature(first));
  });
});

describe('réserve de temps et validation atomique', () => {
  it.each([['small', 2000, 11000], ['large', 3000, 15000], ['finance', 4000, 15000]] as const)('applique le bonus du niveau %s, sans dépasser le plafond ni sauver une partie expirée', (level, bonus, capacity) => {
    const clock = createClock(0, level);
    expect(clock.capacityMs).toBe(capacity);
    expect(remainingMs(adjustClock(clock, true, 6000, level), 6000)).toBe(4000 + bonus);
    const earlyBonus = adjustClock(clock, true, 100, level);
    expect(remainingMs(earlyBonus, 100)).toBe(Math.min(capacity, 9900 + bonus));
    expect(remainingMs(adjustClock(earlyBonus, true, 100, level), 100)).toBe(Math.min(capacity, 9900 + bonus * 2));
    expect(remainingMs(adjustClock({ ...clock, deadline: capacity }, true, 100, level), 100)).toBe(capacity);
    expect(remainingMs(adjustClock(clock, false, 1000, level), 1000)).toBe(4000);
    expect(remainingMs(adjustClock(clock, true, 10000, level), 10000)).toBe(0);
    const game = newMathGame(0, seeded(18), level);
    const answered = answerMathGame(game, 0, game.question.answer, 6000);
    expect(remainingMs(answered.clock, 6000)).toBe(4000 + bonus);
    expect(answered).toMatchObject({ score: 100, correct: 1, answers: 1 });
    expect(answerMathGame(answered, 0, game.question.answer, 6100)).toBe(answered);
    expect(remainingMs(advanceMathGame(answered, 6200).clock, 6200)).toBe(3800 + bonus);
    expect(answerMathGame(game, 0, game.question.answer, 10000)).toMatchObject({ phase: 'over', answers: 0 });
  });
  it('commence à 10/11, ajoute 2 s, plafonne à 11 et retire 5 s', () => {
    const clock = createClock(100);
    expect(remainingMs(clock, 100) / clock.capacityMs).toBe(10 / 11);
    expect(remainingMs(adjustClock(clock, true, 1100), 1100)).toBe(11000);
    expect(remainingMs(adjustClock(clock, true, 4100), 4100)).toBe(8000);
    expect(remainingMs(adjustClock(clock, false, 4100), 4100)).toBe(1000);
    expect(remainingMs(adjustClock(clock, false, 6100), 6100)).toBe(0);
    expect(remainingMs(adjustClock(clock, true, 10100), 10100)).toBe(0);
  });
  it('continue de s’écouler pendant le feedback et crée un autre calcul après une erreur', () => {
    const game = newMathGame(0, seeded(1));
    const wrong = game.question.choices.find(v => v !== game.question.answer)!;
    const answered = answerMathGame(game, 0, wrong, 1000);
    expect(answered).toMatchObject({ phase: 'feedback', correct: 0, answers: 1, score: 0 });
    expect(remainingMs(answered.clock, 1000)).toBe(4000);
    expect(advanceMathGame(answered, 1199)).toBe(answered);
    const next = advanceMathGame(answered, 1200, seeded(2));
    expect(next.question.id).toBe(1);
    expect(next.phase).toBe('question');
    expect(next.question.signature).not.toBe(game.question.signature);
    expect(remainingMs(next.clock, 1200)).toBe(3800);
  });
  it('ne compte ni les doubles touchers ni les événements d’une ancienne question', () => {
    const game = newMathGame(0, seeded(3));
    const answered = answerMathGame(game, 0, game.question.answer, 1000);
    expect(answered).toMatchObject({ answers: 1, correct: 1, score: 100 });
    expect(answerMathGame(answered, 0, game.question.answer, 1100)).toBe(answered);
    const next = advanceMathGame(answered, 1200, seeded(4));
    expect(answerMathGame(next, 0, next.question.answer, 1300)).toBe(next);
  });
  it.each([10000, 10001, 60000])('refuse un bonus reçu après expiration réelle (%i ms)', now => {
    const game = newMathGame(0, seeded(5));
    const ended = answerMathGame(game, 0, game.question.answer, now);
    expect(ended).toMatchObject({ phase: 'over', correct: 0, answers: 0, score: 0, endedAt: 10000 });
  });
  it('termine immédiatement sur une pénalité fatale, sans retirer de points', () => {
    const game = newMathGame(0, seeded(6));
    const good = answerMathGame(game, 0, game.question.answer, 1000);
    const next = advanceMathGame(good, 1200);
    const wrong = next.question.choices.find(v => v !== next.question.answer)!;
    const ended = answerMathGame(next, 1, wrong, 8000);
    expect(ended).toMatchObject({ phase: 'over', endedAt: 8000, correct: 1, answers: 2, score: 100 });
    expect(accuracy(ended)).toBe(50);
  });
  it('termine pendant la transition, même si la prochaine image arrive bien plus tard', () => {
    const game = newMathGame(0, seeded(7));
    const wrong = game.question.choices.find(v => v !== game.question.answer)!;
    const answered = answerMathGame(game, 0, wrong, 4900);
    expect(answered.phase).toBe('feedback');
    expect(advanceMathGame(answered, 5000)).toMatchObject({ phase: 'over', endedAt: 5000, answers: 1 });
    expect(advanceMathGame(answered, 10000).question.id).toBe(0);
  });
  it('réinitialise tous les compteurs au rejeu, et progresse sur les bonnes réponses cumulées', () => {
    let game = newMathGame(0, seeded(10));
    for (let i = 0; i < 5; i++) {
      game = answerMathGame(game, game.question.id, game.question.answer, i * 1000 + 100);
      game = advanceMathGame(game, i * 1000 + 300);
    }
    expect(game.correct).toBe(5);
    expect(difficultyStage(game.correct)).toBe(1);
    const replay = newMathGame(5000);
    expect(replay).toMatchObject({ correct: 0, answers: 0, score: 0, phase: 'question', question: { id: 0 } });
    expect(remainingMs(replay.clock, 5000)).toBe(10000);
  });
});

describe('résultats et sauvegarde', () => {
  it('sauve la durée réelle, le record, et reste idempotent', () => {
    const game = newMathGame(1000);
    const good = answerMathGame(game, 0, game.question.answer, 2000);
    const ended = advanceMathGame(good, 60000);
    const saved = finishMathGame(emptyMathProgress(), ended, 'first');
    expect(saved.result).toMatchObject({ score: 100, correct: 1, answers: 1, durationMs: 12000 });
    expect(saved.newRecord).toBe(true);
    expect(saved.progress.best).toBe(100);
    expect(finishMathGame(saved.progress, ended, 'first').progress.history).toHaveLength(1);
    expect(finishMathGame(saved.progress, ended, 'second').newRecord).toBe(false);
    expect(() => finishMathGame(emptyMathProgress(), game, 'ongoing')).toThrow();
  });
  it('n’annonce pas de nouveau record pour un premier score de zéro', () => {
    const ended = advanceMathGame(newMathGame(0), 10000);
    const saved = finishMathGame(emptyMathProgress(), ended, 'zero');
    expect(saved.newRecord).toBe(false);
    expect(saved.result.answers).toBe(0);
    expect(accuracy(saved.result)).toBe(0);
  });
  it('persiste tutoriel et record, récupère des données invalides et tolère un stockage indisponible', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    const progress = { ...emptyMathProgress(), tutorialDone: true, best: 500, bestByLevel: { small: 500, large: 0, finance: 0 } };
    expect(saveMathProgress(progress)).toBe(true);
    expect(loadMathProgress()).toEqual(progress);
    data.set(MATH_STORAGE_KEY, '{broken');
    expect(loadMathProgress()).toEqual(emptyMathProgress());
    data.set(MATH_STORAGE_KEY, JSON.stringify({ version: 1, best: -1, history: [null, { score: 999 }], tutorialDone: 'true' }));
    expect(loadMathProgress()).toEqual(emptyMathProgress());
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
    expect(loadMathProgress()).toEqual(emptyMathProgress());
    expect(saveMathProgress(progress)).toBe(false);
  });
});
