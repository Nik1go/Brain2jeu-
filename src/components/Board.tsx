import type { Board as BoardData, Port, Side } from '../game/engine';
import { Check, X } from 'lucide-react';
import { samePort, portPoint, positionOnPath } from '../game/engine';
type Props={board:BoardData;showMirrors:boolean;showEntry:boolean;interactive:boolean;onSelect:(p:Port)=>void;correct?:boolean;selected?:Port|null;showPath?:boolean;hint?:Port;replayProgress?:number;verdict?:boolean;};
const sideNames={top:'haut',bottom:'bas',left:'gauche',right:'droite'};
export function Board({board,showMirrors,showEntry,interactive,onSelect,correct,selected,showPath,hint,replayProgress,verdict}:Props) {
  const {size}=board;
  const ports:Port[]=(['top','right','bottom','left'] as Side[]).flatMap(side=>Array.from({length:size},(_,index)=>({side,index})));
  const point=(p:{x:number;y:number})=>`${(p.x+1)/(size+2)*100},${(p.y+1)/(size+2)*100}`;
  const movingBall=replayProgress===undefined?null:positionOnPath(board.path,replayProgress);
  // A replay always reveals its path, regardless of the answer or showPath hint.
  const pathVisible=showPath||replayProgress!==undefined;
  return <div className={`board-wrap ${showMirrors&&!pathVisible?'observing':''}`}>
    <svg viewBox="0 0 100 100" className="board-svg" aria-label={`Plateau de ${size} par ${size}`}>
      <defs><linearGradient id="board-bg" x2="1" y2="1"><stop stopColor="#FFFEFF"/><stop offset="1" stopColor="#F7F2FF"/></linearGradient><linearGradient id="mirror-line" x2="1" y2="1"><stop stopColor="#C7ACFF"/><stop offset="1" stopColor="#8053DD"/></linearGradient><radialGradient id="game-ball" cx=".3" cy=".25"><stop stopColor="#FFF3BF"/><stop offset=".45" stopColor="#FFC766"/><stop offset="1" stopColor="#F39D38"/></radialGradient></defs>
      <rect x={100/(size+2)} y={100/(size+2)} width={size*100/(size+2)} height={size*100/(size+2)} rx="1.7" fill="url(#board-bg)" stroke="#DCD0EF" strokeWidth=".4"/>
      {Array.from({length:size-1},(_,i)=><g key={i} stroke="#E1D6F2" strokeWidth=".3"><path d={`M${(i+2)*100/(size+2)} ${100/(size+2)}v${size*100/(size+2)}`}/><path d={`M${100/(size+2)} ${(i+2)*100/(size+2)}h${size*100/(size+2)}`}/></g>)}
      {showMirrors&&board.mirrors.map(m=>{
        const u=100/(size+2),x=(m.col+1.5)*u,y=(m.row+1.5)*u,d=u*.27;
        const path=`M${x-d} ${m.slope==='/'?y+d:y-d}L${x+d} ${m.slope==='/'?y-d:y+d}`;
        return <g key={`${m.row}-${m.col}`} className="mirror"><path d={path} stroke="#7548BF" strokeWidth="2.2" strokeLinecap="round"/><path d={path} stroke="#BC93EB" strokeWidth="1.1" strokeLinecap="round"/></g>;
      })}
      {pathVisible&&<polyline aria-label="Trajet réel de la balle" role="img" className={`correction-path ${replayProgress!==undefined?'replaying':''}`} points={board.path.map(point).join(' ')} fill="none" stroke="#9971C7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" style={replayProgress===undefined?undefined:{strokeDasharray:1,strokeDashoffset:1-replayProgress}}/>}
      {movingBall&&<circle className="replay-ball" cx={(movingBall.x+1)*100/(size+2)} cy={(movingBall.y+1)*100/(size+2)} r={size>4?2:2.7} fill="url(#game-ball)" stroke="#ED9C3E" strokeWidth=".3"/>}
      {showEntry&&replayProgress===undefined&&(()=>{const p=portPoint(board.entry,size);const x=(p.x+1)*100/(size+2),y=(p.y+1)*100/(size+2);return <g className="ball"><circle cx={x} cy={y} r={size>4?2:2.7} fill="url(#game-ball)" stroke="#ED9C3E" strokeWidth=".3"/><path d="M-1.7-1.2 0 0-1.7 1.2M-3 0H0" transform={`translate(${x+(board.entry.side==='left'?5:board.entry.side==='right'?-5:0)} ${y+(board.entry.side==='top'?5:board.entry.side==='bottom'?-5:0)}) rotate(${{left:0,top:90,right:180,bottom:270}[board.entry.side]})`} stroke="#D98C35" strokeWidth=".65" strokeLinecap="round" strokeLinejoin="round"/></g>})()}
    </svg>
    {ports.map(port=>{
      const p=portPoint(port,size),isEntry=showEntry&&samePort(port,board.entry);
      const chosen=selected&&samePort(selected,port),exit=selected&&samePort(board.exit,port);
      const state=exit?'is-correct':chosen&&correct===false?'is-wrong':'';
      return <button key={`${port.side}-${port.index}`} className={`port ${state} ${hint&&samePort(port,hint)?'is-hint':''} ${isEntry?'is-entry':''}`} style={{left:`${(p.x+1)*100/(size+2)}%`,top:`${(p.y+1)*100/(size+2)}%`}} onClick={()=>onSelect(port)} disabled={!interactive} aria-label={`Sortie ${sideNames[port.side]}, ${port.index+1}`}><span>{exit?<Check size={13} strokeWidth={3}/>:chosen&&correct===false?<X size={13} strokeWidth={3}/>:null}</span></button>;
    })}
    {verdict&&<div className={`round-verdict ${correct?'correct':'wrong'}`} role="status" aria-label={correct?'Bonne réponse':'Mauvaise réponse'}>{correct?<Check size={32} strokeWidth={3}/>:<X size={32} strokeWidth={3}/>}</div>}
  </div>;
}
