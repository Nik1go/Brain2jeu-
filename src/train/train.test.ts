import { afterEach, describe, expect, it } from 'vitest';
import { TRAIN_COLORS, TRAIN_LEVELS, TRAIN_RULES } from './config';
import { destination, ENTRY_ZONES, generateNetwork, pathLength, piecePosition, positionOnRoute } from './network';
import { emptyTrainScore, levelPassed, pointsPerTrain, recordDelivery } from './scoring';
import { advanceTrains, newTrainGame, spawnTrain, toggleJunction } from './simulation';
import { emptyTrainProgress, finishTrainGame, loadTrainProgress, saveTrainProgress, TRAIN_STORAGE_KEY } from './storage';
import { colorSequence, createSchedule, spawnIntervalMs } from './waves';

function seeded(initial: number) { let seed = initial; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }

describe('réseaux ferroviaires', () => {
  it.each(ENTRY_ZONES)('rend toutes les gares accessibles, sans sortie ni boucle, entrée %s', entryZone => {
    for (const { level, stations } of TRAIN_LEVELS) {
      for (let seed = 1; seed <= 12; seed++) {
        const network = generateNetwork(level, { entryZone, random: seeded(seed) });
        expect(network.stations).toHaveLength(stations);
        expect(network.junctions).toHaveLength(stations - 1);
        const visited = new Set<number>();
        // Exhaust every switch combination, not just a route to each station.
        for (let mask = 0; mask < 2 ** network.junctions.length; mask++) visited.add(destination(network, network.junctions.map((_, i) => Boolean(mask & (1 << i)))).id);
        expect(visited.size).toBe(stations);
        expect(network.stations.map(s => s.color.id).sort()).toEqual(TRAIN_COLORS.slice(0, stations).map(c => c.id).sort());
        const entry = network.root.pieces[0];
        expect(entry.start.x).toBe(entry.end.x);
        expect(entry.start.y).toBe(entryZone.startsWith('top') ? -24 : network.height + 24);
        expect(entry.start.x < network.width / 2).toBe(entryZone.endsWith('left'));
        for (const j of network.junctions) {
          const straight = j.straight.pieces[0], turn = j.turn.pieces[0];
          expect(straight.control).toBeUndefined();
          expect(turn.control).toEqual(j.point);
          expect(straight.start).toEqual(turn.start);
          expect(Math.abs(piecePosition(turn, 1).angle - piecePosition(turn, 0).angle)).toBeCloseTo(90);
          expect(j.straight.next.kind === 'station' || j.straight.next.id > j.id).toBe(true);
          expect(j.turn.next.kind).toBe('station');
          for (const p of [...j.straight.pieces, ...j.turn.pieces]) for (const point of [p.start, p.end]) {
            expect(point.x).toBeGreaterThan(20); expect(point.x).toBeLessThan(340);
            expect(point.y).toBeGreaterThan(20); expect(point.y).toBeLessThan(600);
          }
        }
      }
    }
  });
  it('ne croise pas les voies et garde des zones tactiles séparées aux neuf gares', () => {
    for (const entryZone of ENTRY_ZONES) {
      const n = generateNetwork(8, { entryZone, random: seeded(11) });
      const rows = n.junctions.map(j => j.point.y).sort((a, b) => a - b);
      rows.slice(1).forEach((y, i) => expect(y - rows[i]).toBeGreaterThan(54));
      for (const j of n.junctions) {
        const branch = j.turn.pieces[1];
        expect(branch.start.y).toBe(branch.end.y);
        expect(branch.end).toEqual(n.stations[j.id].point);
        expect(Math.abs(branch.start.x - j.point.x)).toBe(18);
      }
    }
  });
  it('borne les variations de temps et de longueur au même niveau', () => {
    for (const { level } of TRAIN_LEVELS) {
      const lengths = Array.from({ length: 80 }, (_, seed) => generateNetwork(level, { random: seeded(seed + 1) }).longestDistance);
      expect(Math.max(...lengths) / Math.min(...lengths)).toBeLessThan(1.13);
      expect(Math.max(...lengths) / TRAIN_RULES.speed).toBeLessThan(13);
    }
  });
  it('renouvelle même un plateau généré par un hasard constant', () => {
    const first = generateNetwork(2, { random: () => .3 });
    const second = generateNetwork(2, { random: () => .3, previousSignature: first.signature });
    expect(second.signature).not.toBe(first.signature);
    expect(second.stations.map(s => s.color.id)).not.toEqual(first.stations.map(s => s.color.id));
  });
  it('utilise la même courbe circulaire pour le rendu et le mouvement', () => {
    const j = generateNetwork(1).junctions[0], p = j.turn.pieces[0];
    expect(positionOnRoute([p], 0).x).toBeCloseTo(p.start.x);
    expect(positionOnRoute([p], p.length).y).toBeCloseTo(p.end.y);
    expect(p.length).toBeCloseTo(Math.PI * 18 / 2);
    expect(pathLength(j.straight.pieces)).toBeGreaterThan(36);
  });
});

describe('vagues et couleurs', () => {
  it('respecte les quatre rythmes configurés et la borne absolue', () => {
    expect([0, 30_000, 60_000, 90_000].map(t => spawnIntervalMs(1, t))).toEqual([5750, 5000, 4500, 4000]);
    expect(spawnIntervalMs(8, 90_000)).toBeCloseTo(2320);
    for (const { level } of TRAIN_LEVELS) for (const t of [0, 30_000, 60_000, 90_000]) expect(spawnIntervalMs(level, t)).toBeGreaterThanOrEqual(1800);
  });
  it('répartit chaque sac équitablement et ne répète pas une couleur plus de deux fois', () => {
    for (let n = 2; n <= 9; n++) {
      const colors = TRAIN_COLORS.slice(0, n).map(c => c.id);
      const sequence = colorSequence(n * 40, colors, seeded(n));
      for (let i = 0; i < sequence.length; i += n) expect([...sequence.slice(i, i + n)].sort()).toEqual([...colors].sort());
      for (let i = 2; i < sequence.length; i++) expect(sequence[i] === sequence[i - 1] && sequence[i] === sequence[i - 2]).toBe(false);
      const again = colorSequence(sequence.length, colors, seeded(n), sequence);
      expect(again).not.toEqual(sequence);
    }
  });
  it('réserve la marge du plus long trajet et laisse un temps de réaction réaliste', () => {
    for (const { level } of TRAIN_LEVELS) for (const entryZone of ENTRY_ZONES) {
      const network = generateNetwork(level, { entryZone, random: seeded(level) });
      const schedule = createSchedule(network, seeded(123));
      expect(schedule.at(-1)!.atMs).toBeGreaterThan(90_000);
      expect(schedule.at(-1)!.atMs + network.longestDistance / TRAIN_RULES.speed * 1000).toBeLessThanOrEqual(TRAIN_RULES.durationMs - TRAIN_RULES.arrivalMarginMs);
      for (let i = 1; i < schedule.length; i++) {
        const gap = schedule[i].atMs - schedule[i - 1].atMs;
        expect(gap).toBeGreaterThanOrEqual(1800);
        expect(gap - 36 / TRAIN_RULES.speed * 1000).toBeGreaterThan(1200);
      }
    }
  });
});

describe('circulation et score', () => {
  it('fige la décision dès l’entrée du train dans un module', () => {
    let game = newTrainGame(1);
    const station = game.network.stations[0];
    const train = spawnTrain(game.network, { id: 99, colorId: station.color.id, atMs: 0 });
    train.distance = pathLength(game.network.root.pieces) - 1;
    game = { ...game, switches: [true], schedule: [], trains: [train] };
    game = advanceTrains(game, 20);
    expect(game.trains[0].next).toEqual({ kind: 'station', id: station.id });
    const path = game.trains[0].pieces;
    game = toggleJunction(game, 0, 21);
    expect(game.switches).toEqual([false]);
    expect(game.trains[0].pieces).toEqual(path);
    game = advanceTrains(game, 12_000);
    expect(game.correct).toBe(1); expect(game.errors).toBe(0);
  });
  it('applique immédiatement un toucher au prochain train encore hors du module', () => {
    let game = newTrainGame(1);
    const train = spawnTrain(game.network, { id: 0, colorId: game.network.stations[0].color.id, atMs: 0 });
    game = { ...game, schedule: [], trains: [{ ...train, distance: pathLength(train.pieces) - 10 }] };
    game = toggleJunction(game, 0, 1);
    game = advanceTrains(game, 10_000);
    expect(game.correct).toBe(1);
  });
  it.each(ENTRY_ZONES)('livre tous les trains avant 120 s, y compris sans images intermédiaires, entrée %s', entryZone => {
    for (const { level } of TRAIN_LEVELS) {
      let game = newTrainGame(level, { random: seeded(level) });
      const network = generateNetwork(level, { entryZone, random: seeded(level) });
      game = { ...game, network, schedule: createSchedule(network, seeded(level)) };
      game = advanceTrains(game, 120_000);
      expect(game.over).toBe(true); expect(game.elapsedMs).toBe(120_000);
      expect(game.trains).toHaveLength(0);
      expect(game.deliveries).toHaveLength(game.schedule.length);
      expect(new Set(game.deliveries.map(d => d.trainId)).size).toBe(game.schedule.length);
      expect(game.deliveries.every(d => d.atMs < 120_000)).toBe(true);
      expect(advanceTrains(game, 121_000)).toBe(game);
    }
  });
  it('termine aussi les trajets les plus longs avec des changements continus', () => {
    let game = newTrainGame(8, { random: seeded(2) });
    for (let t = 111; t < 120_000; t += 111) game = toggleJunction(game, Math.floor(t / 111) % 8, t);
    game = advanceTrains(game, 120_000);
    expect(game.trains).toHaveLength(0); expect(game.deliveries).toHaveLength(game.schedule.length);
  });
  it('attend exactement 2 minutes, même après une quatrième faute', () => {
    let game = newTrainGame(1);
    const wrongColor = game.network.stations[0].color.id;
    game = { ...game, schedule: game.schedule.map(s => ({ ...s, colorId: wrongColor })) };
    game = advanceTrains(game, 60_000);
    expect(game.errors).toBeGreaterThan(4); expect(game.over).toBe(false);
    game = advanceTrains(game, 119_999); expect(game.over).toBe(false);
    game = advanceTrains(game, 120_000); expect(game.over).toBe(true);
    expect(game.errors).toBe(game.schedule.length); expect(game.score).toBe(0);
  });
  it('additionne uniquement les livraisons correctes et protège du double comptage', () => {
    expect([2, 3, 4, 5, 9].map(pointsPerTrain)).toEqual([100, 125, 150, 175, 275]);
    let score = recordDelivery(emptyTrainScore(), { trainId: 1, stationId: 0, correct: true, atMs: 1000 }, 4);
    const duplicate = recordDelivery(score, { trainId: 1, stationId: 1, correct: false, atMs: 2000 }, 4);
    expect(duplicate).toBe(score);
    score = recordDelivery(score, { trainId: 2, stationId: 1, correct: false, atMs: 3000 }, 4);
    expect(score.score).toBe(150); expect(score.correct).toBe(1); expect(score.errors).toBe(1);
  });
});

describe('progression et persistance séparées de Miroirs cachés', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  afterEach(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  function complete(level = 1, errors = 0) {
    const game = advanceTrains(newTrainGame(level), 120_000);
    return { ...game, errors, correct: game.deliveries.length - errors, score: (game.deliveries.length - errors) * pointsPerTrain(level + 1) };
  }
  it.each([0, 1, 2, 3, 4, 5])('débloque si et seulement si les fautes %s sont au plus trois', errors => {
    expect(levelPassed(errors)).toBe(errors <= 3);
    const saved = finishTrainGame(emptyTrainProgress(), complete(1, errors), `game-${errors}`);
    expect(saved.result.passed).toBe(errors <= 3);
    expect(saved.progress.unlocked).toBe(errors <= 3 ? 2 : 1);
  });
  it('garde les niveaux et records acquis après un échec et sépare les records par niveau', () => {
    let p = finishTrainGame(emptyTrainProgress(), complete(), 'one').progress;
    const best = p.best[1];
    p = finishTrainGame(p, complete(2), 'two').progress;
    p = finishTrainGame(p, complete(1, 6), 'fail').progress;
    expect(p.unlocked).toBe(3); expect(p.best[1]).toBe(best); expect(p.best[2]).toBeGreaterThan(0);
    expect(finishTrainGame(p, complete(1), 'one').progress).toBe(p);
    expect(finishTrainGame({ ...p, unlocked: 8 }, complete(8), 'eight').progress.unlocked).toBe(8);
  });
  it('refuse un abandon ou une partie dont des trains restent à livrer', () => {
    const game = newTrainGame(1);
    expect(() => finishTrainGame(emptyTrainProgress(), game, 'no')).toThrow();
    expect(() => finishTrainGame(emptyTrainProgress(), { ...game, over: true, elapsedMs: 120_000 }, 'no')).toThrow();
  });
  it('recharge les records, le tutoriel et les niveaux sans toucher au stockage existant', () => {
    const data = new Map([['declic.progress.v1', 'memory-data']]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k), setItem: (k: string, v: string) => data.set(k, v) } });
    const p = { ...finishTrainGame(emptyTrainProgress(), complete(), 'saved').progress, tutorialDone: true };
    expect(saveTrainProgress(p)).toBe(true); expect(loadTrainProgress()).toEqual(p);
    expect(data.get('declic.progress.v1')).toBe('memory-data');
    data.set(TRAIN_STORAGE_KEY, '{broken'); expect(loadTrainProgress()).toEqual(emptyTrainProgress());
    data.set(TRAIN_STORAGE_KEY, JSON.stringify({ version: 1, unlocked: 999, best: { '1': 100, '2': -1, '9': 100, nope: 40 }, history: [null] }));
    expect(loadTrainProgress().best).toEqual({ '1': 100 }); expect(loadTrainProgress().unlocked).toBe(8);
  });
  it('fonctionne en mémoire quand le stockage est indisponible', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('unavailable'); } });
    expect(loadTrainProgress()).toEqual(emptyTrainProgress()); expect(saveTrainProgress(emptyTrainProgress())).toBe(false);
  });
});
