import { useEffect, useRef, useState } from 'react';
import { Clock3, Pause, Play, RotateCcw, TrainFront } from 'lucide-react';
import { TRAIN_RULES } from './config';
import { advanceTrains, newTrainGame, setTrainPaused, toggleJunction } from './simulation';
import type { TrainGame } from './simulation';
import { newTrainClock, pauseTrainClock, tickTrainClock } from './time';
import { TrainBoard } from './TrainBoard';
import type { TrainAudio } from './audio';
import { deliveryCue, recentFailure } from './feedback';
export function TrainPlay({ level, previous, onGenerated, onFinish, onQuit, onRestart, sound, audio, reducedMotion }: {
  level: number; previous: { signature?: string; colors?: string[] }; onGenerated: (game: TrainGame) => void;
  onFinish: (game: TrainGame, id: string) => void; onQuit: () => void; onRestart: () => void; sound: boolean; audio: TrainAudio; reducedMotion: boolean;
}) {
  const [game, setGame] = useState(() => newTrainGame(level, { previousSignature: previous.signature, previousColors: previous.colors }));
  const clock = useRef(newTrainClock(performance.now())), id = useRef(crypto.randomUUID()), done = useRef(false);
  const initialGame = useRef(game), finish = useRef(onFinish), sounded = useRef(0);
  finish.current = onFinish;
  useEffect(() => { onGenerated(initialGame.current); }, []);
  useEffect(() => {
    let raf: number;
    const frame = () => { clock.current = tickTrainClock(clock.current, performance.now()); const elapsed = clock.current.elapsedMs; setGame(g => advanceTrains(g, elapsed)); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const cue = deliveryCue(game, sounded.current);
    if (sound && cue) audio.play(cue === 'success');
    sounded.current = game.deliveries.length;
    if (game.over && !done.current) { done.current = true; finish.current(game, id.current); }
  }, [game, sound, audio]);
  const pause = (paused: boolean) => { if (!paused && sound) audio.unlock(); clock.current = pauseTrainClock(clock.current, paused, performance.now()); const elapsed = clock.current.elapsedMs; setGame(g => setTrainPaused(g, paused, elapsed)); };
  useEffect(() => {
    if (game.paused) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); pause(true); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [game.paused]);
  const toggle = (junction: number) => {
    if (sound) audio.unlock();
    clock.current = tickTrainClock(clock.current, performance.now()); const elapsed = clock.current.elapsedMs;
    setGame(g => toggleJunction(g, junction, elapsed));
  };
  const seconds = Math.max(0, Math.ceil((TRAIN_RULES.durationMs - game.elapsedMs) / 1000));
  const draining = game.elapsedMs >= TRAIN_RULES.durationMs;
  const failure = recentFailure(game);
  return <main className={`train-play ${reducedMotion ? 'reduce-motion' : ''}`} data-phase={draining ? 'draining' : 'running'} data-paused={game.paused}>
    <header className="train-hud">
      <div className="train-hud-level"><TrainFront size={16} /><span>NIVEAU<strong>{String(level).padStart(2, '0')}</strong></span></div>
      <div className="train-hud-score"><span>SCORE</span><strong>{game.score.toLocaleString('fr-FR')}</strong></div>
      <div className={`train-hud-clock ${seconds <= 15 ? 'urgent' : ''}`} role="timer" aria-label={draining ? '0 seconde, derniers trains en route' : `${seconds} secondes restantes`}><Clock3 size={16} /><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong>{draining && <span className="train-draining">Derniers trains</span>}</div>
      <div className={`train-hud-errors ${game.errors > TRAIN_RULES.maxErrors ? 'over-limit' : ''} ${failure ? 'fresh-error' : ''}`} aria-label={`${game.errors} fautes, maximum 3 pour réussir`}><span>FAUTES</span><strong key={game.errors} className={failure ? 'train-error-count' : ''}>{game.errors}<small> / 3</small></strong></div>
      <button className="train-pause-button" aria-label="Mettre la partie en pause" onClick={() => pause(true)}><Pause size={19} fill="currentColor" /></button>
    </header>
    <div className="train-play-field"><TrainBoard game={game} onToggle={toggle} interactive={!game.paused} /></div>
    {game.paused && <TrainPause onResume={() => pause(false)} onQuit={onQuit} onRestart={onRestart} />}
  </main>;
}
function TrainPause({ onResume, onQuit, onRestart }: { onResume: () => void; onQuit: () => void; onRestart: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="train-pause-dialog" aria-labelledby="train-pause-title" onCancel={e => { e.preventDefault(); onResume(); }}><span className="train-pause-icon"><Pause size={28} /></span><h2 id="train-pause-title">Petite pause.</h2><p>Les trains et le temps t’attendent.</p><button className="train-primary" autoFocus onClick={onResume}><Play size={17} />Reprendre</button><button className="train-secondary" onClick={onRestart}><RotateCcw size={17} />Recommencer la partie</button><small className="train-restart-hint">Une nouvelle carte, au même niveau.</small><button className="train-text-button" onClick={onQuit}>Quitter la partie</button></dialog>;
}
