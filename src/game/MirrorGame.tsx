import { useEffect, useRef, useState } from 'react';
import { Clock3, Pause, Play, RotateCcw, Sparkles, Star, Trophy, X } from 'lucide-react';
import { Board } from '../components/Board';
import { answerGame, CHALLENGE_MS, newGame, PATH_REPLAY_MS, pauseGame, resumeGame, tickGame, VERDICT_START_MS } from './engine';
import type { Mode, Port, Session } from './engine';

type Props={mode:Mode;level:number;sound:boolean;reducedMotion:boolean;onUnlock:(level:number)=>void;onFinish:(s:Session)=>void;onExit:()=>void};
let audioContext:AudioContext|undefined;
function enableSound(){try{audioContext??=new AudioContext();void audioContext.resume();}catch{/* Optional sound. */}}
function playSound(correct:boolean){try{if(!audioContext)return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.frequency.setValueAtTime(correct?660:240,audioContext.currentTime);oscillator.frequency.exponentialRampToValueAtTime(correct?880:180,audioContext.currentTime+.12);gain.gain.setValueAtTime(.06,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.18);oscillator.start();oscillator.stop(audioContext.currentTime+.2);}catch{/* Sound never interrupts a game. */}}

function PauseMenu({onResume,onRestart,onExit}:{onResume:()=>void;onRestart:()=>void;onExit:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="modal mirror-pause-menu" aria-labelledby="mirror-pause-title" onCancel={event=>{event.preventDefault();onResume();}} onClick={event=>{if(event.target===event.currentTarget)onResume();}}>
    <button className="icon-button modal-close" aria-label="Reprendre la partie" onClick={onResume}><X size={21}/></button>
    <span className="pause-emblem"><Pause size={25}/></span><h2 id="mirror-pause-title">Partie en pause</h2><p>Prends ton temps. On reprend quand tu veux.</p>
    <button className="primary" onClick={onResume}><Play size={18}/>Reprendre</button>
    <button className="secondary pause-restart" onClick={onRestart}><RotateCcw size={17}/>Recommencer</button>
    <button className="text-link centered" onClick={onExit}>Quitter la partie</button>
  </dialog>;
}

export function MirrorGame({mode,level,sound,reducedMotion,onUnlock,onFinish,onExit}:Props){
  const [game,setGame]=useState(()=>newGame(mode,level,performance.now()));
  const done=useRef(false);
  const [systemReduced,setSystemReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setSystemReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  const paused=game.pausedAt!==null;
  const feedback=game.phase==='feedback';
  const feedbackElapsed=game.lastAt-game.phaseAt;
  const verdict=feedback&&feedbackElapsed>=VERDICT_START_MS;
  const calm=reducedMotion||systemReduced;
  const replayProgress=feedback?(calm?1:Math.min(1,feedbackElapsed/PATH_REPLAY_MS)):undefined;
  const displayedScore=feedback&&!verdict?game.session.score-game.pointsEarned:game.session.score;
  const successes=game.session.level>game.roundLevel?3:game.session.level<game.roundLevel?0:game.session.levelCorrect;
  const seconds=Math.ceil(game.session.remainingMs/1000);
  useEffect(()=>{let raf:number;const frame=()=>{setGame(g=>tickGame(g,performance.now()));raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf);},[]);
  useEffect(()=>{if(mode==='survival')onUnlock(game.session.maxLevel);},[game.session.maxLevel,mode,onUnlock]);
  useEffect(()=>{if(game.phase==='over'&&!done.current){done.current=true;onFinish(game.session);}},[game,onFinish]);
  useEffect(()=>{if(verdict&&sound)playSound(game.wasCorrect);},[verdict,game.wasCorrect,sound]);
  const choose=(port:Port)=>{if(sound)enableSound();setGame(g=>answerGame(g,port,performance.now()));};
  const resume=()=>setGame(g=>resumeGame(g,performance.now()));
  const restart=()=>{done.current=false;setGame(newGame(mode,level,performance.now()));};
  return <main className={`game-screen ${calm?'reduce-motion':''} ${paused?'is-paused':''}`} data-phase={game.phase} data-paused={paused}>
    <div className="game-top"><button className="icon-button" onClick={()=>setGame(g=>pauseGame(g,performance.now()))} aria-label="Mettre la partie en pause" title="Pause"><Pause size={22}/></button>
      <div className="game-level"><Star size={16}/><span>Niveau {String(game.roundLevel).padStart(2,'0')}{mode==='survival'&&<small className="level-successes" aria-label={`${successes} bonnes réponses sur 3 pour progresser`}>{successes}/3</small>}</span></div>
      <div className={`game-score ${verdict&&game.pointsEarned>0?'score-awarded':''}`}><Trophy size={17}/><strong key={`score-${verdict?game.session.answers:'rest'}`}>{displayedScore.toLocaleString('fr-FR')}</strong>{verdict&&game.pointsEarned>0&&<span key={`gain-${game.session.answers}`} className="score-gain" aria-label={`${game.pointsEarned} points gagnés`}>+{game.pointsEarned}<Sparkles size={12}/></span>}</div>
    </div>
    {mode==='challenge'?<div className="challenge-timing"><div className={`game-clock ${seconds<=15?'urgent':''}`} role="timer" aria-label={`${seconds} secondes restantes`}><Clock3 size={15}/><strong>{seconds}</strong><small>s</small></div><div className="time-track" role="progressbar" aria-valuemin={0} aria-valuemax={CHALLENGE_MS/1000} aria-valuenow={seconds} aria-label="Secondes restantes"><span style={{width:`${game.session.remainingMs/CHALLENGE_MS*100}%`}}/></div></div>:<div className="lives" aria-label={`${Math.max(0,3-game.session.totalErrors)} erreurs restantes`}>{[0,1,2].map(i=><span key={i} className={i<3-game.session.totalErrors?'alive':''}/>)}</div>}
    <div className={`game-board-area phase-${game.phase}`}><Board board={game.board} showMirrors={game.phase==='observe'||feedback} showEntry={game.phase!=='observe'} interactive={game.phase==='answer'&&!paused} onSelect={choose} selected={verdict?game.selected:null} correct={game.wasCorrect} showPath={feedback} replayProgress={replayProgress} verdict={verdict}/>{verdict&&game.session.level!==game.roundLevel&&<div className={`level-change-notice ${game.session.level>game.roundLevel?'up':'down'}`}><Star size={16}/>{game.session.level>game.roundLevel?'Niveau débloqué':'Retour au niveau'} {String(game.session.level).padStart(2,'0')}</div>}</div>
    <span className="sr-only" role="status" aria-live="polite">{paused?'Partie en pause.':game.phase==='observe'?'Mémorise les miroirs.':game.phase==='answer'?'La balle est apparue. Choisis une sortie.':feedback?(verdict?(game.wasCorrect?'Bonne réponse.':'Mauvaise réponse.'):'La balle parcourt le trajet réel.'):'Partie terminée.'}</span>
    {paused&&<PauseMenu onResume={resume} onRestart={restart} onExit={onExit}/>}
  </main>;
}
