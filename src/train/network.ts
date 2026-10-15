import { levelConfig, shuffle, TRAIN_COLORS } from './config';
import type { Random, TrainColor } from './config';
export interface Point { x: number; y: number }
export type EntryZone = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const ENTRY_ZONES: EntryZone[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export type Target = { kind: 'switch'; id: number } | { kind: 'station'; id: number };
export interface TrackPiece { start: Point; end: Point; control?: Point; control2?: Point; length: number; samples?: number[] }
export interface Route { pieces: TrackPiece[]; next: Target }
export interface Junction { id: number; point: Point; turnSide: 'left' | 'right'; straight: Route; turn: Route }
export interface Station { id: number; point: Point; color: TrainColor; angle: number }
export interface Network {
  width: number; height: number; level: number; entryZone: EntryZone;
  root: Route; junctions: Junction[]; stations: Station[]; longestDistance: number;
  signature: string; layoutKey: string; scenerySeed: number;
}
export const JUNCTION_RADIUS = 25;
export const RAIL_RADIUS = 18;
const WIDTH = 360, HEIGHT = 620;
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const offset = (p: Point, d: Point, amount: number): Point => ({ x: p.x + d.x * amount, y: p.y + d.y * amount });
export const line = (start: Point, end: Point): TrackPiece => ({ start, end, length: Math.hypot(end.x - start.x, end.y - start.y) });
function bezier(p: TrackPiece, t: number): Point {
  const a = lerp(p.start, p.control!, t), b = lerp(p.control!, p.control2!, t), c = lerp(p.control2!, p.end, t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
}
export function curve(start: Point, control: Point, control2: Point, end: Point): TrackPiece {
  const p: TrackPiece = { start, end, control, control2, length: 0, samples: [0] };
  let previous = start;
  for (let i = 1; i <= 32; i++) { const point = bezier(p, i / 32); p.length += Math.hypot(point.x - previous.x, point.y - previous.y); p.samples!.push(p.length); previous = point; }
  return p;
}
function parameterAt(p: TrackPiece, fraction: number) {
  const f = Math.max(0, Math.min(1, fraction));
  if (!p.samples || !p.length) return f;
  const distance = f * p.length;
  const index = Math.min(31, Math.max(0, p.samples.findIndex((length, i) => i > 0 && length >= distance) - 1));
  return (index + (distance - p.samples[index]) / (p.samples[index + 1] - p.samples[index] || 1)) / 32;
}
export const pathLength = (pieces: TrackPiece[]) => pieces.reduce((sum, p) => sum + p.length, 0);
export function piecePosition(p: TrackPiece, fraction: number): Point & { angle: number } {
  const t = parameterAt(p, fraction);
  if (!p.control) return { ...lerp(p.start, p.end, t), angle: Math.atan2(p.end.y - p.start.y, p.end.x - p.start.x) * 180 / Math.PI };
  const point = bezier(p, t), u = 1 - t;
  const dx = 3 * u * u * (p.control.x - p.start.x) + 6 * u * t * (p.control2!.x - p.control.x) + 3 * t * t * (p.end.x - p.control2!.x);
  const dy = 3 * u * u * (p.control.y - p.start.y) + 6 * u * t * (p.control2!.y - p.control.y) + 3 * t * t * (p.end.y - p.control2!.y);
  return { ...point, angle: Math.atan2(dy, dx) * 180 / Math.PI };
}
export function positionOnRoute(pieces: TrackPiece[], distance: number) {
  let remaining = Math.max(0, distance);
  for (const piece of pieces) { if (remaining <= piece.length) return piecePosition(piece, remaining / (piece.length || 1)); remaining -= piece.length; }
  return piecePosition(pieces[pieces.length - 1], 1);
}
export function piecePath(p: TrackPiece): string {
  return p.control ? `M${p.start.x},${p.start.y}C${p.control.x},${p.control.y} ${p.control2!.x},${p.control2!.y} ${p.end.x},${p.end.y}` : `M${p.start.x},${p.start.y}L${p.end.x},${p.end.y}`;
}
/** Preserve the exact endpoint and tangent when replacing the untravelled part of a route. */
export function splitPath(pieces: TrackPiece[], distance: number): { before: TrackPiece[]; after: TrackPiece[] } {
  const before: TrackPiece[] = []; let remaining = Math.max(0, distance);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (remaining >= p.length) { before.push(p); remaining -= p.length; continue; }
    const t = parameterAt(p, remaining / (p.length || 1));
    if (t === 0) return { before, after: pieces.slice(i) };
    if (!p.control) { const point = lerp(p.start, p.end, t); return { before: [...before, line(p.start, point)], after: [line(point, p.end), ...pieces.slice(i + 1)] }; }
    const a = lerp(p.start, p.control, t), b = lerp(p.control, p.control2!, t), c = lerp(p.control2!, p.end, t);
    const d = lerp(a, b, t), e = lerp(b, c, t), point = lerp(d, e, t);
    return { before: [...before, curve(p.start, a, d, point)], after: [curve(point, e, c, p.end), ...pieces.slice(i + 1)] };
  }
  return { before, after: [] };
}

type Direction = 0 | 1 | 2 | 3;
const DIRS: Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
interface Cell { col: number; row: number; direction: Direction; kind: 'leaf' | 'path' | 'switch'; children: Cell[]; depth: number; side: number }
const key = (col: number, row: number) => `${col},${row}`;
function seeded(seed: number): Random { let value = seed; return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; }; }
function growTree(count: number, random: Random) {
  const used = new Set<string>(), cells: Cell[] = [];
  const add = (col: number, row: number, direction: Direction, depth = 0, side = -1): Cell => {
    const cell: Cell = { col, row, direction, kind: 'leaf', children: [], depth, side }; used.add(key(col, row)); cells.push(cell); return cell;
  };
  const start = add(0, 0, 1);
  let first = start;
  const prefix = Math.floor(random() * 6);
  const prefixDirections: Direction[][] = [[1, 1, 1], [1, 1, 0], [1, 0, 1, 1], [1, 1, 0, 0], [1, 1, 1, 0, 3], [1, 1, 0, 0, 1]];
  for (const direction of prefixDirections[prefix]) { first.kind = 'path'; const child = add(first.col + DIRS[direction].x, first.row + DIRS[direction].y, direction); first.children = [child]; first = child; }
  const available = (n: Cell, direction: number) => {
    const col = n.col + DIRS[direction].x, row = n.row + DIRS[direction].y;
    return col >= 0 && col < 5 && row >= 0 && row < 9 && !used.has(key(col, row));
  };
  const maxDepth = Math.ceil(Math.log2(count)) + 1;
  const children = (n: Cell, directions: Direction[]) => {
    n.kind = directions.length === 2 ? 'switch' : 'path';
    n.children = directions.map((d, i) => add(n.col + DIRS[d].x, n.row + DIRS[d].y, d, n.depth + Number(directions.length === 2), n === first ? i : n.side));
  };
  let forks = 0, paths = 0;
  while (forks < count - 1 && cells.length < 43) {
    const leaves = cells.filter(n => n.kind === 'leaf');
    let candidates = leaves.filter(n => n.depth < maxDepth && available(n, n.direction) && [1, 3].some(turn => available(n, (n.direction + turn) % 4)));
    if (forks === 0) candidates = candidates.filter(n => n === first);
    if (count >= 6 && forks > 0 && forks <= 2) {
      const missing = [0, 1].filter(side => !cells.some(n => n.kind === 'switch' && n !== first && n.side === side));
      const needed = candidates.filter(n => missing.includes(n.side)); if (needed.length) candidates = needed;
    }
    if (candidates.length && (forks === 0 || paths >= 7 || random() < .76)) {
      candidates.sort((a, b) => a.depth - b.depth);
      const n = candidates[Math.floor(random() * Math.min(candidates.length, 3))];
      const turns = [1, 3].map(turn => (n.direction + turn) % 4 as Direction).filter(d => available(n, d));
      children(n, [n.direction, turns[Math.floor(random() * turns.length)]]); forks++;
    } else {
      const candidates = leaves.filter(n => [0, 1, 3].some(turn => available(n, (n.direction + turn) % 4)));
      if (!candidates.length) return null;
      const n = candidates[Math.floor(random() * candidates.length)];
      const turns = [1, 3, 0].map(turn => (n.direction + turn) % 4 as Direction).filter(d => available(n, d));
      children(n, [turns[Math.floor(random() * turns.length)]]); paths++;
    }
  }
  if (forks !== count - 1) return null;
  const extra = 6 + Math.floor(random() * 5);
  while (paths < extra && cells.length < 42) {
    const candidates = cells.filter(n => n.kind === 'leaf' && [0, 1, 3].some(turn => available(n, (n.direction + turn) % 4)));
    if (!candidates.length) break;
    const n = candidates[Math.floor(random() * candidates.length)];
    const directions = [1, 3, 0].map(turn => (n.direction + turn) % 4 as Direction).filter(d => available(n, d));
    children(n, [directions[Math.floor(random() * directions.length)]]); paths++;
  }
  if (count >= 6 && ![0, 1].every(side => cells.some(n => n.kind === 'switch' && n !== first && n.side === side))) return null;
  if (cells.filter(n => n.kind === 'path' && n.children[0].direction !== n.direction).length < 2 || cells.filter(n => n.kind === 'switch' && n.direction % 2 === 0).length < 1) return null;
  const longest = (n: Cell): number => n.children.length ? Math.max(...n.children.map(child => (child.col === n.col ? 66.25 : 68) + longest(child))) : 0;
  const estimate = 69 + longest(start);
  if (estimate < 620 + (count - 4) * 25 || estimate > 1040 + (count - 4) * 35) return null;
  return { start, cells, prefix };
}

/** Random planar trees: occupied grid cells prevent crossings and merges. Each branch can
 * bend repeatedly and lead to more binary choices, rather than always ending at a station. */
export function generateNetwork(level: number, options: { random?: Random; entryZone?: EntryZone; previousSignature?: string } = {}): Network {
  const random = options.random ?? Math.random, count = levelConfig(level).stations;
  const entryZone = options.entryZone ?? ENTRY_ZONES[Math.floor(random() * 4)];
  const flipX = entryZone.endsWith('right'), flipY = entryZone.startsWith('bottom');
  let previous: { colors?: string[]; layoutKey?: string } = {};
  try { const p = JSON.parse(options.previousSignature ?? '{}'); previous = Array.isArray(p) ? { colors: p[3] } : p; } catch { /* Obsolete signatures are harmless. */ }
  const seed = Math.floor(random() * 0xffffffff);
  let tree: NonNullable<ReturnType<typeof growTree>> | undefined, layoutKey = '';
  for (let attempt = 0; attempt < 1600; attempt++) {
    const candidate = growTree(count, seeded((seed + Math.imul(attempt, 2654435761)) >>> 0));
    if (!candidate) continue;
    const shape = JSON.stringify(candidate.cells.map(n => [n.col, n.row, n.direction, n.kind, n.children.map(c => [c.col, c.row])]));
    if (shape === previous.layoutKey) continue;
    tree = candidate; layoutKey = shape; break;
  }
  if (!tree) throw new Error('Could not generate a playable railway tree.');
  const geometryRandom = seeded(seed ^ 0x85ebca6b);
  const xs = Array.from({ length: 5 }, (_, i) => 44 + i * 68 + (geometryRandom() - .5) * 2);
  const ys = Array.from({ length: 9 }, (_, i) => 45 + i * 66.25 + (geometryRandom() - .5) * 2);
  const point = (n: Cell): Point => ({ x: xs[n.col], y: ys[n.row] });
  const transform = (p: Point): Point => ({ x: flipX ? WIDTH - p.x : p.x, y: flipY ? HEIGHT - p.y : p.y });
  const transformPiece = (p: TrackPiece): TrackPiece => ({ ...p, start: transform(p.start), end: transform(p.end), control: p.control ? transform(p.control) : undefined, control2: p.control2 ? transform(p.control2) : undefined });
  const forks = tree.cells.filter(n => n.kind === 'switch'), leaves = tree.cells.filter(n => n.kind === 'leaf');
  let colors = shuffle(TRAIN_COLORS.slice(0, count), random);
  if (colors.map(c => c.id).join('|') === previous.colors?.join('|')) colors = [...colors.slice(1), colors[0]];
  const corner = (p: Point, incoming: Point, outgoing: Point) => {
    const start = offset(p, incoming, -RAIL_RADIUS), end = offset(p, outgoing, RAIL_RADIUS), k = .5522847498 * RAIL_RADIUS;
    return curve(start, offset(start, incoming, k), offset(end, outgoing, -k), end);
  };
  const walk = (initial: Cell, from: Point): Route => {
    const pieces: TrackPiece[] = []; let n = initial, current = from;
    while (n.kind === 'path') {
      const child = n.children[0];
      if (child.direction !== n.direction) {
        const bend = corner(point(n), DIRS[n.direction], DIRS[child.direction]);
        pieces.push(line(current, bend.start), bend); current = bend.end;
      }
      n = child;
    }
    const end = n.kind === 'switch' ? offset(point(n), DIRS[n.direction], -RAIL_RADIUS) : point(n);
    pieces.push(line(current, end));
    return { pieces, next: n.kind === 'switch' ? { kind: 'switch', id: forks.indexOf(n) } : { kind: 'station', id: leaves.indexOf(n) } };
  };
  const junctions = forks.map((n, id): Junction => {
    const p = point(n), incoming = DIRS[n.direction];
    const straight = walk(n.children[0], offset(p, incoming, RAIL_RADIUS));
    straight.pieces.unshift(line(offset(p, incoming, -RAIL_RADIUS), offset(p, incoming, RAIL_RADIUS)));
    const turnDirection = n.children[1].direction, turnVector = DIRS[turnDirection];
    const turn = walk(n.children[1], offset(p, turnVector, RAIL_RADIUS));
    turn.pieces.unshift(corner(p, incoming, turnVector));
    const right = ((turnDirection - n.direction + 4) % 4 === 1) !== (flipX !== flipY);
    return { id, point: transform(p), turnSide: right ? 'right' : 'left', straight: { ...straight, pieces: straight.pieces.map(transformPiece) }, turn: { ...turn, pieces: turn.pieces.map(transformPiece) } };
  });
  const stations = leaves.map((n, id): Station => {
    const direction = DIRS[n.direction];
    return { id, point: transform(point(n)), color: colors[id], angle: Math.atan2(direction.y * (flipY ? -1 : 1), direction.x * (flipX ? -1 : 1)) * 180 / Math.PI };
  });
  const initial = walk(tree.start, { x: xs[0], y: -24 });
  const root = { ...initial, pieces: initial.pieces.map(transformPiece) };
  const longest = (route: Route): number => pathLength(route.pieces) + (route.next.kind === 'station' ? 0 : Math.max(longest(junctions[route.next.id].straight), longest(junctions[route.next.id].turn)));
  const signature = JSON.stringify({ entryZone, layoutKey, colors: colors.map(c => c.id), seed });
  return { width: WIDTH, height: HEIGHT, level, entryZone, root, junctions, stations, longestDistance: longest(root), signature, layoutKey, scenerySeed: seed };
}
export function destination(network: Network, switches: boolean[]): Station {
  let next = network.root.next;
  while (next.kind === 'switch') next = (switches[next.id] ? network.junctions[next.id].turn : network.junctions[next.id].straight).next;
  return network.stations[next.id];
}
