import { createNearbyChoices } from './choices';
import { evaluate } from './expressions';
import type { Expression, Random } from './expressions';

export function createChoices(expression: Expression, random: Random = Math.random): number[] {
  return createNearbyChoices(evaluate(expression), random);
}
