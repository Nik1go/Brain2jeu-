import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Board } from './Board';
import { simulate } from '../game/engine';
import type { Board as BoardData } from '../game/engine';

const mirrors=[{row:1,col:1,slope:'/' as const}];
const entry={side:'left' as const,index:1};
const board:BoardData={size:3,mirrors,entry,...simulate(3,mirrors,entry)!};
describe('trajet affiché après chaque réponse',()=>{
  it.each([true,false])('garde le trajet complet au verdict, réponse correcte : %s',correct=>{
    const html=renderToStaticMarkup(<Board board={board} showMirrors showEntry interactive={false} onSelect={()=>{}} correct={correct} selected={correct?board.exit:{side:'bottom',index:1}} showPath={false} replayProgress={1} verdict/>);
    expect(html).toContain('aria-label="Trajet réel de la balle"');
    expect(html).toContain('stroke-dashoffset:0');
    expect(html).toContain('class="replay-ball"');
    expect(html).toContain(correct?'round-verdict correct':'round-verdict wrong');
  });
});
