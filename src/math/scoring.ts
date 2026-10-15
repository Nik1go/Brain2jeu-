import { MATH_RULES } from './config';
export interface MathScore { score: number; correct: number; answers: number }
export const emptyScore = (): MathScore => ({ score: 0, correct: 0, answers: 0 });
export function recordAnswer(score: MathScore, correct: boolean): MathScore {
  return { score: score.score + (correct ? MATH_RULES.points : 0), correct: score.correct + Number(correct), answers: score.answers + 1 };
}
export const accuracy = (score: MathScore): number => score.answers ? Math.round(score.correct / score.answers * 100) : 0;
