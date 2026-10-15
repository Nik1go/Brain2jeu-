import { MATH_RULES } from './config';

export interface ReserveClock { startedAt: number; deadline: number }
export const createClock = (now: number): ReserveClock => ({ startedAt: now, deadline: now + MATH_RULES.initialMs });
export const remainingMs = (clock: ReserveClock, now: number): number => Math.max(0, Math.min(MATH_RULES.capacityMs, clock.deadline - now));
export function adjustClock(clock: ReserveClock, correct: boolean, now: number): ReserveClock {
  const remaining = remainingMs(clock, now);
  // An expired clock cannot be revived, even before the next animation frame.
  if (remaining === 0) return clock;
  const next = correct ? Math.min(MATH_RULES.capacityMs, remaining + MATH_RULES.bonusMs) : Math.max(0, remaining - MATH_RULES.penaltyMs);
  return { ...clock, deadline: now + next };
}
