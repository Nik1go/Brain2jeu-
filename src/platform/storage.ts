import { CHALLENGE_MS, MAX_LEVEL, PROGRESSION_VERSION } from '../game/engine';
import type { Session } from '../game/engine';
export interface SavedResult { id?: string; date: string; mode: Session['mode']; level: number; score: number; correct: number; answers: number; responseTotalMs: number; durationMs?: number; progressionVersion?:number }
export interface PreviousLevelRecords { survivalBest:number|null; challengeBest:Record<string,number> }
export interface Progress { version: 1; progressionVersion:number; unlocked: number; tutorialDone: boolean; survivalBest: number|null; challengeBest: Record<string,number>; previousLevelRecords:PreviousLevelRecords|null; legacyChallengeBest: Record<string,number>; challengeDurationMs: number; history: SavedResult[]; sound: boolean; reducedMotion: boolean }
export const STORAGE_KEY='declic.progress.v1';
export const emptyProgress=():Progress=>({version:1,progressionVersion:PROGRESSION_VERSION,unlocked:1,tutorialDone:false,survivalBest:null,challengeBest:{},previousLevelRecords:null,legacyChallengeBest:{},challengeDurationMs:CHALLENGE_MS,history:[],sound:true,reducedMotion:false});
// One adapter boundary to replace with native persistence later.
export function loadProgress(): Progress {
  try { return parseProgress(localStorage.getItem(STORAGE_KEY)); } catch { return emptyProgress(); }
}
export function parseProgress(raw: string | null): Progress {
  try {
    const p=JSON.parse(raw || 'null');
    if (!p || p.version!==1) return emptyProgress();
    const validScore=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    const records=(value:unknown,max=MAX_LEVEL+1):Record<string,number>=>Object.fromEntries(Object.entries(value&&typeof value==='object'?value:{}).flatMap(([k,v])=>Number.isInteger(Number(k))&&Number(k)>=1&&Number(k)<=max&&validScore(v)?[[k,v]]:[]));
    const oldChallenge=p.challengeDurationMs!==CHALLENGE_MS;
    const oldLevels=p.progressionVersion!==PROGRESSION_VERSION;
    const oldBest=validScore(p.survivalBest)?p.survivalBest:null;
    const oldChallengeBest=oldChallenge?{}:records(p.challengeBest);
    const archived=oldLevels?{survivalBest:oldBest,challengeBest:oldChallengeBest}:p.previousLevelRecords;
    const previousLevelRecords=archived&&typeof archived==='object'?{survivalBest:validScore(archived.survivalBest)?archived.survivalBest:null,challengeBest:records(archived.challengeBest)}:null;
    const unlocked=Number.isInteger(p.unlocked)?p.unlocked:1;
    return {...emptyProgress(),unlocked:Math.min(MAX_LEVEL,Math.max(1,oldLevels?unlocked-1:unlocked)),tutorialDone:p.tutorialDone===true,
      survivalBest:oldLevels?null:oldBest,previousLevelRecords,
      challengeBest:oldLevels?{}:records(oldChallengeBest,MAX_LEVEL),legacyChallengeBest:{...records(p.legacyChallengeBest),...(oldChallenge?records(p.challengeBest):{})},challengeDurationMs:CHALLENGE_MS,
      history:Array.isArray(p.history)?p.history.filter((h:SavedResult)=>h&&typeof h.date==='string'&&h.date.length<=40&&Number.isFinite(Date.parse(h.date))&&Number.isInteger(h.level)&&h.level>=1&&h.level<=MAX_LEVEL+1&&validScore(h.score)&&['survival','challenge'].includes(h.mode)&&validScore(h.answers)&&validScore(h.correct)&&h.correct<=h.answers&&validScore(h.responseTotalMs)).slice(-100).map((h:SavedResult)=>({...(typeof h.id==='string'&&h.id.length<=128?{id:h.id}:{}),date:h.date,mode:h.mode,level:h.level,score:h.score,correct:h.correct,answers:h.answers,responseTotalMs:h.responseTotalMs,progressionVersion:h.progressionVersion===1?1:(oldLevels?1:PROGRESSION_VERSION),...(h.mode==='challenge'?{durationMs:h.durationMs===120000?120000:(oldChallenge?120000:CHALLENGE_MS)}:{})})):[],sound:p.sound!==false,reducedMotion:p.reducedMotion===true};
  } catch { return emptyProgress(); }
}
export function saveProgress(p:Progress): boolean {
  try {localStorage.setItem(STORAGE_KEY,JSON.stringify(p));return true;} catch {return false;}
}
export function finishSession(progress:Progress,s:Session):{progress:Progress;firstRecord:boolean;newRecord:boolean;best:number} {
  const old=s.mode==='survival'?progress.survivalBest:progress.challengeBest[String(s.level)]??null;
  const best=Math.max(old??0,s.score);
  const history=[...progress.history,{id:crypto.randomUUID(),date:new Date().toISOString(),mode:s.mode,level:s.maxLevel,score:s.score,correct:s.correct,answers:s.answers,responseTotalMs:s.responseTotalMs,durationMs:s.mode==='challenge'?CHALLENGE_MS:undefined,progressionVersion:PROGRESSION_VERSION}].slice(-100);
  return {progress:{...progress,unlocked:Math.max(progress.unlocked,s.mode==='survival'?s.maxLevel:1),survivalBest:s.mode==='survival'?best:progress.survivalBest,challengeBest:s.mode==='challenge'?{...progress.challengeBest,[s.level]:best}:progress.challengeBest,history},firstRecord:old===null,newRecord:old!==null&&s.score>old,best};
}
