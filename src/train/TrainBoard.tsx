import { useId, useMemo } from 'react';
import { TRAIN_COLORS } from './config';
import { JUNCTION_RADIUS, pathLength, positionOnRoute } from './network';
import type { Point, TrackPiece } from './network';
import type { MovingTrain, TrainGame } from './simulation';
import { controllableJunction } from './simulation';
import { junctionRail, railPath } from './rails';
import { stationFeedback } from './feedback';

function Rail({ pieces, active = false }: { pieces: TrackPiece[]; active?: boolean }) {
  const d = railPath(pieces);
  return <g className={active ? 'rail rail-active' : 'rail'}>
    <path d={d} className="rail-bed" />
    <path d={d} className="rail-sleepers" />
    <path d={d} className="rail-steel" />
    <path d={d} className="rail-center" />
  </g>;
}
function Tree({ x, y, size = 1, variant = 0 }: Point & { size?: number; variant?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <ellipse cy="8" rx="13" ry="10" fill="#365F4B" opacity=".10" />
    <path d="M0 3v13" stroke="#9B8A5F" strokeWidth="4" strokeLinecap="round" />
    {variant % 3 === 0 ? <><path d="M0-23 15 3H8l9 12h-34L-8 3h-7Z" fill="#709B70" /><path d="M0-23v35h-15l8-10h-7Z" fill="#80AA7C" /></> : <><ellipse cy="-6" rx="15" ry="18" fill={variant % 2 ? '#92B47F' : '#7AA77D'} /><ellipse cx="-4" cy="-10" rx="9" ry="12" fill="#B5CD94" opacity=".45" /><path d="M0-8V7" stroke="#D2DBAC" strokeWidth="1.5" opacity=".5" /></>}
  </g>;
}
function nearLine(p: Point, piece: TrackPiece) {
  const dx = piece.end.x - piece.start.x, dy = piece.end.y - piece.start.y;
  const t = Math.max(0, Math.min(1, ((p.x - piece.start.x) * dx + (p.y - piece.start.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - piece.start.x - t * dx, p.y - piece.start.y - t * dy);
}
export function TrainSprite({ train }: { train: MovingTrain }) {
  const color = TRAIN_COLORS.find(c => c.id === train.colorId)!;
  const position = positionOnRoute(train.pieces, train.distance);
  const wagon = positionOnRoute(train.pieces, Math.max(0, train.distance - 24));
  return <g className="moving-train" aria-label={`Train ${color.name}, symbole ${color.symbol}`}>
    {train.distance > 24 && <g transform={`translate(${wagon.x} ${wagon.y}) rotate(${wagon.angle})`}>
      <rect x="-10" y="-9" width="18" height="18" rx="5" fill="#334D48" opacity=".18" transform="translate(1 2)" />
      <path d="M-9-9H7M-9 9H7" stroke="#344E49" strokeWidth="3" />
      <rect x="-10" y="-8" width="18" height="16" rx="4" fill={color.color} stroke="#FDFDF0" strokeWidth="1.5" />
      <rect x="-6" y="-5" width="10" height="10" rx="2" fill="#FFF7E3" opacity=".4" />
    </g>}
    <g transform={`translate(${position.x} ${position.y}) rotate(${position.angle})`}>
      <rect x="-15" y="-10" width="30" height="20" rx="6" fill="#263E37" opacity=".2" transform="translate(1 2)" />
      <path d="M-12-10H9M-12 10H9" stroke="#344E49" strokeWidth="3" strokeLinecap="round" />
      <rect x="-15" y="-8.5" width="29" height="17" rx="5" fill={color.color} stroke="#FDFDF0" strokeWidth="1.5" />
      <path d="M11-6v12" stroke="#FFE9B4" strokeWidth="3" strokeLinecap="round" />
      <rect x="-11" y="-6" width="7" height="12" rx="2" fill="#274E54" />
      <path d="M-10-4h4" stroke="#CFEBDE" strokeWidth="2" strokeLinecap="round" />
      <g transform={`rotate(${-position.angle})`}><text x="3" y="4" textAnchor="middle" fill={color.ink} fontSize="12" fontWeight="800">{color.symbol}</text></g>
    </g>
  </g>;
}
export function TrainBoard({ game, onToggle, highlight, interactive = true }: { game: TrainGame; onToggle: (id: number) => void; highlight?: number; interactive?: boolean }) {
  const { network } = game;
  const railId = useId();
  const occupiedJunctions = new Set(game.trains.map(train => controllableJunction(network, train)).filter(id => id !== undefined));
  const scenery = useMemo(() => {
    let seed = network.scenerySeed + 1;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const pieces = [...network.root.pieces, ...network.junctions.flatMap(j => [...j.straight.pieces, ...j.turn.pieces])];
    const trees: (Point & { size: number; variant: number })[] = [];
    for (let i = 0; i < 190 && trees.length < 47; i++) {
      const p = { x: 17 + random() * 326, y: 29 + random() * 571 };
      if (pieces.some(piece => nearLine(p, piece) < 29) || network.stations.some(s => Math.hypot(p.x - s.point.x, p.y - s.point.y) < 45) || trees.some(t => Math.hypot(p.x - t.x, p.y - t.y) < 30)) continue;
      trees.push({ ...p, size: .65 + random() * .45, variant: i });
    }
    return trees;
  }, [network]);
  return <div className="train-board" data-paused={game.paused}>
    <svg viewBox={`0 0 ${network.width} ${network.height}`} className="train-map" role="img" aria-label={`Réseau forestier, ${network.stations.length} gares, entrée ${network.entryZone}`}>
      <defs>
        <radialGradient id="forest-light"><stop stopColor="#E8EED3" /><stop offset="1" stopColor="#CCDDBB" /></radialGradient>
        <pattern id="forest-grain" width="27" height="29" patternUnits="userSpaceOnUse"><circle cx="4" cy="8" r="1" fill="#9EB78B" opacity=".25" /><path d="m18 23 1-3 2 3" stroke="#A0B98D" opacity=".35" fill="none" /></pattern>
        <mask id={`${railId}-outside-junctions`} maskUnits="userSpaceOnUse" x="0" y="0" width={network.width} height={network.height}>
          <rect width={network.width} height={network.height} fill="white" />
          {network.junctions.map(j => <circle key={j.id} cx={j.point.x} cy={j.point.y} r={JUNCTION_RADIUS - 1} fill="black" />)}
        </mask>
        {network.junctions.map(j => <clipPath key={j.id} id={`${railId}-junction-${j.id}`}><circle cx={j.point.x} cy={j.point.y} r={JUNCTION_RADIUS} /></clipPath>)}
      </defs>
      <rect width="360" height="620" fill="url(#forest-light)" />
      <path d="M-30 410Q70 440 143 365T387 310" stroke="#BACFA7" strokeWidth="77" fill="none" opacity=".27" />
      <path d="M-20 40Q108 6 165 60T380 111" stroke="#F4F0CF" strokeWidth="24" fill="none" opacity=".28" />
      <rect width="360" height="620" fill="url(#forest-grain)" />
      <g aria-hidden="true">{scenery.map((p, i) => <Tree key={i} {...p} />)}</g>
      <g aria-hidden="true">
        {network.junctions.map(j => <circle key={j.id} className={`junction-disc${occupiedJunctions.has(j.id) ? ' junction-occupied' : ''}`} data-junction={j.id} data-occupied={occupiedJunctions.has(j.id)} cx={j.point.x} cy={j.point.y} r={JUNCTION_RADIUS} />)}
        <g mask={`url(#${railId}-outside-junctions)`}>
          <Rail pieces={network.root.pieces} />
          {network.junctions.map(j => <g key={j.id}><Rail pieces={j.straight.pieces} /><Rail pieces={j.turn.pieces} /></g>)}
        </g>
        {network.junctions.map(j => <g key={j.id}>
          <g clipPath={`url(#${railId}-junction-${j.id})`}>
            <path className="junction-idle-route" d={railPath(junctionRail(game.switches[j.id] ? j.straight : j.turn))} />
            <Rail pieces={junctionRail(game.switches[j.id] ? j.turn : j.straight)} active />
          </g>
        </g>)}
      </g>
      {network.stations.map(station => {
        const feedback = stationFeedback(game, station.id), failed = feedback && !feedback.correct;
        return <g key={station.id} transform={`translate(${station.point.x} ${station.point.y})`} aria-label={`Gare ${station.color.name}, symbole ${station.color.symbol}`} className={`train-station ${feedback ? feedback.correct ? 'delivery-good' : 'delivery-bad' : ''}`}>
          {feedback?.correct && <g key={`feedback-${feedback.trainId}`} className="station-feedback" aria-hidden="true"><circle r="31" fill="#EFFAE1" stroke="#487F57" strokeWidth="2" /><text y="-32" textAnchor="middle" fill="#356546" fontSize="20" fontWeight="800">✓</text></g>}
          <g>
            <g transform={`rotate(${station.angle})`}>
              <rect x="-24" y="-25" width="48" height="50" rx="9" fill="#B3BFA0" opacity=".5" transform="translate(2 3)" />
              <rect x="-23" y="-24" width="46" height="48" rx="8" fill="#F2EAD1" stroke="#C9C3A8" />
              <path d="M-17-18h34M-17 18h34" stroke="#D3C4A2" strokeWidth="2" />
              <rect x="-19" y="-14" width="38" height="28" rx="4" fill={station.color.color} stroke="#334B3B" strokeWidth="1.5" />
              <path d="M-19-1h38" stroke="#FFFAE6" strokeOpacity=".3" strokeWidth="2" />
              <path d="M21-9v18" stroke={station.color.color} strokeWidth="3" strokeLinecap="round" />
            </g>
            <circle r="10" fill={station.color.color} />
            <text y="5" textAnchor="middle" fill={station.color.ink} fontSize="17" fontWeight="800">{station.color.symbol}</text>
          </g>
          {failed && <g transform="translate(21 -23)" aria-hidden="true"><g key={feedback.trainId} className="station-error-badge" fill="none" strokeLinecap="round"><path d="m-6-6 12 12m0-12-12 12" stroke="#FFF9EC" strokeWidth="6.5" /><path d="m-6-6 12 12m0-12-12 12" stroke="#BA3529" strokeWidth="3.5" /></g></g>}
        </g>;
      })}
      <g aria-hidden="true">{game.trains.map(train => <TrainSprite key={train.id} train={train} />)}</g>
    </svg>
    {network.junctions.map(j => <button key={j.id} type="button" className={`junction-touch ${highlight === j.id ? 'tutorial-highlight' : ''}`} data-occupied={occupiedJunctions.has(j.id)} style={{ left: `${j.point.x / network.width * 100}%`, top: `${j.point.y / network.height * 100}%`, width: `${56 / network.width * 100}%`, height: `${56 / network.height * 100}%` }} aria-label={`Aiguillage ${j.id + 1}, ${game.switches[j.id] ? `virage à ${j.turnSide === 'left' ? 'gauche' : 'droite'}` : 'tout droit'}${occupiedJunctions.has(j.id) ? ', train dans le cercle' : ''}`} aria-pressed={game.switches[j.id]} disabled={!interactive || game.over || game.paused} onClick={() => onToggle(j.id)} />)}
  </div>;
}

// Useful in the tutorial: park a train just before it enters the first module.
export const tutorialDistance = (game: TrainGame) => pathLength(game.network.root.pieces) - 50;
