import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, HelpCircle, RotateCcw, Target, Trophy, X, Zap } from 'lucide-react';
import { afterTimeBarPaint, paintMathTime } from './timeBar';
import { mathLevel, MATH_LEVELS, MATH_RULES } from './config';
import type { MathLevelId } from './config';
import { createChoices } from './distractors';
import { displayNumber, formatExpression } from './expressions';
import { createFinanceChoices, formatFinance } from './finance';
import { advanceMathGame, answerMathGame, newMathGame } from './game';
import type { MathGame, Question } from './game';
import { accuracy } from './scoring';
import { finishMathGame } from './storage';
import type { MathProgress, MathResult } from './storage';
import './math.css';

const format = (n: number) => n.toLocaleString('fr-FR');
export function MathExperience({ progress, onProgress, onExit, onTutorialExit, sound, reducedMotion, initialTutorial = false, renderComparison, onLeaderboard, onGameStart, storageError = false }: {
  progress: MathProgress; onProgress: (p: MathProgress) => void; onExit: () => void;
  onTutorialExit?: () => void; sound: boolean; reducedMotion: boolean; initialTutorial?: boolean;
  renderComparison?: (result: MathResult) => ReactNode; onLeaderboard?: () => void;
  onGameStart?: () => void;
  storageError?: boolean;
}) {
  const [screen, setScreen] = useState<'levels' | 'tutorial' | 'game' | 'result'>(initialTutorial ? 'tutorial' : 'levels');
  const [level, setLevel] = useState<MathLevelId>('small');
  const [completed, setCompleted] = useState<{ result: MathResult; newRecord: boolean } | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const save = useCallback((next: MathProgress) => {
    onProgress(next);
  }, [onProgress]);
  const finish = useCallback((game: MathGame, id: string) => {
    const saved = finishMathGame(progress, game, id);
    save(saved.progress);
    setCompleted({ result: saved.result, newRecord: saved.newRecord });
    setScreen('result');
  }, [progress, save]);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  const start = (chosen: MathLevelId) => { setLevel(chosen); setGameKey(k => k + 1); if (progress.tutorialDone) onGameStart?.(); setScreen(progress.tutorialDone ? 'game' : 'tutorial'); };
  if (screen === 'levels') return <main className={`math-hub ${reducedMotion ? 'reduce-motion' : ''}`}>
    <header><button className="math-back" onClick={onExit}><ArrowLeft size={18} />Tous les jeux</button><span className="math-wordmark"><Zap size={18} />calcul mental<span>.</span></span></header>
    <section className="math-hub-intro"><span className="math-eyebrow">À CHAQUE ENVIE, SON DÉCLIC</span><h1>Trois façons de<br />faire le calcul<span>.</span></h1><p>Petits chiffres, grands défis ou esprit finance.<br />Choisis ton terrain de jeu.</p><div className="math-hub-rules"><span><Clock3 size={14} />10 s au départ</span><span>+2 à +4 s / −5 s</span><span>11 à 15 s max.</span></div></section>
    {storageError && <p className="math-storage" role="status">Le stockage est indisponible. Tes records restent disponibles pendant cette visite.</p>}
    <section className="math-levels" aria-label="Choisir un niveau">{MATH_LEVELS.map(config => <button key={config.id} className={`math-level-card level-${config.id}`} onClick={() => start(config.id)} aria-label={`Niveau ${config.number} · ${config.title}`}>
      <span className="math-level-number">0{config.number}</span><span className="math-level-copy"><small>NIVEAU {config.number}</small><strong>{config.title}</strong><span>{config.description}</span><em>{config.example}</em><span className="math-level-detail">{config.detail}</span><span>Bonne réponse : +{config.bonusMs / 1000} s · {config.capacityMs / 1000} s max.</span><span className="math-level-best"><Trophy size={13} />Record : {format(progress.bestByLevel[config.id])} pts</span></span><ChevronRight size={20} />
    </button>)}</section>
    {onLeaderboard && <button className="game-ranking-link" onClick={onLeaderboard}><Trophy size={16}/>Voir les classements <ArrowRight size={16}/></button>}
    <button className="math-tutorial-link" onClick={() => setScreen('tutorial')}><HelpCircle size={16} />{progress.tutorialDone ? 'Revoir le tutoriel' : 'Découvrir les règles'}</button>
  </main>;
  if (screen === 'game') return <MathPlay key={gameKey} level={level} onFinish={finish} sound={sound} reducedMotion={reducedMotion} />;
  if (screen === 'tutorial') return <MathTutorial level={level} reducedMotion={reducedMotion} onExit={initialTutorial ? onTutorialExit ?? onExit : () => setScreen('levels')} onDone={() => {
    save({ ...progress, tutorialDone: true });
    onGameStart?.();
    setScreen('game');
  }} />;
  return <main className={`math-summary ${reducedMotion ? 'reduce-motion' : ''}`}>
    <div className="math-wordmark"><Zap size={19} />calcul mental<span>.</span></div>
    {storageError && <p className="math-storage" role="status">Le stockage est indisponible. Ton record reste disponible pendant cette visite.</p>}
    {completed && <section className="math-result">
      <span className="math-medal"><Trophy size={38} strokeWidth={1.6} /></span>
      <span className="math-eyebrow">NIVEAU {mathLevel(completed.result.level).number} · {mathLevel(completed.result.level).title.toLocaleUpperCase('fr-FR')}</span>
      <h1>Bien joué, l’esprit vif<span> !</span></h1>
      <p>Un petit calcul. Un nouveau déclic.</p>
      <div className="math-final-score">{format(completed.result.score)}<span>POINTS</span></div>
      <div className={`math-record ${completed.newRecord ? 'is-new' : ''}`}><Trophy size={16} />{completed.newRecord ? 'Nouveau record' : 'Record du niveau'}<strong>{format(progress.bestByLevel[completed.result.level])} pts</strong></div>
      {renderComparison?.(completed.result)}
      <div className="math-result-stats">
        <div><Check size={20} /><strong>{completed.result.correct} / {completed.result.answers}</strong><span>Bonnes réponses / réponses</span></div>
        <div><Target size={20} /><strong>{accuracy(completed.result)} %</strong><span>Précision</span></div>
        <div><Clock3 size={20} /><strong>{(completed.result.durationMs / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s</strong><span>Durée de la partie</span></div>
      </div>
      <button className="math-primary" onClick={() => { onGameStart?.(); setGameKey(k => k + 1); setScreen('game'); }}><RotateCcw size={18} />Rejouer</button>
      <button className="math-menu" onClick={() => setScreen('levels')}>Menu <ArrowRight size={16} /></button>
    </section>}
  </main>;
}

export function MathAnswers({ question, feedback, onAnswer, locked = false }: {
  question: Question; feedback?: MathGame['feedback']; onAnswer: (value: number) => void; locked?: boolean;
}) {
  return <div className="math-answers" role="group" aria-label="Choisis la bonne réponse">{question.choices.map((value, i) => {
    const revealed = !!feedback && value === question.answer;
    const wrong = !!feedback && !feedback.correct && value === feedback.selected;
    return <button key={i} className={`math-answer${question.unit ? ' has-unit' : ''}${revealed ? ' is-correct' : ''}${wrong ? ' is-wrong' : ''}`} disabled={locked} onClick={() => onAnswer(value)} aria-label={`${displayNumber(value)}${question.unit ? ` ${question.unit}` : ''}${revealed ? ', bonne réponse' : wrong ? ', réponse incorrecte' : ''}`}>
      <span>{displayNumber(value)}{question.unit && <small> {question.unit}</small>}</span>{revealed ? <Check size={22} aria-hidden="true" /> : wrong ? <X size={22} aria-hidden="true" /> : null}
    </button>;
  })}</div>;
}

export function MathPlay({ onFinish, sound, reducedMotion, level = 'small' }: { onFinish: (game: MathGame, id: string) => void; sound: boolean; reducedMotion: boolean; level?: MathLevelId }) {
  const [game, setGame] = useState(() => newMathGame(performance.now(), Math.random, level));
  const current = useRef(game), done = useRef(false), id = useRef(crypto.randomUUID());
  const timeBar = useRef<HTMLDivElement>(null);
  const finish = useRef(onFinish), audio = useRef<AudioContext | null>(null);
  finish.current = onFinish;
  // The ref is the authoritative state: two events in the same React batch cannot count twice.
  const publish = useCallback((next: MathGame, at: number) => {
    const previous = current.current;
    current.current = next;
    paintMathTime(timeBar.current, next.clock, at);
    // Countdown frames update only the bar, not the entire question or its buttons.
    if (next !== previous) setGame(next);
  }, []);
  useEffect(() => {
    if (game.phase !== 'over') return;
    return afterTimeBarPaint(() => {
      if (!done.current) { done.current = true; finish.current(current.current, id.current); }
    });
  }, [game.phase]);
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      const at = performance.now();
      publish(advanceMathGame(current.current, at), at);
      return at;
    };
    const frame = () => { sync(); if (current.current.phase !== 'over') raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', sync); window.removeEventListener('pageshow', sync); };
  }, [publish]);
  useEffect(() => {
    // Re-arm on every bonus/penalty, independently of the animation frame loop.
    let wake = 0;
    const checkDeadline = () => {
      const at = performance.now();
      publish(advanceMathGame(current.current, at), at);
      if (current.current.phase !== 'over') wake = window.setTimeout(checkDeadline, Math.max(1, current.current.clock.deadline - at));
    };
    wake = window.setTimeout(checkDeadline, Math.max(1, game.clock.deadline - performance.now()));
    return () => clearTimeout(wake);
  }, [game.clock.deadline, publish]);
  useEffect(() => () => { void audio.current?.close(); }, []);
  const answer = (value: number) => {
    const before = current.current;
    const at = performance.now();
    const next = answerMathGame(before, game.question.id, value, at);
    publish(next, at);
    if (sound && next.answers > before.answers) {
      try {
        audio.current ??= new AudioContext();
        const context = audio.current;
        void context.resume();
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.frequency.value = next.feedback?.correct ? 660 : 220;
        gain.gain.setValueAtTime(.025, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .1);
        oscillator.start(); oscillator.stop(context.currentTime + .12);
      } catch { /* Sound is optional; input and timing never depend on it. */ }
    }
  };
  return <main className={`math-play ${reducedMotion ? 'reduce-motion' : ''}`} data-level={level} data-phase={game.phase} data-feedback={game.phase === 'feedback' ? game.feedback?.correct ? 'correct' : 'wrong' : undefined}>
    <header className="math-hud"><span>SCORE</span><strong aria-label={`Score : ${game.score}`}>{format(game.score)}</strong></header>
    {/* React sets the initial fill; the frame loop exclusively owns its live position. */}
    <div ref={timeBar} className="math-time" role="progressbar" aria-label="Réserve de temps en secondes" aria-valuemin={0} aria-valuemax={game.clock.capacityMs / 1000} aria-valuenow={game.phase === 'over' ? 0 : 10}><span style={{ transform: `scaleX(${game.phase === 'over' ? 0 : MATH_RULES.initialMs / game.clock.capacityMs})` }} /></div>
    <div className={`math-problem${game.question.unit ? ' is-finance' : ''}`}>
      {game.question.context && <p>{game.question.context}</p>}
      <h1 className={game.question.operationCount > 1 || game.question.prompt.length > 19 ? 'is-long' : ''} aria-label={`Calcul : ${game.question.prompt}`}>{game.question.prompt}</h1>
    </div>
    <MathAnswers question={game.question} feedback={game.phase === 'feedback' ? game.feedback : undefined} locked={game.phase !== 'question'} onAnswer={answer} />
    <span className="sr-only" role="status">{game.phase === 'feedback' ? game.feedback?.correct ? `Bonne réponse. Plus ${mathLevel(game.level).bonusMs / 1000} secondes.` : `Réponse incorrecte. Moins 5 secondes. La bonne réponse était ${displayNumber(game.question.answer)}.` : ''}</span>
  </main>;
}

export function MathTutorial({ onDone, onExit, reducedMotion, level = 'small' }: { onDone: () => void; onExit: () => void; reducedMotion: boolean; level?: MathLevelId }) {
  const [question] = useState<Question>(() => {
    if (level === 'finance') {
      const problem = { kind: 'portion' as const, amount: 250, rate: 20 };
      return { id: 0, prompt: formatFinance(problem), signature: 'practice-finance', answer: 50, choices: createFinanceChoices(problem), operationCount: 1, unit: '€' };
    }
    if (level === 'large') {
      const expression = { operands: [125, 75], operators: ['+' as const] };
      return { id: 0, prompt: formatExpression(expression), signature: 'practice-large', answer: 200, choices: createChoices(expression), operationCount: 1 };
    }
    const expression = { operands: [3, -1], operators: ['−' as const] };
    return { id: 0, prompt: formatExpression(expression), signature: 'practice-small', answer: 4, choices: createChoices(expression), operationCount: 1 };
  });
  const [selected, setSelected] = useState<number | null>(null);
  const feedback = selected === null ? undefined : { selected, correct: selected === question.answer, until: 0 };
  const explanation = level === 'finance' ? '10 % de 250 € = 25 €, donc 20 % = 50 €.' : level === 'large' ? '125 + 75 = 125 + 25 + 50 = 200.' : 'Soustraire un négatif, c’est additionner : 3 + 1 = 4.';
  return <main className={`math-tutorial ${reducedMotion ? 'reduce-motion' : ''}`}>
    <header><button className="icon-button" aria-label="Quitter le tutoriel" onClick={onExit}><ArrowLeft size={20} /></button><span className="math-wordmark"><Zap size={18} />calcul mental<span>.</span></span></header>
    <section className="math-tutorial-intro"><span className="math-eyebrow">UN ESSAI POUR PRENDRE LE RYTHME</span><h1>Le bon calcul,<br />au bon moment<span>.</span></h1><p>Choisis la bonne réponse parmi quatre.<br />Tu commences avec <strong>10 secondes</strong>.</p>
      <div className="math-rules"><span><Check size={16} /><strong>+{mathLevel(level).bonusMs / 1000} s</strong><small>Bonne réponse · +100 pts</small></span><span><X size={16} /><strong>−5 s</strong><small>Mauvaise réponse</small></span><span><Clock3 size={16} /><strong>{mathLevel(level).capacityMs / 1000} s max.</strong><small>À zéro, la partie se termine</small></span></div>
      <p className="math-practice-label">À toi d’essayer · sans chrono ni points</p>
    </section>
    <div className="math-practice"><h2>{question.prompt}</h2><MathAnswers question={question} feedback={feedback} locked={selected !== null} onAnswer={setSelected} /></div>
    <footer><p role="status">{selected === null ? 'Touche une réponse pour essayer.' : `${selected === question.answer ? 'Exact !' : `La bonne réponse est ${question.answer}${question.unit ? ' €' : ''}.`} ${explanation}`}</p>{selected !== null && <button className="math-primary" onClick={onDone}>C’est parti <ArrowRight size={18} /></button>}</footer>
  </main>;
}
