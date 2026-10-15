import { describe, expect, it } from 'vitest';
import { generateNetwork, pathLength, destination, ENTRY_ZONES, piecePosition, splitPath } from './network';
import { TRAIN_LEVELS, TRAIN_COLORS } from './config';
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
describe('arbres ferroviaires et variété', () => {
  it.each(ENTRY_ZONES)('génère huit niveaux accessibles avec une entrée longue : %s', entryZone => {
    for (const { level, stations } of TRAIN_LEVELS) for (let seed = 1; seed <= 35; seed++) {
      const n = generateNetwork(level, { entryZone, random: seeded(seed) });
      expect(n.stations).toHaveLength(stations); expect(n.junctions).toHaveLength(stations - 1);
      expect(pathLength(n.root.pieces)).toBeGreaterThan(220);
      expect(n.longestDistance).toBeLessThan(1330);
      const first = n.root.pieces[0]; expect(first.start.x).toBe(first.end.x);
      expect(first.start.y).toBe(entryZone.startsWith('top') ? -24 : n.height + 24);
      const visited = new Set<number>();
      for (let mask = 0; mask < 2 ** n.junctions.length; mask++) visited.add(destination(n, n.junctions.map((_, i) => Boolean(mask & (1 << i)))).id);
      expect(visited.size).toBe(stations);
      expect(new Set(n.stations.map(s => s.color.id)).size).toBe(stations);
      const cells = JSON.parse(n.layoutKey) as [number, number, number, string, [number, number][]][];
      const coordinates = cells.map(([x, y]) => `${x},${y}`);
      expect(new Set(coordinates).size).toBe(cells.length);
      const incoming = new Map<string, number>();
      for (const [x, y, , kind, children] of cells) {
        expect(children.length).toBe(kind === 'switch' ? 2 : kind === 'path' ? 1 : 0);
        for (const [cx, cy] of children) {
          expect(Math.abs(cx - x) + Math.abs(cy - y)).toBe(1);
          const coordinate = `${cx},${cy}`; expect(coordinates).toContain(coordinate);
          incoming.set(coordinate, (incoming.get(coordinate) ?? 0) + 1);
        }
      }
      // Single-parent neighbouring grid edges cannot cross or merge; every cell belongs to the tree.
      expect(incoming.size).toBe(cells.length - 1); expect([...incoming.values()].every(n => n === 1)).toBe(true);
      expect(n.stations.map(s => s.color.id).sort()).toEqual(TRAIN_COLORS.slice(0, stations).map(c => c.id).sort());
      for (const j of n.junctions) {
        expect(j.straight.pieces[0].control).toBeUndefined(); expect(j.turn.pieces[0].control).toBeDefined();
        expect(j.straight.pieces[0].start).toEqual(j.turn.pieces[0].start);
        const angle = piecePosition(j.turn.pieces[0], 1).angle - piecePosition(j.turn.pieces[0], 0).angle;
        expect(Math.abs(Math.sin(angle * Math.PI / 180))).toBeCloseTo(1);
        for (const route of [j.straight, j.turn]) {
          expect(route.next.kind === 'station' || route.next.id > j.id).toBe(true);
          for (const p of route.pieces) for (const point of [p.start, p.end]) { expect(point.x).toBeGreaterThan(15); expect(point.x).toBeLessThan(345); expect(point.y).toBeGreaterThan(15); expect(point.y).toBeLessThan(605); }
        }
      }
      if (level >= 3) { const root = n.junctions[n.root.next.id]; expect(root.straight.next.kind).toBe('switch'); expect(root.turn.next.kind).toBe('switch'); }
    }
  }, 15000);
  it('change réellement la topologie au niveau 3, même avec un hasard constant', () => {
    let previousSignature: string | undefined; const layouts = new Set<string>();
    for (let i = 0; i < 12; i++) { const n = generateNetwork(3, { random: () => .4, previousSignature }); if (previousSignature) expect(n.signature).not.toBe(previousSignature); layouts.add(n.layoutKey); previousSignature = n.signature; }
    expect(layouts.size).toBeGreaterThanOrEqual(2);
    expect(new Set(Array.from({ length: 40 }, (_, i) => generateNetwork(3, { random: seeded(i) }).layoutKey)).size).toBeGreaterThan(30);
  });
  it('garde les aiguillages espacés et plusieurs orientations de choix', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const n = generateNetwork(8, { random: seeded(seed) });
      for (const a of n.junctions) for (const b of n.junctions) if (a.id !== b.id) expect(Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y)).toBeGreaterThan(63);
      const angles = n.junctions.map(j => Math.round(piecePosition(j.straight.pieces[0], 0).angle));
      expect(new Set(angles).size).toBeGreaterThanOrEqual(2);
    }
  });
  it('coupe les courbes sans saut de position', () => {
    const n = generateNetwork(1), piece = n.junctions[0].turn.pieces[0];
    for (const t of [.1, .4, .7]) { const split = splitPath([piece], piece.length * t), point = piecePosition(piece, t); expect(split.before.at(-1)!.end.x).toBeCloseTo(point.x); expect(split.after[0].start.y).toBeCloseTo(point.y); }
  });
  it('varie les approches initiales, y compris un détour en U avant le premier choix', () => {
    const angles = new Set<number>(), approaches = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const n = generateNetwork(3, { entryZone: 'top-left', random: seeded(seed) });
      angles.add(Math.round(piecePosition(n.junctions[n.root.next.id].straight.pieces[0], 0).angle));
      approaches.add(n.root.pieces.map(p => `${Math.round(p.start.x)}:${Math.round(p.start.y)}-${Math.round(p.end.x)}:${Math.round(p.end.y)}`).join('|'));
    }
    expect(angles.has(-90)).toBe(true); expect(angles.size).toBeGreaterThanOrEqual(3); expect(approaches.size).toBeGreaterThan(20);
  });
});
