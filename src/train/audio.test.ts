import { describe, expect, it, vi } from 'vitest';
import { createTrainAudio } from './audio';

function device(initialState: AudioContextState = 'running') {
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const oscillators: { frequency: ReturnType<typeof param>; type: string; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const ctx = {
    state: initialState, currentTime: 10, destination: {},
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    close: vi.fn(async () => { ctx.state = 'closed'; }),
    createOscillator: vi.fn(() => {
      const oscillator = { frequency: param(), type: 'sine', start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null };
      oscillators.push(oscillator); return oscillator;
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() })),
    createBiquadFilter: vi.fn(() => ({ type: '', frequency: param(), connect: vi.fn(), disconnect: vi.fn() })),
  };
  const factory = vi.fn(() => ctx as unknown as AudioContext);
  return { ctx, factory, oscillators, audio: createTrainAudio(factory) };
}

describe('sons des arrivées', () => {
  it('déverrouille le son au départ et joue un échec distinct du succès', async () => {
    const { audio, ctx, factory, oscillators } = device('suspended');
    audio.play(false); expect(factory).not.toHaveBeenCalled();
    audio.unlock(); await Promise.resolve();
    expect(ctx.resume).toHaveBeenCalledOnce();
    audio.play(false); expect(oscillators).toHaveLength(2);
    for (const voice of oscillators) {
      expect(voice.frequency.exponentialRampToValueAtTime.mock.calls[0][0]).toBeLessThan(voice.frequency.setValueAtTime.mock.calls[0][0]);
      expect(voice.stop.mock.calls[0][0] - voice.start.mock.calls[0][0]).toBeLessThan(.5);
    }
    ctx.currentTime += 1;
    audio.play(true); expect(oscillators).toHaveLength(3);
    expect(oscillators[2].type).not.toBe(oscillators[0].type);
  });
  it('laisse finir l’échec lorsqu’une bonne arrivée suit immédiatement', () => {
    const { audio, ctx, oscillators } = device();
    audio.unlock(); audio.play(false); ctx.currentTime += .1; audio.play(true);
    expect(oscillators).toHaveLength(2);
    ctx.currentTime += .5; audio.play(true); expect(oscillators).toHaveLength(3);
  });
  it('reste silencieux si le navigateur refuse le son, sans rejouer un échec au déverrouillage', async () => {
    const { audio, ctx, oscillators } = device('suspended');
    ctx.resume.mockRejectedValueOnce(new Error('blocked'));
    audio.unlock(); await Promise.resolve(); audio.play(false);
    expect(oscillators).toHaveLength(0);
    audio.unlock(); await Promise.resolve(); expect(oscillators).toHaveLength(0);
    expect(() => createTrainAudio(() => { throw new Error('unsupported'); }).unlock()).not.toThrow();
  });
  it('libère les voix et ferme le contexte à la sortie', () => {
    const { audio, ctx, oscillators } = device();
    audio.unlock(); audio.play(false); audio.close(); audio.close();
    expect(ctx.close).toHaveBeenCalledOnce();
    expect(oscillators.every(voice => voice.stop.mock.calls.length === 2)).toBe(true);
    audio.play(false); expect(oscillators).toHaveLength(2);
  });
});
