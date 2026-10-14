export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Port = { side: Side; index: number };
export type Mirror = { row: number; col: number; slope: '/' | '\\' };
export type Point = { x: number; y: number };
export type Board = { size: number; mirrors: Mirror[]; entry: Port; exit: Port; path: Point[]; hits: number };
export const LEVELS = [
  [3,1], [3,2], [3,3], [4,3], [4,4], [4,5], [4,6], [5,6], [5,7],
  [5,8], [5,9], [5,10], [6,10], [6,11], [6,12], [6,13], [6,14], [6,15],
].map(([size, mirrors]) => ({ size, mirrors }));
export const OBSERVATION_MS = 3000;
export const CORRECTION_MS = 1250;
export const CHALLENGE_MS = 120_000;
export const samePort = (a: Port, b: Port) => a.side === b.side && a.index === b.index;
export const reflect = (direction: Direction, slope: Mirror['slope']): Direction => {
  const map: Record<Mirror['slope'], Record<Direction, Direction>> = {
    '/': { up: 'right', right: 'up', down: 'left', left: 'down' },
    '\\': { up: 'left', left: 'up', down: 'right', right: 'down' },
  };
  return map[slope][direction];
};
export function portPoint(port: Port, size: number): Point {
  const v = port.index + .5;
  return port.side === 'top' ? { x:v,y:-.25 } : port.side === 'bottom' ? { x:v,y:size+.25 } : port.side === 'left' ? { x:-.25,y:v } : { x:size+.25,y:v };
}
export function simulate(size: number, mirrors: Mirror[], entry: Port): { exit: Port; path: Point[]; hits: number } | null {
  let row = entry.side === 'top' ? 0 : entry.side === 'bottom' ? size-1 : entry.index;
  let col = entry.side === 'left' ? 0 : entry.side === 'right' ? size-1 : entry.index;
  let direction: Direction = { top:'down', bottom:'up', left:'right', right:'left' }[entry.side] as Direction;
  const seen = new Set<string>();
  const path = [portPoint(entry,size)];
  let hits = 0;
  while (row >= 0 && row < size && col >= 0 && col < size) {
    const key = `${row},${col},${direction}`;
    if (seen.has(key)) return null;
    seen.add(key);
    path.push({ x:col+.5,y:row+.5 });
    const mirror = mirrors.find(m => m.row === row && m.col === col);
    if (mirror) { direction = reflect(direction,mirror.slope); hits++; }
    if (direction === 'up') row--;
    if (direction === 'down') row++;
    if (direction === 'left') col--;
    if (direction === 'right') col++;
  }
  const exit: Port = row < 0 ? {side:'top',index:col} : row >= size ? {side:'bottom',index:col} : col < 0 ? {side:'left',index:row} : {side:'right',index:row};
  path.push(portPoint(exit,size));
  return { exit, path, hits };
}
export function generateBoard(level: number, random: () => number = Math.random): Board {
  const { size, mirrors: count } = LEVELS[Math.max(0,Math.min(17,level-1))];
  const targetHits = Math.min(count,1+Math.floor((level-1)/4));
  let best: Board | undefined;
  for (let attempt=0; attempt<600; attempt++) {
    const cells = Array.from({length:size*size},(_,i)=>i);
    // Partial Fisher-Yates: guaranteed unique cells, including with seeded random sources.
    const mirrors: Mirror[] = [];
    for (let i=0;i<count;i++) {
      const j=i+Math.floor(random()*(cells.length-i));
      [cells[i],cells[j]]=[cells[j],cells[i]];
      mirrors.push({row:Math.floor(cells[i]/size),col:cells[i]%size,slope:random()<.5?'/':'\\'});
    }
    const ports: Port[] = (['top','right','bottom','left'] as Side[]).flatMap(side=>Array.from({length:size},(_,index)=>({side,index})));
    const offset = Math.floor(random()*ports.length);
    for (let p=0;p<ports.length;p++) {
      const entry=ports[(p+offset)%ports.length];
      const result=simulate(size,mirrors,entry);
      if (!result || result.hits < 1) continue;
      const candidate={size,mirrors,entry,...result};
      if (!best || candidate.hits>best.hits) best=candidate;
      if (result.hits>=targetHits) return candidate;
    }
  }
  if (best) return best;
  throw new Error('Impossible de générer un plateau valide.');
}
export type Mode = 'survival' | 'challenge';
export type Session = {
  mode: Mode; level: number; maxLevel: number; score: number; levelCorrect: number;
  consecutiveErrors: number; totalErrors: number; correct: number; answers: number;
  responseTotalMs: number; remainingMs: number; over: boolean;
};
export function newSession(mode: Mode, level=1): Session {
  const start=mode==='survival'?1:Math.max(1,Math.min(18,level));
  return {mode,level:start,maxLevel:start,score:0,levelCorrect:0,consecutiveErrors:0,totalErrors:0,correct:0,answers:0,responseTotalMs:0,remainingMs:CHALLENGE_MS,over:false};
}
export function pointsFor(level: number, responseMs: number) {
  return 100+25*(level-1)+Math.max(0,50-5*Math.floor(Math.max(0,responseMs)/1000));
}
export function recordAnswer(session: Session, correct: boolean, responseMs: number): Session {
  if (session.over) return session;
  const s={...session, answers:session.answers+1,responseTotalMs:session.responseTotalMs+Math.max(0,responseMs)};
  if (correct) { s.correct++; s.score+=pointsFor(s.level,responseMs); s.consecutiveErrors=0; s.levelCorrect++; }
  else { s.totalErrors++; s.consecutiveErrors++; }
  if (s.mode==='challenge') return s;
  if (s.totalErrors>=3) return {...s,over:true};
  if (s.levelCorrect>=3) { s.level=Math.min(18,s.level+1); s.levelCorrect=0; }
  else if (s.consecutiveErrors>=2) { s.level=Math.max(1,s.level-1); s.levelCorrect=0; s.consecutiveErrors=0; }
  s.maxLevel=Math.max(s.maxLevel,s.level);
  return s;
}
export function elapse(session: Session, deltaMs: number): Session {
  if (session.mode!=='challenge' || session.over) return session;
  const remainingMs=Math.max(0,session.remainingMs-Math.max(0,deltaMs));
  return {...session,remainingMs,over:remainingMs===0};
}
export type Game = {
  session: Session; board: Board; phase: 'observe'|'answer'|'feedback'|'over';
  phaseAt: number; lastAt: number; responseAt: number; selected: Port|null; wasCorrect: boolean;
};
export function newGame(mode: Mode,level: number,now: number): Game {
  const session=newSession(mode,level);
  return {session,board:generateBoard(session.level),phase:'observe',phaseAt:now,lastAt:now,responseAt:0,selected:null,wasCorrect:false};
}
export function tickGame(game: Game, now: number): Game {
  if (game.phase==='over') return game;
  if (game.phase==='feedback') {
    const correctionEnds=game.phaseAt+CORRECTION_MS;
    if(now<correctionEnds)return {...game,lastAt:now};
    if(game.session.over)return {...game,lastAt:now,phase:'over'};
    // A backgrounded tab may miss frames. Only the fixed correction duration is free.
    const session=elapse(game.session,Math.max(0,now-Math.max(game.lastAt,correctionEnds)));
    if(session.over)return {...game,session,lastAt:now,phase:'over'};
    const answering=now-correctionEnds>=OBSERVATION_MS;
    return {...game,session,board:generateBoard(session.level),phase:answering?'answer':'observe',phaseAt:answering?now:correctionEnds,lastAt:now,responseAt:answering?now:0,selected:null};
  }
  const delta=Math.max(0,now-game.lastAt);
  const session=elapse(game.session,delta);
  const g={...game,session,lastAt:now};
  if (session.over) return {...g,phase:'over'};
  if (g.phase==='observe' && now-g.phaseAt>=OBSERVATION_MS) return {...g,phase:'answer',phaseAt:now,responseAt:now};
  return g;
}
export function answerGame(game: Game, port: Port, now: number): Game {
  const g=tickGame(game,now);
  if (g.phase!=='answer') return g;
  const wasCorrect=samePort(port,g.board.exit);
  return {...g,session:recordAnswer(g.session,wasCorrect,now-g.responseAt),phase:'feedback',phaseAt:now,selected:port,wasCorrect};
}
