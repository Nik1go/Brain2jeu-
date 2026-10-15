export interface TrainAudio {
  unlock: () => void;
  play: (correct: boolean) => void;
  close: () => void;
}

/** Owned by the experience so the final cue can finish on the results screen. */
export function createTrainAudio(createContext = () => new AudioContext()): TrainAudio {
  let context: AudioContext | null = null, failureUntil = 0;
  const voices = new Set<OscillatorNode>();
  const stop = () => { for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } } voices.clear(); };
  return {
    unlock() {
      try {
        if (!context || context.state === 'closed') context = createContext();
        if (context.state !== 'running') void context.resume().catch(() => {});
      } catch { /* Sound is optional when the device cannot play it. */ }
    },
    play(correct) {
      if (!context || context.state !== 'running') return;
      const ctx = context, now = ctx.currentTime;
      if (correct && now < failureUntil) return;
      try {
        stop();
        const note = (delay: number, from: number, to: number, duration: number, volume: number, type: OscillatorType) => {
          const oscillator = ctx.createOscillator(), gain = ctx.createGain(), filter = ctx.createBiquadFilter();
          const start = now + delay;
          oscillator.type = type;
          oscillator.frequency.setValueAtTime(from, start);
          oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
          filter.type = 'lowpass'; filter.frequency.value = correct ? 2200 : 950;
          oscillator.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
          gain.gain.setValueAtTime(.0001, start);
          gain.gain.linearRampToValueAtTime(volume, start + .012);
          gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
          voices.add(oscillator);
          oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
          oscillator.start(start); oscillator.stop(start + duration + .02);
        };
        if (correct) note(0, 740, 980, .15, .045, 'triangle');
        else {
          failureUntil = now + .46;
          note(0, 310, 210, .18, .075, 'square');
          note(.2, 210, 110, .24, .085, 'square');
        }
      } catch { /* A failed audio device never interrupts the game. */ }
    },
    close() {
      stop(); failureUntil = 0;
      const closing = context; context = null;
      if (closing && closing.state !== 'closed') void closing.close().catch(() => {});
    },
  };
}
