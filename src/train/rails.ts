import { JUNCTION_RADIUS, RAIL_RADIUS, line, piecePosition, splitPath } from './network';
import type { Route, TrackPiece } from './network';

/** Connected pieces share a single SVG subpath, so joins never get rounded end caps. */
export function railPath(pieces: TrackPiece[]): string {
  return pieces.map((piece, i) => {
    const previous = pieces[i - 1];
    const connected = previous && Math.hypot(previous.end.x - piece.start.x, previous.end.y - piece.start.y) < .001;
    const move = connected ? '' : `M${piece.start.x},${piece.start.y}`;
    return move + (piece.control
      ? `C${piece.control.x},${piece.control.y} ${piece.control2!.x},${piece.control2!.y} ${piece.end.x},${piece.end.y}`
      : `L${piece.end.x},${piece.end.y}`);
  }).join(' ');
}

/** Extend beyond the selector's clipping edge, including the whole width of the track. */
export function junctionRail(route: Route): TrackPiece[] {
  const first = route.pieces[0], angle = piecePosition(first, 0).angle * Math.PI / 180;
  const extension = JUNCTION_RADIUS + 9 - RAIL_RADIUS;
  return [line({ x: first.start.x - Math.cos(angle) * extension, y: first.start.y - Math.sin(angle) * extension }, first.start),
    ...splitPath(route.pieces, first.length + extension).before];
}
