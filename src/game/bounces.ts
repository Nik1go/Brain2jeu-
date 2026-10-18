export interface BounceProfile { mean: number; standardDeviation: number; min: number; max: number }

// [centre, écart-type, minimum, maximum]. Grid size and decorative mirrors still grow independently.
export const BOUNCE_PROFILES: readonly BounceProfile[] = [
  [1.2, .45, 1, 2], [1.4, .50, 1, 2], [1.6, .55, 1, 3], [1.8, .60, 1, 3],
  [2.1, .65, 1, 3], [2.4, .65, 1, 4], [2.7, .70, 2, 4], [3.0, .70, 2, 4],
  // From level 8 onward: +0.5 bounce per level, with symmetric bounds preserving that exact mean.
  [3.5, .75, 2, 5], [4.0, .75, 3, 5], [4.5, .80, 3, 6], [5.0, .80, 4, 6],
  [5.5, .85, 4, 7], [6.0, .85, 5, 7], [6.5, .90, 5, 8], [7.0, .90, 6, 8],
  [7.5, .95, 6, 9],
].map(([mean, standardDeviation, min, max]) => ({ mean, standardDeviation, min, max }));

// Discrete Gaussian, normalized within the permitted integers. No clipping of outliers into the endpoints.
export function bounceDistribution(profile: BounceProfile): { hits: number; probability: number }[] {
  if (!Number.isFinite(profile.mean) || !Number.isFinite(profile.standardDeviation) || profile.standardDeviation <= 0
    || !Number.isInteger(profile.min) || !Number.isInteger(profile.max) || profile.min < 1 || profile.max < profile.min
    || profile.mean < profile.min || profile.mean > profile.max) throw new Error('Invalid bounce profile');
  const weights = Array.from({ length: profile.max - profile.min + 1 }, (_, i) => ({
    hits: profile.min + i, weight: Math.exp(-.5 * ((profile.min + i - profile.mean) / profile.standardDeviation) ** 2),
  }));
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  return weights.map(({ hits, weight }) => ({ hits, probability: weight / total }));
}

export function sampleBounces(profile: BounceProfile, random: () => number = Math.random): number {
  const distribution = bounceDistribution(profile);
  const draw = random();
  let cumulative = 0;
  for (const item of distribution) {
    cumulative += item.probability;
    if (draw < cumulative) return item.hits;
  }
  return profile.max; // Includes the final interval despite floating-point summation.
}
