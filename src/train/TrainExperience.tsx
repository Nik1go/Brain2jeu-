import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, HelpCircle, LockKeyhole, RotateCcw, Settings2, Star, Target, TrainFront, Trophy, X } from 'lucide-react';
import { TRAIN_COLORS, TRAIN_LEVELS, TRAIN_RULES } from './config';
import { generateNetwork } from './network';
import { pointsPerTrain } from './scoring';
import { advanceTrains, newTrainGame, spawnTrain, toggleJunction } from './simulation';
import type { TrainGame } from './simulation';
import { finishTrainGame, saveTrainProgress } from './storage';
import type { TrainProgress, TrainResult } from './storage';
import { TrainBoard, tutorialDistance } from './TrainBoard';
import './train.css';

const format = (n: number) => n.toLocaleString('fr-FR');
type Screen = 'levels' | 'tutorial' | 'game' | 'result' | 'settings';
type Completed = { result: TrainResult; best: number; newRecord: boolean };
export function TrainExperience({ progress, onProgress, onExit, sound, reducedMotion, initialTutorial = false }: {
  progress: TrainProgress; onProgress: (p: TrainProgress) => void; onExit: () => void; sound: boolean; reducedMotion: boolean; initialTutorial?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>(initialTutorial ? 'tutorial' : 'levels');
  const [level, setLevel] = useState(progress.unlocked);
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [tutorialReturn, setTutorialReturn] = useState<'game' | 'settings'>(initialTutorial ? 'settings' : 'game');
  const [gameKey, setGameKey] = useState(0);
  const previous = useRef<{ signature?: string; colors?: string[] }>({});
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const save = useCallback((next: TrainProgress) => { if (!saveTrainProgress(next)) setStorageError(true); onProgress(next); }, [onProgress]);
  const start = (chosen = level) => {
    setLevel(chosen); setGameKey(k => k + 1);
    if (!progress.tutorialDone) { setTutorialReturn('game'); setScreen('tutorial'); }
    else setScreen('game');
  };
  const finish = useCallback((game: TrainGame, id: string) => {
    const saved = finishTrainGame(progress, game, id);
    save(saved.progress);
    setCompleted({ result: saved.result, best: saved.progress.best[game.network.level], newRecord: saved.newRecord });
    setScreen('result');
  }, [progress, save]);
  if (screen === 'game') return <TrainPlay key={gameKey} level={level} previous={previous.current} onGenerated={game => { previous.current = { signature: game.network.signature, colors: game.schedule.map(s => s.colorId) }; }} onFinish={finish} sound={sound} reducedMotion={reducedMotion} />;
  if (screen === 'tutorial') return <TrainTutorial reducedMotion={reducedMotion} onExit={() => setScreen(tutorialReturn === 'game' ? 'levels' : 'settings')} onDone={() => { save({ ...progress, tutorialDone: true }); setScreen(tutorialReturn); }} />;
  const nextLevel = completed ? completed.result.level + 1 : 1;
  return <main className={`train-hub ${reducedMotion ? 'reduce-motion' : ''}`}>
    <header className="train-hub-header"><button className="train-back" onClick={screen === 'levels' ? onExit : () => setScreen('levels')}><ArrowLeft size={18} />{screen === 'levels' ? 'Tous les jeux' : 'Les niveaux'}</button><span className="train-wordmark"><TrainFront size={21} />petit train<span>.</span></span><button className="icon-button" aria-label="Paramètres de Petit train" onClick={() => setScreen('settings')}><Settings2 size={19} /></button></header>
    {storageError && <p className="train-storage" role="status">Le stockage est indisponible. Tes progrès sont conservés pendant cette visite.</p>}
    {screen === 'levels' && <>
      <section className="train-intro"><span className="train-eyebrow">UNE PAUSE AU GRAND AIR</span><h1>À chaque train,<br />sa petite gare<span>.</span></h1><p>Aiguille les couleurs. Trouve ton rythme.<br />Un nouveau voyage à chaque partie.</p><div className="train-rule-pills"><span><Clock3 size={15} />2 minutes</span><span><Target size={15} />3 fautes maximum</span></div></section>
      <section className="train-level-section"><div className="train-section-heading"><h2>Ton itinéraire</h2><span>{progress.unlocked} / {TRAIN_LEVELS.length} niveaux ouverts</span></div><div className="train-levels">{TRAIN_LEVELS.map(config => {
        const locked = config.level > progress.unlocked;
        return <button key={config.level} className={`train-level-card ${level === config.level ? 'selected' : ''} ${locked ? 'locked' : ''}`} disabled={locked} onClick={() => setLevel(config.level)} aria-label={`Niveau ${config.level}, ${config.stations} gares${locked ? ', verrouillé' : ''}`} aria-pressed={level === config.level}>
          <span className="train-level-number">{locked ? <LockKeyhole size={19} /> : String(config.level).padStart(2, '0')}</span><span className="train-level-description"><strong>Niveau {config.level}</strong><small>{config.stations} gares · {pointsPerTrain(config.stations)} pts / train</small><span className="station-palette" aria-hidden="true">{TRAIN_COLORS.slice(0, config.stations).map(c => <i key={c.id} style={{ background: c.color }}>{c.symbol}</i>)}</span></span><span className="train-level-record">{progress.best[config.level] !== undefined ? <><Trophy size={12} />{format(progress.best[config.level])}</> : locked ? '' : 'À explorer'}{!locked && <ChevronRight size={17} />}</span>
        </button>;
      })}</div></section>
      <div className="train-launch"><div><span>PROCHAIN ARRÊT</span><strong>Niveau {String(level).padStart(2, '0')}<small> · {level + 1} gares</small></strong></div><button className="train-primary" onClick={() => start()}>En voiture <ArrowRight size={18} /></button></div>
    </>}
    {screen === 'settings' && <section className="train-settings"><span className="train-eyebrow">LES PETITS DÉTAILS</span><h1>Avant le départ<span>.</span></h1><p>Deux minutes pour guider chaque train vers sa gare. La couleur et le symbole vont toujours ensemble.</p><div className="train-settings-panel"><div><Clock3 /><p><strong>Un niveau, un voyage de 2 minutes.</strong><span>Termine avec 0 à 3 fautes pour ouvrir la suite. À partir de 4, continue à t’entraîner jusqu’à l’arrivée.</span></p></div><div><Trophy /><p><strong>Chaque bonne arrivée compte.</strong><span>De 100 à 275 points par train, selon le nombre de gares. Les records restent sur cet appareil.</span></p></div><button onClick={() => { setTutorialReturn('settings'); setScreen('tutorial'); }}><HelpCircle /><p><strong>Revoir le tutoriel interactif</strong><span>Un aiguillage, deux positions. À toi d’essayer.</span></p><ChevronRight /></button></div><button className="train-primary" onClick={() => setScreen('levels')}>Retrouver les niveaux <ArrowRight size={17} /></button></section>}
    {screen === 'result' && completed && <section className="train-results"><div className={`train-result-medal ${completed.result.passed ? 'passed' : ''}`}>{completed.result.passed ? <Check size={39} /> : <RotateCcw size={35} />}</div><span className="train-eyebrow">NIVEAU {String(completed.result.level).padStart(2, '0')} · VOYAGE TERMINÉ</span><h1>{completed.result.passed ? 'Niveau réussi !' : 'Niveau à recommencer'}</h1><p>{completed.result.passed ? nextLevel <= TRAIN_LEVELS.length ? 'La prochaine étape de ton voyage t’attend.' : 'Les huit étapes sont ouvertes. À toi les records !' : 'Quatre fautes ou plus. Un nouveau parcours, une nouvelle chance.'}</p><div className="train-result-score">{format(completed.result.score)}<small>POINTS</small></div><span className="train-record-badge"><Trophy size={15} />{completed.newRecord ? 'Nouveau record · ' : 'Record du niveau · '}{format(completed.best)} pts</span><div className="train-result-stats"><div><TrainFront size={20} /><strong>{completed.result.correct} / {completed.result.delivered}</strong><span>Trains corrects / livrés</span></div><div><Target size={20} /><strong>{completed.result.delivered ? Math.round(completed.result.correct / completed.result.delivered * 100) : 0} %</strong><span>Précision</span></div><div><X size={20} /><strong>{completed.result.errors}</strong><span>Faute{completed.result.errors !== 1 ? 's' : ''}</span></div></div><div className="train-result-actions">{nextLevel <= progress.unlocked && nextLevel <= TRAIN_LEVELS.length && <button className="train-primary" onClick={() => start(nextLevel)}>Niveau suivant <ArrowRight size={18} /></button>}<button className={nextLevel <= progress.unlocked && nextLevel <= TRAIN_LEVELS.length ? 'train-secondary' : 'train-primary'} onClick={() => start(completed.result.level)}><RotateCcw size={17} />Rejouer</button><button className="train-text-button" onClick={() => setScreen('levels')}>Choisir un niveau</button></div></section>}
  </main>;
}

function TrainPlay({ level, previous, onGenerated, onFinish, sound, reducedMotion }: { level: number; previous: { signature?: string; colors?: string[] }; onGenerated: (game: TrainGame) => void; onFinish: (game: TrainGame, id: string) => void; sound: boolean; reducedMotion: boolean }) {
  const [game, setGame] = useState(() => newTrainGame(level, { previousSignature: previous.signature, previousColors: previous.colors }));
  const started = useRef(performance.now()), id = useRef(crypto.randomUUID()), done = useRef(false);
  const initialGame = useRef(game), finish = useRef(onFinish), sounded = useRef(0), audio = useRef<AudioContext | null>(null);
  finish.current = onFinish;
  useEffect(() => { onGenerated(initialGame.current); }, []); // Snapshot once, including on replay.
  useEffect(() => {
    let raf: number;
    const frame = () => { setGame(g => advanceTrains(g, performance.now() - started.current)); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if (game.over && !done.current) { done.current = true; finish.current(game, id.current); }
    if (game.deliveries.length > sounded.current && sound && audio.current) {
      try { const context = audio.current, oscillator = context.createOscillator(), gain = context.createGain(); oscillator.connect(gain); gain.connect(context.destination); oscillator.frequency.value = game.deliveries.at(-1)?.correct ? 740 : 220; gain.gain.setValueAtTime(.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .16); oscillator.start(); oscillator.stop(context.currentTime + .17); } catch { /* Audio is optional. */ }
    }
    sounded.current = game.deliveries.length;
  }, [game, sound]);
  useEffect(() => () => { void audio.current?.close(); }, []);
  const toggle = (junction: number) => {
    if (sound) { try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { /* Optional. */ } }
    setGame(g => toggleJunction(g, junction, performance.now() - started.current));
  };
  const seconds = Math.ceil((TRAIN_RULES.durationMs - game.elapsedMs) / 1000);
  return <main className={`train-play ${reducedMotion ? 'reduce-motion' : ''}`}>
    <header className="train-hud"><div className="train-hud-level"><TrainFront size={17} /><span>NIVEAU<strong>{String(level).padStart(2, '0')}</strong></span></div><div className="train-hud-score"><span>SCORE</span><strong>{format(game.score)}</strong></div><div className={`train-hud-clock ${seconds <= 15 ? 'urgent' : ''}`} role="timer" aria-label={`${seconds} secondes restantes`}><Clock3 size={17} /><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong></div><div className={`train-hud-errors ${game.errors > TRAIN_RULES.maxErrors ? 'over-limit' : ''}`} aria-label={`${game.errors} fautes, maximum 3 pour réussir`}><span>FAUTES</span><strong>{game.errors}<small> / 3</small></strong></div></header>
    <div className="train-play-field"><TrainBoard game={game} onToggle={toggle} /></div>
  </main>;
}

function tutorialGame(): TrainGame {
  const network = generateNetwork(1, { entryZone: 'top-left', random: () => .4 });
  const base = { ...newTrainGame(1), network, switches: [false], schedule: [], spawnIndex: 0 };
  const train = spawnTrain(network, { id: 0, colorId: network.stations[0].color.id, atMs: 0 });
  return { ...base, trains: [{ ...train, distance: tutorialDistance(base) }] };
}
function TrainTutorial({ onDone, onExit, reducedMotion }: { onDone: () => void; onExit: () => void; reducedMotion: boolean }) {
  const [step, setStep] = useState<'switch' | 'ride' | 'done' | 'retry'>('switch');
  const [game, setGame] = useState(tutorialGame);
  const began = useRef(0);
  useEffect(() => {
    if (step !== 'ride') return;
    let raf: number;
    const frame = () => { setGame(g => advanceTrains(g, performance.now() - began.current)); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step]);
  useEffect(() => { if (game.deliveries.length) setStep(game.correct ? 'done' : 'retry'); }, [game.deliveries.length, game.correct]);
  const color = game.network.stations[0].color;
  return <main className={`train-tutorial ${reducedMotion ? 'reduce-motion' : ''}`}><header><button className="icon-button" aria-label="Quitter le tutoriel" onClick={onExit}><ArrowLeft size={20} /></button><span className="train-wordmark"><TrainFront size={20} />petit train<span>.</span></span><span className="train-tutorial-count">{step === 'done' ? '2 / 2' : '1 / 2'}</span></header><div className="train-tutorial-copy"><span className="train-eyebrow">UN PETIT ESSAI AVANT LE VOYAGE</span><h1>{step === 'switch' ? 'Une touche, un virage.' : step === 'ride' ? 'Le voilà sur la bonne voie.' : step === 'retry' ? 'On essaie encore ?' : 'Tu as le déclic !'}</h1><p>{step === 'switch' ? <>Ce train va à la gare <b style={{ color: color.color }}>{color.name} {color.symbol}</b>. Touche l’aiguillage entouré pour ouvrir le rail courbe. Un autre toucher le remet tout droit.</> : step === 'ride' ? <>Même couleur, même symbole <b style={{ color: color.color }}>{color.symbol}</b>. Laisse le train entrer dans le virage, puis touche le rail : il garde sa trajectoire.</> : step === 'retry' ? 'Le rail a changé avant l’entrée du train. Cette fois, garde le virage ouvert jusqu’à ce que le train y soit engagé.' : 'En partie, guide les trains pendant 2 minutes. Termine avec 3 fautes maximum pour débloquer le niveau suivant.'}</p></div><div className="train-tutorial-field"><TrainBoard game={game} onToggle={id => { if (step === 'switch') { setGame(g => toggleJunction(g, id)); began.current = performance.now(); setStep('ride'); } else if (step === 'ride') setGame(g => toggleJunction(g, id, performance.now() - began.current)); }} highlight={step === 'switch' ? 0 : undefined} interactive={step === 'switch' || step === 'ride'} /></div><footer>{step === 'done' ? <button className="train-primary" onClick={onDone}>C’est parti <ArrowRight size={18} /></button> : step === 'retry' ? <button className="train-primary" onClick={() => { setGame(tutorialGame()); setStep('switch'); }}>Réessayer <RotateCcw size={17} /></button> : <span>{step === 'switch' ? 'Touche directement le rail entouré' : 'Les trains avancent, tu choisis le chemin.'}</span>}</footer></main>;
}
