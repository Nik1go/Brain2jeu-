import { difficultyStage } from './config';
import { createNearbyChoices } from './choices';
import type { Random } from './expressions';

export type FinanceKind = 'portion' | 'increase' | 'decrease' | 'successive';
export interface FinanceProblem { kind: FinanceKind; amount: number; rate: number; secondRate?: number }
const RATES = [5, 10, 15, 20, 25, 30, 40, 50] as const;
export const financeSignature = (problem: FinanceProblem): string => JSON.stringify(problem);

// Use integer numerators: prices and percentages are constructed to have exact integer answers.
export function evaluateFinance(problem: FinanceProblem): number {
  const { amount, rate, kind } = problem;
  if (kind === 'portion') return amount * rate / 100;
  const first = amount * (100 + (kind === 'decrease' ? -rate : rate)) / 100;
  return kind === 'successive' ? first * (100 + problem.secondRate!) / 100 : first;
}
export function formatFinance(problem: FinanceProblem): string {
  const amount = problem.amount.toLocaleString('fr-FR');
  if (problem.kind === 'portion') return `${problem.rate} % de ${amount} €`;
  if (problem.kind === 'successive') return `${amount} € + ${problem.rate} % puis ${problem.secondRate! < 0 ? '−' : '+'} ${Math.abs(problem.secondRate!)} %`;
  return `${amount} € ${problem.kind === 'decrease' ? '−' : '+'} ${problem.rate} %`;
}
export const financeContext = (problem: FinanceProblem): string => problem.kind === 'portion' ? 'Quel montant ?' : problem.kind === 'successive' ? 'Prix final · deux variations successives' : problem.kind === 'increase' ? 'Prix final après la hausse' : 'Prix final après la remise';

export function generateFinance(correct: number, recent: readonly string[] = [], random: Random = Math.random): FinanceProblem {
  const stage = difficultyStage(correct);
  const kinds: FinanceKind[] = stage === 0 ? ['portion', 'increase', 'decrease'] : stage < 3 ? ['portion', 'increase', 'decrease', 'portion'] : ['portion', 'increase', 'decrease', 'successive'];
  const rates = stage < 2 ? [10, 20, 25, 50] : RATES;
  for (let attempt = 0; attempt < 80; attempt++) {
    const kind = kinds[Math.floor(random() * kinds.length)];
    const rate = rates[Math.floor(random() * rates.length)];
    // Small steps introduce 15/25/75 etc. without rounding or decimal distractors.
    const step = kind === 'successive' ? 200 : rate % 10 === 0 ? 10 : 20;
    const max = stage < 2 ? 1000 : stage < 4 ? 2500 : 10000;
    const amount = (Math.floor(random() * Math.floor((max - 100) / step + 1)) * step) + 100;
    const problem: FinanceProblem = { kind, amount, rate };
    if (kind === 'successive') {
      problem.amount = (1 + Math.floor(random() * (max / 200))) * 200;
      problem.rate = [10, 20, 25, 50][Math.floor(random() * 4)];
      problem.secondRate = (random() < .5 ? -1 : 1) * [10, 20, 50][Math.floor(random() * 3)];
    }
    if (Number.isSafeInteger(evaluateFinance(problem)) && !recent.includes(financeSignature(problem))) return problem;
  }
  // Deterministic fallback is still a finance question, and respects the selected stage.
  for (let amount = 100; amount <= 1000; amount += 20) {
    const problem: FinanceProblem = { kind: 'portion', amount, rate: 20 };
    if (!recent.includes(financeSignature(problem))) return problem;
  }
  throw new Error('No unused finance question available');
}

export function createFinanceChoices(problem: FinanceProblem, random: Random = Math.random): number[] {
  return createNearbyChoices(evaluateFinance(problem), random, true);
}
