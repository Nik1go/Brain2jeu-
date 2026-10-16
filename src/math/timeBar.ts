import { remainingMs } from './clock';
import type { ReserveClock } from './clock';

/** One clock sample drives the visible fill and the accessible value together.
 * No CSS interpolation: it must neither lag at zero nor restart after a render/tap.
 */
export function paintMathTime(track: HTMLDivElement | null, clock: ReserveClock, now: number): void {
  if (!track) return;
  const remaining = remainingMs(clock, now);
  const fill = track.firstElementChild as HTMLSpanElement | null;
  if (fill) fill.style.transform = `scaleX(${remaining / clock.capacityMs})`;
  track.setAttribute('aria-valuenow', String(Math.round(remaining / 100) / 10));
  track.dataset.urgent = String(remaining <= 2500);
}

/** Let the committed empty bar paint once before replacing it with the result.
 * This never extends gameplay: the game is already over and all answers are locked.
 */
export function afterTimeBarPaint(callback: () => void): () => void {
  let complete = false, secondFrame = 0, emptyHold = 0;
  const finish = () => { if (!complete) { complete = true; callback(); } };
  // Background tabs may suspend animation frames entirely.
  const fallback = window.setTimeout(finish, 100);
  const firstFrame = requestAnimationFrame(() => {
    secondFrame = requestAnimationFrame(() => {
      // Briefly keep the empty bar visible; inputs and the recorded end time are
      // already final. This avoids replacing the zero frame too quickly to see.
      emptyHold = window.setTimeout(finish, 50);
    });
  });
  return () => {
    complete = true;
    cancelAnimationFrame(firstFrame);
    cancelAnimationFrame(secondFrame);
    window.clearTimeout(fallback);
    window.clearTimeout(emptyHold);
  };
}
