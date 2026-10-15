import { levelConfig, shuffle, TRAIN_COLORS } from './config';
import type { Random, TrainColor } from './config';

export interface Point { x: number; y: number }
export type EntryZone = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const ENTRY_ZONES: EntryZone[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export type Target = { kind: 'switch'; id: number } | { kind: 'station'; id: number };
export interface TrackPiece { start: Point; end: Point; control?: Point; length: number }
export interface Route { pieces: TrackPiece[]; next: Target }
export interface Junction {
  id: number; point: Point; turnSide: 'left' | 'right';
  straight: Route; turn: Route;
}
export interface Station { id: number; point: Point; color: TrainColor; angle: number }
export interface Network {
  width: number; height: number; level: number; entryZone: EntryZone;
  root: Route; junctions: Junction[]; stations: Station[];
  longestDistance: number; signature: string; scenerySeed: number;
}
const WIDTH = 360, HEIGHT = 620, RADIUS = 18;
const line = (start: Point, end: Point): TrackPiece => ({ start, end, length: Math.hypot(end.x - start.x, end.y - start.y) });
// Quarter circles are represented by their corner; rendering and motion use the same geometry.
const curve = (start: Point, control: Point, end: Point): TrackPiece => ({ start, end, control, length: Math.PI * RADIUS / 2 });
export const pathLength = (pieces: TrackPiece[]) => pieces.reduce((sum, p) => sum + p.length, 0);

export function piecePosition(piece: TrackPiece, fraction: number): Point & { angle: number } {
  const t = Math.min(1, Math.max(0, fraction));
  if (!piece.control) return { x: piece.start.x + (piece.end.x - piece.start.x) * t, y: piece.start.y + (piece.end.y - piece.start.y) * t, angle: Math.atan2(piece.end.y - piece.start.y, piece.end.x - piece.start.x) * 180 / Math.PI };
  const center = { x: piece.start.x + piece.end.x - piece.control.x, y: piece.start.y + piece.end.y - piece.control.y };
  const a = Math.atan2(piece.start.y - center.y, piece.start.x - center.x);
  let delta = Math.atan2(piece.end.y - center.y, piece.end.x - center.x) - a;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  const theta = a + delta * t;
  return { x: center.x + RADIUS * Math.cos(theta), y: center.y + RADIUS * Math.sin(theta), angle: (theta + Math.sign(delta) * Math.PI / 2) * 180 / Math.PI };
}
export function positionOnRoute(pieces: TrackPiece[], distance: number) {
  let remaining = Math.max(0, distance);
  for (const piece of pieces) {
    if (remaining <= piece.length) return piecePosition(piece, remaining / piece.length);
    remaining -= piece.length;
  }
  return piecePosition(pieces[pieces.length - 1], 1);
}
export function piecePath(piece: TrackPiece): string {
  if (!piece.control) return `M${piece.start.x},${piece.start.y}L${piece.end.x},${piece.end.y}`;
  const a = { x: piece.control.x - piece.start.x, y: piece.control.y - piece.start.y };
  const b = { x: piece.end.x - piece.control.x, y: piece.end.y - piece.control.y };
  return `M${piece.start.x},${piece.start.y}A${RADIUS},${RADIUS} 0 0 ${a.x * b.y - a.y * b.x > 0 ? 1 : 0} ${piece.end.x},${piece.end.y}`;
}

/** A planar comb tree: every fork has a straight continuation and ONE 90° siding.
 * The vertical lanes never merge. Reflection preserves topology, lengths and difficulty.
 * Jitter is bounded, so even eleven stations retain separated touch targets and sidings.
 */
export function generateNetwork(level: number, options: { random?: Random; entryZone?: EntryZone; previousSignature?: string } = {}): Network {
  const random = options.random ?? Math.random;
  const count = levelConfig(level).stations, forks = count - 1;
  const entryZone = options.entryZone ?? ENTRY_ZONES[Math.floor(random() * ENTRY_ZONES.length)];
  const flipX = entryZone.endsWith('right'), flipY = entryZone.startsWith('bottom');
  const transform = (p: Point): Point => ({ x: flipX ? WIDTH - p.x : p.x, y: flipY ? HEIGHT - p.y : p.y });
  const transformPiece = (p: TrackPiece): TrackPiece => ({ ...p, start: transform(p.start), end: transform(p.end), control: p.control ? transform(p.control) : undefined });
  const trunkX = 64 + random() * 14;
  const dense = count > 9;
  const first = dense ? 64 : 90;
  const last = dense ? 554 : 496;
  const nodes = Array.from({ length: forks }, (_, i) => ({ x: trunkX, y: first + (last - first) * i / Math.max(1, forks - 1) + (random() - .5) * 3 }));
  let colors = shuffle(TRAIN_COLORS.slice(0, count), random);
  const stationPoints = [...nodes.map(p => ({ x: 238 + random() * 62, y: p.y })), { x: trunkX, y: (dense ? 590 : 567) + random() * 4 }];
  // Also change the position/color association, even if geometry or entry changed.
  let previousColors: string[] | undefined;
  try { previousColors = options.previousSignature ? JSON.parse(options.previousSignature)[3] : undefined; } catch { /* An obsolete signature is harmless. */ }
  if (colors.map(c => c.id).join('|') === previousColors?.join('|')) colors = [...colors.slice(1), colors[0]];
  // Even a constant RNG cannot reproduce the last configuration on a replay.
  const signatureFor = () => JSON.stringify([entryZone, nodes, stationPoints, colors.map(c => c.id)]);
  const signature = signatureFor();
  const stations = stationPoints.map((p, id): Station => ({ id, point: transform(p), color: colors[id], angle: id === forks ? (flipY ? -90 : 90) : (flipX ? 180 : 0) }));
  const junctions = nodes.map((p, id): Junction => {
    const incoming = { x: p.x, y: p.y - RADIUS };
    const straightEnd = { x: p.x, y: p.y + RADIUS };
    const turnEnd = { x: p.x + RADIUS, y: p.y };
    const next = nodes[id + 1];
    const straight: Route = {
      pieces: [line(incoming, straightEnd), line(straightEnd, next ? { x: next.x, y: next.y - RADIUS } : stationPoints[forks])].map(transformPiece),
      next: next ? { kind: 'switch', id: id + 1 } : { kind: 'station', id: forks },
    };
    const turn: Route = {
      pieces: [curve(incoming, { x: p.x, y: p.y }, turnEnd), line(turnEnd, stationPoints[id])].map(transformPiece),
      next: { kind: 'station', id },
    };
    return { id, point: transform(p), turnSide: flipX !== flipY ? 'right' : 'left', straight, turn };
  });
  const root: Route = { pieces: [transformPiece(line({ x: trunkX, y: -24 }, { x: trunkX, y: nodes[0].y - RADIUS }))], next: { kind: 'switch', id: 0 } };
  const longest = (route: Route): number => pathLength(route.pieces) + (route.next.kind === 'station' ? 0 : Math.max(longest(junctions[route.next.id].straight), longest(junctions[route.next.id].turn)));
  return { width: WIDTH, height: HEIGHT, level, entryZone, root, junctions, stations, longestDistance: longest(root), signature, scenerySeed: Math.floor(random() * 1_000_000) };
}

export function destination(network: Network, switches: boolean[]): Station {
  let next = network.root.next;
  while (next.kind === 'switch') next = (switches[next.id] ? network.junctions[next.id].turn : network.junctions[next.id].straight).next;
  return network.stations[next.id];
}
