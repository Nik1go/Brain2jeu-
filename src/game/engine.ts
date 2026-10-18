import { BOUNCE_PROFILES, sampleBounces } from './bounces';

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Port = { side: Side; index: number };
export type Mirror = { row: number; col: number; slope: '/' | '\\' };
export type Point = { x: number; y: number };
export type Board = { size: number; mirrors: Mirror[]; entry: Port; exit: Port; path: Point[]; hits: number };
export const LEVELS = [
  [3,2], [3,3], [4,3], [4,4], [4,5], [4,6], [5,6], [5,7],
  [5,8], [5,9], [5,10], [6,10], [6,11], [6,12], [6,13], [6,14], [6,15],
].map(([size, mirrors]) => ({ size, mirrors }));
export const MAX_LEVEL = LEVELS.length;
export const PROGRESSION_VERSION = 2;
export const OBSERVATION_MS = 3000;
export const PATH_REPLAY_MS = 500;
export const PATH_HOLD_MS = 450;
export const VERDICT_START_MS = PATH_REPLAY_MS + PATH_HOLD_MS;
export const VERDICT_MS = 650;
export const CORRECTION_MS = VERDICT_START_MS + VERDICT_MS;
export const CHALLENGE_MS = 90_000;
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
// Constant speed along the real route, including the turns at mirror centers.
export function positionOnPath(path: Point[], progress: number): Point {
  if (!path.length) return {x:0,y:0};
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.y-path[i].y));
  let remaining=lengths.reduce((sum,length)=>sum+length,0)*Math.max(0,Math.min(1,progress));
  for(let i=0;i<lengths.length;i++){
    if(remaining<=lengths[i]&&lengths[i]>0){const t=remaining/lengths[i];return {x:path[i].x+(path[i+1].x-path[i].x)*t,y:path[i].y+(path[i+1].y-path[i].y)*t};}
    remaining-=lengths[i];
  }
  return path[path.length-1];
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
  const index = Math.max(0, Math.min(MAX_LEVEL - 1, Math.floor(Number.isFinite(level) ? level : 1) - 1));
  const { size, mirrors: count } = LEVELS[index];
  // Draw exactly once: easier-to-generate routes must not bias the chosen difficulty.
  const targetHits = sampleBounces(BOUNCE_PROFILES[index], random);
  const ports: Port[] = (['top','right','bottom','left'] as Side[]).flatMap(side=>Array.from({length:size},(_,index)=>({side,index})));
  for (let attempt=0; attempt<64; attempt++) {
    const cells = Array.from({length:size*size},(_,i)=>i);
    // Partial Fisher-Yates: guaranteed unique cells, including with seeded random sources.
    const mirrors: Mirror[] = [];
    for (let i=0;i<count;i++) {
      const j=i+Math.floor(random()*(cells.length-i));
      [cells[i],cells[j]]=[cells[j],cells[i]];
      mirrors.push({row:Math.floor(cells[i]/size),col:cells[i]%size,slope:random()<.5?'/':'\\'});
    }
    const offset = Math.floor(random()*ports.length);
    for (let p=0;p<ports.length;p++) {
      const entry=ports[(p+offset)%ports.length];
      const result=simulate(size,mirrors,entry);
      if (result?.hits === targetHits) return { size, mirrors, entry, ...result };
    }
  }
  return fallbackBoard(size, count, targetHits, random);
}

// A finite constructive fallback also handles constant/degenerate random sources.
// The staircase makes exactly targetHits turns; extra mirrors stay off the entire travelled route.
function fallbackBoard(size: number, count: number, targetHits: number, random: () => number): Board {
  let entry: Port = { side: 'top', index: 0 };
  let mirrors: Mirror[] = Array.from({ length: targetHits }, (_, i) => ({ row: Math.floor(i / 2), col: Math.ceil(i / 2), slope: '\\' }));
  const route = simulate(size, mirrors, entry);
  if (!route || route.hits !== targetHits) throw new Error('Invalid fallback bounce route');
  const visited = new Set(route.path.map(point => `${point.y - .5}:${point.x - .5}`));
  const free = Array.from({ length: size * size }, (_, i) => i).filter(i => !visited.has(`${Math.floor(i / size)}:${i % size}`));
  if (count - targetHits > free.length) throw new Error('Not enough off-route cells for mirrors');
  for (let i = 0; i < count - targetHits; i++) {
    const j = i + Math.floor(random() * (free.length - i));
    [free[i], free[j]] = [free[j], free[i]];
    mirrors.push({ row: Math.floor(free[i] / size), col: free[i] % size, slope: random() < .5 ? '/' : '\\' });
  }
  const rotations = Math.floor(random() * 4);
  for (let i = 0; i < rotations; i++) {
    mirrors = mirrors.map(mirror => ({ row: mirror.col, col: size - 1 - mirror.row, slope: mirror.slope === '/' ? '\\' : '/' }));
    const sides: Side[] = ['top', 'right', 'bottom', 'left'];
    entry = { side: sides[(sides.indexOf(entry.side) + 1) % 4], index: entry.side === 'right' || entry.side === 'left' ? size - 1 - entry.index : entry.index };
  }
  const result = simulate(size, mirrors, entry);
  if (!result || result.hits !== targetHits) throw new Error('Invalid rotated fallback bounce route');
  return { size, mirrors, entry, ...result };
}
export type Mode = 'survival' | 'challenge';
export type Session = {
  mode: Mode; level: number; maxLevel: number; score: number; levelCorrect: number;
  consecutiveErrors: number; totalErrors: number; correct: number; answers: number;
  responseTotalMs: number; remainingMs: number; over: boolean;
};
export function newSession(mode: Mode, level=1): Session {
  const start=mode==='survival'?1:Math.max(1,Math.min(MAX_LEVEL,level));
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
  if (s.levelCorrect>=3) { s.level=Math.min(MAX_LEVEL,s.level+1); s.levelCorrect=0; }
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
  pointsEarned: number; roundLevel: number; pausedAt: number|null;
};
export function newGame(mode: Mode,level: number,now: number): Game {
  const session=newSession(mode,level);
  return {session,board:generateBoard(session.level),phase:'observe',phaseAt:now,lastAt:now,responseAt:0,selected:null,wasCorrect:false,pointsEarned:0,roundLevel:session.level,pausedAt:null};
}
export function tickGame(game: Game, now: number): Game {
  if (game.phase==='over'||game.pausedAt!==null) return game;
  if (game.phase==='feedback') {
    const correctionEnds=game.phaseAt+CORRECTION_MS;
    if(now<correctionEnds)return {...game,lastAt:now};
    if(game.session.over)return {...game,lastAt:now,phase:'over'};
    // A backgrounded tab may miss frames. Only the fixed correction duration is free.
    const session=elapse(game.session,Math.max(0,now-Math.max(game.lastAt,correctionEnds)));
    if(session.over)return {...game,session,lastAt:now,phase:'over'};
    const answering=now-correctionEnds>=OBSERVATION_MS;
    return {...game,session,board:generateBoard(session.level),phase:answering?'answer':'observe',phaseAt:answering?now:correctionEnds,lastAt:now,responseAt:answering?now:0,selected:null,pointsEarned:0,roundLevel:session.level};
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
  if (g.phase!=='answer'||g.pausedAt!==null) return g;
  const wasCorrect=samePort(port,g.board.exit);
  const session=recordAnswer(g.session,wasCorrect,now-g.responseAt);
  return {...g,session,phase:'feedback',phaseAt:now,selected:port,wasCorrect,pointsEarned:session.score-g.session.score};
}
export function pauseGame(game: Game, now: number): Game {
  if(game.pausedAt!==null||game.phase==='over')return game;
  const g=tickGame(game,now);
  return g.phase==='over'?g:{...g,pausedAt:now};
}
export function resumeGame(game: Game, now: number): Game {
  if(game.pausedAt===null)return game;
  const duration=Math.max(0,now-game.pausedAt);
  return {...game,pausedAt:null,phaseAt:game.phaseAt+duration,responseAt:game.responseAt>0?game.responseAt+duration:0,lastAt:now};
}
