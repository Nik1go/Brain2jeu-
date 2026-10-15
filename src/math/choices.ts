import { shuffled } from './expressions';
import type { Random } from './expressions';

/** Keep the answers in a compact band, without making the correct one its centre.
 * Its numeric rank and screen position vary independently from question to question.
 */
export function createNearbyChoices(answer: number, random: Random = Math.random, nonNegative = false): number[] {
  const magnitude = Math.abs(answer);
  const maxStep = magnitude < 20 ? 2 : magnitude < 100 ? 3 : magnitude < 1000 ? 5 : 10;
  const offsets = [0];
  for (let i = 0; i < 3; i++) offsets.push(offsets[i] + 1 + Math.floor(random() * maxStep));
  const ranks = [0, 1, 2, 3].filter(rank => !nonNegative || answer - offsets[rank] >= 0);
  const rank = ranks[Math.floor(random() * ranks.length)];
  const choices = offsets.map(offset => answer + offset - offsets[rank] || 0);
  return shuffled(choices, random);
}
