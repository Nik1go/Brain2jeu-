import { describe, expect, it } from 'vitest';
import { answerGame, CHALLENGE_MS, CORRECTION_MS, elapse, generateBoard, LEVELS, MAX_LEVEL, newGame, newSession, PATH_REPLAY_MS, pauseGame, pointsFor, positionOnPath, recordAnswer, reflect, resumeGame, simulate, tickGame } from './engine';
import type { Direction, Mirror, Port } from './engine';
import { emptyProgress, finishSession, loadProgress, saveProgress, STORAGE_KEY } from '../platform/storage';
import { BOUNCE_PROFILES } from './bounces';

describe('réflexions et simulation',()=>{
 it.each([
   ['up','/','right'],['right','/','up'],['down','/','left'],['left','/','down'],
   ['up','\\','left'],['left','\\','up'],['down','\\','right'],['right','\\','down'],
 ] as [Direction,Mirror['slope'],Direction][])('%s sur %s → %s',(direction,slope,result)=>expect(reflect(direction,slope)).toBe(result));
 it('suit plusieurs miroirs et sort du bon côté',()=>{
   const result=simulate(3,[{row:1,col:0,slope:'/'},{row:0,col:0,slope:'/'},{row:0,col:2,slope:'\\'}],{side:'left',index:1});
   expect(result?.exit).toEqual({side:'bottom',index:2});expect(result?.hits).toBe(3);
 });
 it('ne modifie pas un trajet sans miroir',()=>expect(simulate(3,[],{side:'top',index:2})?.exit).toEqual({side:'bottom',index:2}));
 it('génère des plateaux valides dans les bornes de rebonds de chaque niveau',()=>{
   let seed=123456;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   LEVELS.forEach((config,i)=>{for(let trial=0;trial<30;trial++){
     const b=generateBoard(i+1,random);expect(b.size).toBe(config.size);expect(b.mirrors).toHaveLength(config.mirrors);
     expect(new Set(b.mirrors.map(m=>`${m.row}:${m.col}`)).size).toBe(config.mirrors);
     expect(b.hits).toBeGreaterThanOrEqual(BOUNCE_PROFILES[i].min);
     expect(b.hits).toBeLessThanOrEqual(BOUNCE_PROFILES[i].max);
     expect(simulate(b.size,b.mirrors,b.entry)?.exit).toEqual(b.exit);
   }});
 });
});
describe('survie',()=>{
 it('démarre sur l’ancien niveau 2 et conserve 17 niveaux',()=>{
   expect(LEVELS).toHaveLength(17);expect(LEVELS[0]).toEqual({size:3,mirrors:2});
   expect(LEVELS[16]).toEqual({size:6,mirrors:15});
   expect(newGame('survival',1,0).board.mirrors).toHaveLength(2);
   expect(newSession('challenge',99).level).toBe(17);
 });
 it('commence toujours au niveau 1',()=>expect(newSession('survival',12).level).toBe(1));
 it('monte après trois réussites non consécutives et remet le compteur à zéro',()=>{
   let s=newSession('survival');for(const correct of [true,false,true,true])s=recordAnswer(s,correct,1500);
   expect(s.level).toBe(2);expect(s.levelCorrect).toBe(0);expect(s.totalErrors).toBe(1);expect(s.consecutiveErrors).toBe(0);
 });
 it('descend après deux erreurs consécutives, sans perdre les points',()=>{
   let s={...newSession('survival'),level:3,maxLevel:3,score:900,levelCorrect:1};
   s=recordAnswer(recordAnswer(s,false,1000),false,1000);
   expect(s.level).toBe(2);expect(s.score).toBe(900);expect(s.levelCorrect).toBe(0);expect(s.consecutiveErrors).toBe(0);expect(s.totalErrors).toBe(2);
 });
 it('une bonne réponse interrompt la série d’erreurs',()=>{
   const s=recordAnswer(recordAnswer(newSession('survival'),false,1000),true,1000);
   expect(s.consecutiveErrors).toBe(0);expect(s.totalErrors).toBe(1);
 });
 it('le game over prime sur une descente',()=>{
   const s=recordAnswer({...newSession('survival'),level:4,totalErrors:2,consecutiveErrors:1},false,1000);
   expect(s.over).toBe(true);expect(s.level).toBe(4);
 });
 it('trois erreurs non consécutives terminent aussi la partie',()=>{
   let s=newSession('survival');for(const correct of [false,true,false,true,false])s=recordAnswer(s,correct,500);
   expect(s.over).toBe(true);expect(s.totalErrors).toBe(3);
 });
 it('respecte les limites de niveau et fige une partie terminée',()=>{
   const low=recordAnswer(recordAnswer(newSession('survival'),false,0),false,0);expect(low.level).toBe(1);
   const high=recordAnswer({...newSession('survival'),level:MAX_LEVEL,maxLevel:MAX_LEVEL,levelCorrect:2},true,0);expect(high.level).toBe(MAX_LEVEL);expect(high.levelCorrect).toBe(0);
   const end={...high,over:true};expect(recordAnswer(end,true,0)).toBe(end);
 });
});
describe('pause des miroirs',()=>{
 it('fige le chrono et les trois secondes d’observation sur le même plateau',()=>{
   const game=newGame('challenge',1,0),paused=pauseGame(game,1000);
   expect(paused.session.remainingMs).toBe(89000);expect(tickGame(paused,100000)).toBe(paused);
   const resumed=resumeGame(paused,101000);
   expect(resumed.board).toBe(game.board);expect(resumed.session.remainingMs).toBe(89000);
   expect(tickGame(resumed,102999).phase).toBe('observe');expect(tickGame(resumed,103000).phase).toBe('answer');
 });
 it('exclut la pause du temps de réponse, du bonus et de la durée du Défi',()=>{
   let g=tickGame(newGame('challenge',1,0),3000);g=pauseGame(g,3500);g=resumeGame(g,63500);g=answerGame(g,g.board.exit,64000);
   expect(g.session.responseTotalMs).toBe(1000);expect(g.pointsEarned).toBe(145);expect(g.session.remainingMs).toBe(86000);
 });
 it('reprend la correction au même endroit sans compter le temps de pause',()=>{
   let g=tickGame(newGame('survival',1,0),3000);g=answerGame(g,g.board.exit,3500);g=pauseGame(g,3700);
   expect(tickGame(g,60000)).toBe(g);g=resumeGame(g,63700);
   expect(g.lastAt-g.phaseAt).toBe(200);expect(tickGame(g,63500+CORRECTION_MS-1).phase).toBe('feedback');
   expect(tickGame(g,63500+CORRECTION_MS).phase).toBe('observe');
 });
 it('refuse toute réponse pendant la pause et ne suspend pas une partie déjà expirée',()=>{
   let g=tickGame(newGame('challenge',1,0),3000);g=pauseGame(g,3500);
   expect(answerGame(g,g.board.exit,5000).session.answers).toBe(0);
   const expired=pauseGame(newGame('challenge',1,0),CHALLENGE_MS);expect(expired.phase).toBe('over');expect(expired.pausedAt).toBe(null);
 });
});
describe('score et Défi',()=>{
 it('applique le bonus par secondes entières et le borne à zéro',()=>{
   expect(pointsFor(1,0)).toBe(150);expect(pointsFor(2,1999)).toBe(170);expect(pointsFor(MAX_LEVEL,25000)).toBe(500);expect(pointsFor(1,10000)).toBe(100);
 });
 it('ne donne aucun point pour une erreur et garde le niveau Défi fixe',()=>{
   let s=newSession('challenge',7);for(let i=0;i<5;i++)s=recordAnswer(s,false,1000);expect(s.over).toBe(false);expect(s.level).toBe(7);expect(s.score).toBe(0);
   for(let i=0;i<8;i++)s=recordAnswer(s,true,0);expect(s.level).toBe(7);
 });
 it('termine à zéro sans compter une manche sans réponse',()=>{
   const s=elapse(newSession('challenge'),CHALLENGE_MS+100);expect(s.over).toBe(true);expect(s.remainingMs).toBe(0);expect(s.answers).toBe(0);
 });
 it('cache les miroirs après 3000 ms et refuse une réponse avant',()=>{
   let g=newGame('survival',1,0);g=answerGame(g,g.board.exit,2999);expect(g.session.answers).toBe(0);expect(g.phase).toBe('observe');
   g=tickGame(g,3000);expect(g.phase).toBe('answer');g=answerGame(g,g.board.exit,4000);expect(g.session.score).toBe(145);
 });
 it('compte observation + réponse et suspend le temps pendant la correction',()=>{
   let g=newGame('challenge',2,0);g=tickGame(g,3000);g=answerGame(g,g.board.exit,4500);expect(g.session.remainingMs).toBe(CHALLENGE_MS-4500);
   g=tickGame(g,4500+CORRECTION_MS);expect(g.phase).toBe('observe');expect(g.session.remainingMs).toBe(CHALLENGE_MS-4500);
   g=tickGame(g,4500+CORRECTION_MS+1000);expect(g.session.remainingMs).toBe(CHALLENGE_MS-5500);
 });
 it('ignore un toucher au moment où le chronomètre expire',()=>{
   let g=newGame('challenge',1,0);g=tickGame(g,3000);g=answerGame(g,g.board.exit,CHALLENGE_MS);
   expect(g.phase).toBe('over');expect(g.session.answers).toBe(0);
 });
 it('ne suspend que la correction même si un onglet manque les images',()=>{
   let g=tickGame(newGame('challenge',1,0),3000);g=answerGame(g,g.board.exit,4000);
   g=tickGame(g,4000+CORRECTION_MS+5000);expect(g.phase).toBe('answer');expect(g.session.remainingMs).toBe(CHALLENGE_MS-9000);
   g=tickGame(g,130000);expect(g.phase).toBe('over');expect(g.session.answers).toBe(1);
 });
 it('utilise une durée de correction identique pour une bonne et une mauvaise réponse',()=>{
   for(const correct of [true,false]){let g=tickGame(newGame('survival',1,0),3000);const wrong:Port={side:g.board.exit.side,index:(g.board.exit.index+1)%3};g=answerGame(g,correct?g.board.exit:wrong,4000);expect(tickGame(g,4000+CORRECTION_MS-1).phase).toBe('feedback');expect(tickGame(g,4000+CORRECTION_MS).phase).toBe('observe');}
 });
});
describe('records',()=>{
 it('distingue Survie et les records Défi par niveau',()=>{
   let p=emptyProgress();let r=finishSession(p,{...newSession('survival'),score:500});expect(r.firstRecord).toBe(true);p=r.progress;
   r=finishSession(p,{...newSession('challenge',2),score:800});p=r.progress;
   r=finishSession(p,{...newSession('challenge',1),score:300});p=r.progress;
   expect(p.survivalBest).toBe(500);expect(p.challengeBest).toEqual({'1':300,'2':800});expect(p.history).toHaveLength(3);
   expect(finishSession(p,{...newSession('survival'),score:500}).newRecord).toBe(false);
   expect(finishSession(p,{...newSession('survival'),score:501}).newRecord).toBe(true);
 });
});
describe('rejeu visuel et progression complète',()=>{
 it('déplace la balle à vitesse constante et tourne aux miroirs',()=>{
   const path=[{x:0,y:0},{x:2,y:0},{x:2,y:2}];
   expect(positionOnPath(path,-1)).toEqual(path[0]);
   expect(positionOnPath(path,.25)).toEqual({x:1,y:0});
   expect(positionOnPath(path,.5)).toEqual({x:2,y:0});
   expect(positionOnPath(path,.75)).toEqual({x:2,y:1});
   expect(positionOnPath(path,2)).toEqual(path[2]);
 });
 it('rejoue aussi une bonne réponse avant le verdict et refuse un second toucher',()=>{
   let g=tickGame(newGame('survival',1,0),3000);g=answerGame(g,g.board.exit,3500);
   expect(g.wasCorrect).toBe(true);expect(g.pointsEarned).toBe(150);
   const during=tickGame(g,3500+PATH_REPLAY_MS-1);expect(during.phase).toBe('feedback');
   expect(answerGame(during,g.board.exit,3500+PATH_REPLAY_MS).session.answers).toBe(1);
 });
 it('passe au plateau du niveau suivant après trois bonnes manches complètes',()=>{
   let now=0,g=newGame('survival',1,now);
   for(let i=0;i<3;i++){
     now+=3000;g=tickGame(g,now);g=answerGame(g,g.board.exit,now+500);
     expect(g.roundLevel).toBe(1);
     now+=500+CORRECTION_MS;g=tickGame(g,now);
   }
   expect(g.session.level).toBe(2);expect(g.roundLevel).toBe(2);expect(g.board.mirrors).toHaveLength(3);
   expect(g.session.levelCorrect).toBe(0);expect(g.session.score).toBe(450);
   now+=3000;g=tickGame(g,now);g=answerGame(g,g.board.exit,now+500);
   expect(g.pointsEarned).toBe(175);
 });
 it('augmente la récompense à chaque ajout de miroir ou agrandissement de grille',()=>{
   LEVELS.slice(1).forEach((_,i)=>expect(pointsFor(i+2,1000)).toBeGreaterThan(pointsFor(i+1,1000)));
   expect(CHALLENGE_MS).toBe(90000);
 });
 it('archive les records 120 s en conservant les progrès et sépare les nouveaux records 90 s',()=>{
   const data=new Map<string,string>();
   const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
   try{
     const old={...emptyProgress(),unlocked:5,tutorialDone:true,survivalBest:900,challengeBest:{'2':1000},challengeDurationMs:undefined,legacyChallengeBest:undefined};
     data.set(STORAGE_KEY,JSON.stringify(old));const migrated=loadProgress();
     expect(migrated.unlocked).toBe(5);expect(migrated.tutorialDone).toBe(true);expect(migrated.survivalBest).toBe(900);
     expect(migrated.challengeBest).toEqual({});expect(migrated.legacyChallengeBest).toEqual({'2':1000});
     const saved=finishSession(migrated,{...newSession('challenge',2),score:175});expect(saved.firstRecord).toBe(true);
     saveProgress(saved.progress);const reloaded=loadProgress();
     expect(reloaded.challengeBest).toEqual({'2':175});expect(reloaded.legacyChallengeBest).toEqual({'2':1000});
     expect(reloaded.history[0].durationMs).toBe(90000);
   }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
});
