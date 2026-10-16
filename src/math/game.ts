import { adjustClock, createClock, remainingMs } from './clock';
import type { ReserveClock } from './clock';
import { MATH_RULES } from './config';
import type { MathLevelId } from './config';
import { createChoices } from './distractors';
import { evaluate, formatExpression, generateExpression, signature } from './expressions';
import type { Random } from './expressions';
import { createFinanceChoices, evaluateFinance, financeContext, financeSignature, formatFinance, generateFinance } from './finance';
import { emptyScore, recordAnswer } from './scoring';
import type { MathScore } from './scoring';

export interface Question { id: number; prompt: string; signature: string; answer: number; choices: number[]; operationCount: number; context?: string; unit?: '€' }
export interface MathGame extends MathScore {
  level: MathLevelId;
  clock: ReserveClock;
  question: Question;
  recent: string[];
  phase: 'question' | 'feedback' | 'over';
  feedback?: { selected: number; correct: boolean; until: number };
  endedAt?: number;
}
export function createQuestion(id: number, correct: number, recent: readonly string[], random: Random = Math.random, level: MathLevelId = 'small'): Question {
  if (level === 'finance') {
    const problem = generateFinance(correct, recent, random);
    return { id, prompt: formatFinance(problem), signature: financeSignature(problem), answer: evaluateFinance(problem), choices: createFinanceChoices(problem, random), operationCount: problem.kind === 'successive' ? 2 : 1, context: financeContext(problem), unit: '€' };
  }
  const expression = generateExpression(correct, recent, random, level);
  return { id, prompt: formatExpression(expression), signature: signature(expression), answer: evaluate(expression), choices: createChoices(expression, random), operationCount: expression.operators.length };
}
export function newMathGame(now: number, random: Random = Math.random, level: MathLevelId = 'small'): MathGame {
  const question = createQuestion(0, 0, [], random, level);
  return { ...emptyScore(), level, clock: createClock(now, level), question, recent: [question.signature], phase: 'question' };
}
export function expireMathGame(game: MathGame, now: number): MathGame {
  return game.phase !== 'over' && remainingMs(game.clock, now) === 0 ? { ...game, phase: 'over', endedAt: game.clock.deadline } : game;
}
export function advanceMathGame(game: MathGame, now: number, random: Random = Math.random): MathGame {
  const current = expireMathGame(game, now);
  if (current.phase !== 'feedback' || now < current.feedback!.until) return current;
  const question = createQuestion(current.question.id + 1, current.correct, current.recent, random, current.level);
  return { ...current, question, recent: [...current.recent, question.signature].slice(-6), phase: 'question', feedback: undefined };
}
export function answerMathGame(game: MathGame, questionId: number, value: number, now: number): MathGame {
  // Do not advance a question from an input handler: queued/stale taps must stay stale.
  const current = expireMathGame(game, now);
  if (current.phase !== 'question' || current.question.id !== questionId || !current.question.choices.includes(value)) return current;
  const correct = value === current.question.answer;
  const next: MathGame = { ...current, ...recordAnswer(current, correct), clock: adjustClock(current.clock, correct, now, current.level), phase: 'feedback', feedback: { selected: value, correct, until: now + MATH_RULES.feedbackMs } };
  return expireMathGame(next, now);
}
