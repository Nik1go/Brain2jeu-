import { describe, expect, it } from 'vitest';
import { ENTRY_ZONES, generateNetwork, JUNCTION_RADIUS, line, pathLength, positionOnRoute } from './network';
import { junctionRail, railPath } from './rails';

describe('raccords visuels des rails', () => {
  it('dessine chaque voie connectée sans embout entre ses lignes et ses courbes', () => {
    for (const entryZone of ENTRY_ZONES) for (const level of [1, 3, 8]) {
      const network = generateNetwork(level, { entryZone, random: () => .4 });
      const routes = [network.root, ...network.junctions.flatMap(j => [j.straight, j.turn])];
      for (const route of routes) {
        const d = railPath(route.pieces);
        expect(d.match(/M/g)).toHaveLength(1);
        expect(d.match(/C/g)?.length ?? 0).toBe(route.pieces.filter(p => p.control).length);
        expect(d).not.toContain('NaN');
      }
    }
  });
  it('raccorde le rail actif au même trajet, au-delà de la largeur visible du cercle', () => {
    for (const entryZone of ENTRY_ZONES) for (const level of [1, 3, 8]) {
      const network = generateNetwork(level, { entryZone, random: () => .4 });
      for (const junction of network.junctions) for (const route of [junction.straight, junction.turn]) {
        const pieces = junctionRail(route), prefix = pieces[0].length;
        expect(railPath(pieces).match(/M/g)).toHaveLength(1);
        for (const point of [pieces[0].start, pieces.at(-1)!.end]) {
          expect(Math.hypot(point.x - junction.point.x, point.y - junction.point.y)).toBeGreaterThan(JUNCTION_RADIUS + 8);
        }
        for (const fraction of [0, .2, .5, .8, 1]) {
          const distance = (pathLength(pieces) - prefix) * fraction;
          const visual = positionOnRoute(pieces, prefix + distance), movement = positionOnRoute(route.pieces, distance);
          expect(visual.x).toBeCloseTo(movement.x, 4); expect(visual.y).toBeCloseTo(movement.y, 4);
          expect(visual.angle).toBeCloseTo(movement.angle, 4);
        }
      }
    }
  });
  it('n’invente pas de rail entre deux segments séparés', () => {
    const pieces = [line({ x: 0, y: 0 }, { x: 10, y: 0 }), line({ x: 30, y: 0 }, { x: 40, y: 0 })];
    expect(railPath(pieces).match(/M/g)).toHaveLength(2);
  });
});
