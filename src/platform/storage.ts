import type { Session } from '../game/engine';
export interface SavedResult { date: string; mode: Session['mode']; level: number; score: number; correct: number; answers: number; responseTotalMs: number }
export interface Progress { version: 1; unlocked: number; tutorialDone: boolean; survivalBest: number|null; challengeBest: Record<string,number>; history: SavedResult[]; sound: boolean; reducedMotion: boolean }
export const STORAGE_KEY='declic.progress.v1';
export const emptyProgress=():Progress=>({version:1,unlocked:1,tutorialDone:false,survivalBest:null,challengeBest:{},history:[],sound:true,reducedMotion:false});
// One adapter boundary to replace with native persistence later.
export function loadProgress(): Progress {
  try {
    const p=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if (!p || p.version!==1) return emptyProgress();
    const validScore=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    return {...emptyProgress(),unlocked:Number.isInteger(p.unlocked)?Math.min(18,Math.max(1,p.unlocked)):1,tutorialDone:p.tutorialDone===true,
      survivalBest:validScore(p.survivalBest)?p.survivalBest:null,
      challengeBest:Object.fromEntries(Object.entries(p.challengeBest||{}).flatMap(([k,v])=>Number.isInteger(Number(k))&&Number(k)>=1&&Number(k)<=18&&validScore(v)?[[k,v]]:[])),
      history:Array.isArray(p.history)?p.history.filter((h:SavedResult)=>h&&validScore(h.score)&&['survival','challenge'].includes(h.mode)&&validScore(h.answers)&&validScore(h.correct)&&validScore(h.responseTotalMs)).slice(-100):[],sound:p.sound!==false,reducedMotion:p.reducedMotion===true};
  } catch { return emptyProgress(); }
}
export function saveProgress(p:Progress): boolean {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(p));return true;} catch {return false;}
}
export function finishSession(progress:Progress,s:Session):{progress:Progress;firstRecord:boolean;newRecord:boolean;best:number} {
  const old=s.mode==='survival'?progress.survivalBest:progress.challengeBest[String(s.level)]??null;
  const best=Math.max(old??0,s.score);
  const history=[...progress.history,{date:new Date().toISOString(),mode:s.mode,level:s.maxLevel,score:s.score,correct:s.correct,answers:s.answers,responseTotalMs:s.responseTotalMs}].slice(-100);
  return {progress:{...progress,unlocked:Math.max(progress.unlocked,s.mode==='survival'?s.maxLevel:1),survivalBest:s.mode==='survival'?best:progress.survivalBest,challengeBest:s.mode==='challenge'?{...progress.challengeBest,[s.level]:best}:progress.challengeBest,history},firstRecord:old===null,newRecord:old!==null&&s.score>old,best};
}
