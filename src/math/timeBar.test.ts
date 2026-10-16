import { afterEach, describe, expect, it, vi } from 'vitest';
import { adjustClock, createClock } from './clock';
import { afterTimeBarPaint, paintMathTime } from './timeBar';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function trackFixture() {
  const attributes: Record<string, string> = {};
  const fill = { style: { transform: '' } };
  const track = { firstElementChild: fill, dataset: { urgent: '' }, setAttribute: (key: string, value: string) => { attributes[key] = value; } };
  return { track: track as unknown as HTMLDivElement, fill, attributes };
}

describe('synchronisation de la barre de temps', () => {
  it.each([['small', 11000], ['large', 15000], ['finance', 15000]] as const)('utilise la capacité du niveau %s et atteint exactement zéro à l’échéance', (level, capacity) => {
    const { track, fill, attributes } = trackFixture(), clock = createClock(1000, level);
    paintMathTime(track, clock, 1000);
    expect(fill.style.transform).toBe(`scaleX(${10000 / capacity})`);
    expect(attributes['aria-valuenow']).toBe('10');
    paintMathTime(track, clock, 10999);
    expect(fill.style.transform).toBe(`scaleX(${1 / capacity})`);
    paintMathTime(track, clock, 11000);
    expect(fill.style.transform).toBe('scaleX(0)');
    expect(attributes['aria-valuenow']).toBe('0');
  });
  it('ne recule jamais et ne modifie pas le temps lors de rendus répétés sans réponse', () => {
    const { track, fill } = trackFixture(), clock = createClock(0, 'large');
    let previous = 1;
    for (const now of [0, 16, 16, 32, 48, 48, 100, 500, 2000, 7000, 9999, 10000, 11000]) {
      paintMathTime(track, clock, now);
      const scale = Number(fill.style.transform.slice(7, -1));
      expect(scale).toBeLessThanOrEqual(previous);
      previous = scale;
    }
    expect(clock.deadline).toBe(10000);
  });
  it('affiche immédiatement le bonus, la pénalité et une pénalité fatale sans lissage en retard', () => {
    const { track, fill } = trackFixture();
    let clock = createClock(0, 'finance');
    clock = adjustClock(clock, true, 2000, 'finance');
    paintMathTime(track, clock, 2000);
    expect(fill.style.transform).toBe('scaleX(0.8)');
    clock = adjustClock(clock, false, 3000, 'finance');
    paintMathTime(track, clock, 3000);
    expect(fill.style.transform).toBe('scaleX(0.4)');
    clock = adjustClock(clock, false, 5000, 'finance');
    paintMathTime(track, clock, 5000);
    expect(fill.style.transform).toBe('scaleX(0)');
  });
});

function frameFixture() {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => { frames.delete(frame); });
  return { frame: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); }, frames };
}

describe('passage au résultat après affichage de zéro', () => {
  it('laisse une image vide être affichée avant le résultat et ne termine qu’une fois', () => {
    const { frame } = frameFixture(), finish = vi.fn();
    const cancel = afterTimeBarPaint(finish);
    expect(finish).not.toHaveBeenCalled();
    frame();
    expect(finish).not.toHaveBeenCalled();
    frame();
    expect(finish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(finish).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(finish).toHaveBeenCalledTimes(1);
    cancel();
  });
  it('termine aussi en arrière-plan lorsque les images sont suspendues', () => {
    frameFixture();
    const finish = vi.fn(), cancel = afterTimeBarPaint(finish);
    vi.advanceTimersByTime(100);
    expect(finish).toHaveBeenCalledTimes(1);
    cancel();
  });
  it('annule les callbacks au démontage pour éviter un ancien résultat après un rejeu', () => {
    const { frame, frames } = frameFixture(), finish = vi.fn();
    const cancel = afterTimeBarPaint(finish);
    frame();
    cancel();
    expect(frames.size).toBe(0);
    frame();
    vi.advanceTimersByTime(100);
    expect(finish).not.toHaveBeenCalled();
  });
});
