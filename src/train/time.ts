/** Wall time is sampled separately so pausing never advances waves, trains or the timer. */
export interface TrainClock { elapsedMs: number; lastAtMs: number; paused: boolean }
export const newTrainClock = (now: number): TrainClock => ({ elapsedMs: 0, lastAtMs: now, paused: false });
export function tickTrainClock(clock: TrainClock, now: number): TrainClock {
  return { ...clock, lastAtMs: Math.max(clock.lastAtMs, now), elapsedMs: clock.elapsedMs + (clock.paused ? 0 : Math.max(0, now - clock.lastAtMs)) };
}
export function pauseTrainClock(clock: TrainClock, paused: boolean, now: number): TrainClock { return { ...tickTrainClock(clock, now), paused }; }
