import { difficultyStage, LARGE_DIFFICULTIES, MATH_DIFFICULTIES } from './config';
import type { Difficulty, MathLevelId, Operator } from './config';

export type Random = () => number;
export interface Expression { operands: number[]; operators: Operator[] }
export const applyOperator = (a: number, op: Operator, b: number): number => op === '+' ? a + b : op === '−' ? a - b : a * b;

/** Reduce multiplication terms before summing, without eval or parsing display text. */
export function evaluate(expression: Expression): number {
  let total = 0, term = expression.operands[0], sign = 1;
  expression.operators.forEach((op, i) => {
    const next = expression.operands[i + 1];
    if (op === '×') term *= next;
    else { total += sign * term; term = next; sign = op === '+' ? 1 : -1; }
  });
  return total + sign * term || 0;
}
export const displayNumber = (value: number): string => value < 0 ? `−${Math.abs(value)}` : String(value || 0);
export function formatExpression(expression: Expression): string {
  return expression.operands.map((n, i) => `${i ? `${expression.operators[i - 1]} ` : ''}${n < 0 ? `(${displayNumber(n)})` : displayNumber(n)}`).join(' ');
}
export const signature = (expression: Expression): string => JSON.stringify(expression);
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function candidate(config: Difficulty, random: Random): Expression {
  const count = random() < config.twoOperationChance ? 2 : 1;
  const operators = Array.from({ length: count }, () => config.operators[Math.floor(random() * config.operators.length)]);
  // Never multiply two products together: mixed operations give variety with modest numbers.
  if (operators[0] === '×' && operators[1] === '×') operators[1] = random() < .5 ? '+' : '−';
  const operands = Array.from({ length: count + 1 }, (_, i) => {
    const multiplied = operators[i] === '×' || operators[i - 1] === '×';
    const max = multiplied ? config.multiplyMax : config.operandMax;
    const min = (multiplied ? config.multiplyMin : config.operandMin) ?? 0;
    const magnitude = min + Math.floor(random() * (max - min + 1));
    return magnitude && random() < config.negativeChance ? -magnitude : magnitude;
  });
  return { operands, operators };
}
export function isTrivial(expression: Expression): boolean {
  return (expression.operators.length === 1 && expression.operands.includes(0)) || expression.operands.some((n, i) => Math.abs(n) === 1 && (expression.operators[i] === '×' || expression.operators[i - 1] === '×')) || Math.abs(evaluate(expression)) <= 1;
}
export function generateExpression(correct: number, recent: readonly string[] = [], random: Random = Math.random, level: Exclude<MathLevelId, 'finance'> = 'small'): Expression {
  const config = (level === 'large' ? LARGE_DIFFICULTIES : MATH_DIFFICULTIES)[difficultyStage(correct)];
  for (let attempt = 0; attempt < 80; attempt++) {
    const expression = candidate(config, random);
    if (!recent.includes(signature(expression)) && !isTrivial(expression)) return expression;
  }
  // Bounded fallback also terminates with a deterministic/degenerate random source.
  for (let a = Math.max(2, config.operandMin ?? 0); a <= config.operandMax; a++) for (let b = Math.max(2, config.operandMin ?? 0); b <= config.operandMax; b++) {
    const expression: Expression = { operands: [a, b], operators: ['+'] };
    if (!recent.includes(signature(expression))) return expression;
  }
  throw new Error('No unused expression available');
}
