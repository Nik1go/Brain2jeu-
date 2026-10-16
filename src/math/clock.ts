import { mathLevel, MATH_RULES } from './config';
import type { MathLevelId } from './config';

export interface ReserveClock { startedAt: number; deadline: number; capacityMs: number }
export const createClock = (now: number, level: MathLevelId = 'small'): ReserveClock => ({ startedAt: now, deadline: now + MATH_RULES.initialMs, capacityMs: mathLevel(level).capacityMs });
export const remainingMs = (clock: ReserveClock, now: number): number => Math.max(0, Math.min(clock.capacityMs, clock.deadline - now));
export function adjustClock(clock: ReserveClock, correct: boolean, now: number, level: MathLevelId = 'small'): ReserveClock {
  const remaining = remainingMs(clock, now);
  // An expired clock cannot be revived, even before the next animation frame.
  if (remaining === 0) return clock;
  const next = correct ? Math.min(clock.capacityMs, remaining + mathLevel(level).bonusMs) : Math.max(0, remaining - MATH_RULES.penaltyMs);
  return { ...clock, deadline: now + next };
}
