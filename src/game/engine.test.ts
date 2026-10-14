import { describe, expect, it } from 'vitest';
import { answerGame, CHALLENGE_MS, CORRECTION_MS, elapse, generateBoard, LEVELS, newGame, newSession, pointsFor, recordAnswer, reflect, simulate, tickGame } from './engine';
import type { Direction, Mirror, Port } from './engine';
import { emptyProgress, finishSession } from '../platform/storage';

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
 it('génère des plateaux valides et des parcours plus longs aux niveaux avancés',()=>{
   let seed=123456;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   LEVELS.forEach((config,i)=>{for(let trial=0;trial<30;trial++){
     const b=generateBoard(i+1,random);expect(b.size).toBe(config.size);expect(b.mirrors).toHaveLength(config.mirrors);
     expect(new Set(b.mirrors.map(m=>`${m.row}:${m.col}`)).size).toBe(config.mirrors);
     expect(b.hits).toBeGreaterThanOrEqual(Math.min(config.mirrors,1+Math.floor(i/4)));
     expect(simulate(b.size,b.mirrors,b.entry)?.exit).toEqual(b.exit);
   }});
 });
});
describe('survie',()=>{
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
   const high=recordAnswer({...newSession('survival'),level:18,maxLevel:18,levelCorrect:2},true,0);expect(high.level).toBe(18);expect(high.levelCorrect).toBe(0);
   const end={...high,over:true};expect(recordAnswer(end,true,0)).toBe(end);
 });
});
describe('score et Défi',()=>{
 it('applique le bonus par secondes entières et le borne à zéro',()=>{
   expect(pointsFor(1,0)).toBe(150);expect(pointsFor(2,1999)).toBe(170);expect(pointsFor(18,25000)).toBe(525);expect(pointsFor(1,10000)).toBe(100);
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
   let g=newGame('challenge',2,0);g=tickGame(g,3000);g=answerGame(g,g.board.exit,4500);expect(g.session.remainingMs).toBe(115500);
   g=tickGame(g,4500+CORRECTION_MS);expect(g.phase).toBe('observe');expect(g.session.remainingMs).toBe(115500);
   g=tickGame(g,4500+CORRECTION_MS+1000);expect(g.session.remainingMs).toBe(114500);
 });
 it('ignore un toucher au moment où le chronomètre expire',()=>{
   let g=newGame('challenge',1,0);g=tickGame(g,3000);g=answerGame(g,g.board.exit,CHALLENGE_MS);
   expect(g.phase).toBe('over');expect(g.session.answers).toBe(0);
 });
 it('ne suspend que 1250 ms même si un onglet manque les images de correction',()=>{
   let g=tickGame(newGame('challenge',1,0),3000);g=answerGame(g,g.board.exit,4000);
   g=tickGame(g,10250);expect(g.phase).toBe('answer');expect(g.session.remainingMs).toBe(111000);
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
