export const MATH_RULES = {
  initialMs: 10_000,
  penaltyMs: 5_000,
  points: 100,
  feedbackMs: 200,
  correctPerStage: 5,
};

export type Operator = '+' | '−' | '×';
export type MathLevelId = 'small' | 'large' | 'finance';
export const MATH_LEVELS = [
  { id: 'small', capacityMs: 11000, number: 1, bonusMs: 2_000, title: 'Petits nombres', description: 'Des petits chiffres pour trouver ton rythme.', example: '8 + 7 · 6 × 4', detail: 'Signes, additions et petites multiplications' },
  { id: 'large', capacityMs: 15000, number: 2, bonusMs: 3_000, title: 'Grands calculs', description: 'De grands nombres, une seule opération à la fois.', example: '145 + 280 · 24 × 15', detail: 'Jusqu’à 999, avec quatre réponses proches' },
  { id: 'finance', capacityMs: 15000, number: 3, bonusMs: 4_000, title: 'Finance', description: 'Pourcentages, remises et hausses de prix.', example: '20 % de 350 € · 240 € + 15 %', detail: 'Montants, prix finaux et variations successives' },
] as const;
export const isMathLevel = (value: unknown): value is MathLevelId => MATH_LEVELS.some(level => level.id === value);
export const mathLevel = (id: MathLevelId) => MATH_LEVELS.find(level => level.id === id)!;
export interface Difficulty {
  operators: readonly Operator[];
  operandMax: number;
  multiplyMax: number;
  negativeChance: number;
  twoOperationChance: number;
  operandMin?: number;
  multiplyMin?: number;
}
// The last stage stays bounded; later questions vary signs and precedence.
export const MATH_DIFFICULTIES: readonly Difficulty[] = [
  { operators: ['+', '−'], operandMax: 10, multiplyMax: 0, negativeChance: .15, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMax: 10, multiplyMax: 5, negativeChance: .4, twoOperationChance: 0 },
  { operators: ['+', '−'], operandMax: 30, multiplyMax: 0, negativeChance: .45, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMax: 30, multiplyMax: 12, negativeChance: .5, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMax: 20, multiplyMax: 12, negativeChance: .5, twoOperationChance: .3 },
  { operators: ['+', '−', '×'], operandMax: 20, multiplyMax: 12, negativeChance: .5, twoOperationChance: .5 },
  { operators: ['+', '−', '×'], operandMax: 20, multiplyMax: 12, negativeChance: .5, twoOperationChance: .7 },
];
export const LARGE_DIFFICULTIES: readonly Difficulty[] = [
  { operators: ['+', '−', '×'], operandMin: 20, operandMax: 200, multiplyMin: 12, multiplyMax: 25, negativeChance: .15, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMin: 30, operandMax: 300, multiplyMin: 12, multiplyMax: 30, negativeChance: .25, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMin: 40, operandMax: 500, multiplyMin: 15, multiplyMax: 30, negativeChance: .3, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMin: 50, operandMax: 600, multiplyMin: 15, multiplyMax: 35, negativeChance: .35, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMin: 50, operandMax: 750, multiplyMin: 15, multiplyMax: 40, negativeChance: .4, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMin: 50, operandMax: 999, multiplyMin: 20, multiplyMax: 45, negativeChance: .45, twoOperationChance: 0 },
  { operators: ['+', '−', '×'], operandMin: 50, operandMax: 999, multiplyMin: 20, multiplyMax: 50, negativeChance: .5, twoOperationChance: 0 },
];
export function difficultyStage(correct: number): number {
  return Math.min(MATH_DIFFICULTIES.length - 1, Math.floor(Math.max(0, correct) / MATH_RULES.correctPerStage));
}
