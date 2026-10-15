import { afterEach, describe, expect, it } from 'vitest';
import { levelConfig, TRAIN_COLORS, TRAIN_LEVELS, TRAIN_RULES, TRAIN_WAVE_RULES } from './config';
import { destination, ENTRY_ZONES, pathLength, positionOnRoute } from './network';
import { emptyTrainScore, levelPassed, pointsPerTrain, recordDelivery } from './scoring';
import { advanceTrains, controllableJunction, newTrainGame, setTrainPaused, spawnTrain, toggleJunction } from './simulation';
import { emptyTrainProgress, finishTrainGame, loadTrainProgress, saveTrainProgress, TRAIN_STORAGE_KEY } from './storage';
import { colorSequence, createSchedule, spawnIntervalMs } from './waves';
import { newTrainClock, pauseTrainClock, tickTrainClock } from './time';
function seeded(initial: number) { let seed = initial; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function parked(offset: number, turn = false) {
  let game = newTrainGame(3, { random: seeded(6) });
  const switches = game.switches.map((_, i) => i === game.network.root.next.id && turn);
  const colorId = destination(game.network, switches).color.id;
  const train = spawnTrain(game.network, { id: 99, colorId, atMs: 0 });
  game = { ...game, switches, schedule: [], trains: [{ ...train, distance: pathLength(game.network.root.pieces) + offset }] };
  return advanceTrains(game, 1);
}

describe('départs pendant deux minutes', () => {
  it('augmente progressivement la densité de référence', () => {
    [0, 30_000, 60_000, 90_000].map(t => spawnIntervalMs(1, t)).forEach((interval, i) => expect(interval).toBeCloseTo([4140, 3600, 3240, 2880][i]));
    expect(spawnIntervalMs(8, 90_000)).toBeCloseTo(2040);
    for (const { level } of TRAIN_LEVELS) for (const t of [0, 30_000, 60_000, 90_000]) expect(spawnIntervalMs(level, t)).toBeGreaterThanOrEqual(1800);
  });
  it('continue les apparitions jusqu’au voisinage de zéro, sans marge retirée pour le trajet', () => {
    for (const { level } of TRAIN_LEVELS) {
      const game = newTrainGame(level, { random: seeded(level) }), schedule = game.schedule;
      expect(schedule.at(-1)!.atMs).toBeGreaterThanOrEqual(120_000 - TRAIN_WAVE_RULES.quietGapMs[1]);
      expect(schedule.every(s => s.atMs < 120_000)).toBe(true);
      for (let i = 1; i < schedule.length; i++) {
        const gap = schedule[i].atMs - schedule[i - 1].atMs;
        expect(gap).toBeGreaterThanOrEqual(1800);
        expect(gap - 50 / TRAIN_RULES.speed * 1000).toBeGreaterThan(1000);
      }
    }
  });
  it('répartit chaque sac et renouvelle la séquence sans trois couleurs identiques consécutives', () => {
    for (let n = 4; n <= TRAIN_COLORS.length; n++) {
      const colors = TRAIN_COLORS.slice(0, n).map(c => c.id), sequence = colorSequence(n * 40, colors, seeded(n));
      for (let i = 0; i < sequence.length; i += n) expect([...sequence.slice(i, i + n)].sort()).toEqual([...colors].sort());
      for (let i = 2; i < sequence.length; i++) expect(sequence[i] === sequence[i - 1] && sequence[i] === sequence[i - 2]).toBe(false);
      expect(colorSequence(sequence.length, colors, seeded(n), sequence)).not.toEqual(sequence);
    }
  });
  it.each(ENTRY_ZONES)('attend les dernières livraisons après zéro : %s', entryZone => {
    for (const { level } of TRAIN_LEVELS) {
      let game = newTrainGame(level, { random: seeded(level), entryZone });
      expect(game.network.entryZone).toBe(entryZone);
      game = advanceTrains(game, 120_000);
      expect(game.elapsedMs).toBe(120_000); expect(game.over).toBe(false); expect(game.trains.length).toBeGreaterThan(0);
      expect(game.spawnIndex).toBe(game.schedule.length);
      const spawned = game.spawnIndex;
      game = advanceTrains(game, 121_000); expect(game.spawnIndex).toBe(spawned);
      game = advanceTrains(game, 240_000);
      expect(game.over).toBe(true); expect(game.trains).toHaveLength(0);
      expect(game.deliveries).toHaveLength(game.schedule.length);
      expect(new Set(game.deliveries.map(d => d.trainId)).size).toBe(game.schedule.length);
      expect(game.elapsedMs).toBeGreaterThan(120_000); expect(game.elapsedMs).toBeLessThan(144_000);
      expect(advanceTrains(game, 250_000)).toBe(game);
    }
  });
  it('ne termine pas pendant une accalmie sans train, puis livre le départ juste avant zéro', () => {
    let game = newTrainGame(1, { random: seeded(1) });
    game = { ...game, schedule: [{ ...game.schedule[0], atMs: 1200 }, { ...game.schedule[1], atMs: 119_900 }] };
    game = advanceTrains(game, 60_000);
    expect(game.trains).toHaveLength(0); expect(game.spawnIndex).toBe(1); expect(game.over).toBe(false);
    game = advanceTrains(game, 120_000);
    expect(game.trains).toHaveLength(1); expect(game.spawnIndex).toBe(2); expect(game.over).toBe(false);
    game = advanceTrains(game, 240_000);
    expect(game.over).toBe(true); expect(game.deliveries).toHaveLength(2);
  });
});

describe('aiguillage modifiable dans tout le cercle', () => {
  it('signale l’entrée dans le cercle avant le choix de la branche', () => {
    const before = parked(-7.3), inside = parked(-6.9), id = inside.network.root.next.id;
    expect(controllableJunction(before.network, before.trains[0])).toBeUndefined();
    expect(inside.trains[0].activeJunction).toBeUndefined();
    expect(controllableJunction(inside.network, inside.trains[0])).toBe(id);
    const turned = advanceTrains(toggleJunction(inside, id), 200);
    expect(turned.trains[0].activeJunction).toBe(id);
    expect(turned.trains[0].next).toEqual(inside.network.junctions[id].turn.next);
  });
  it('libère l’aiguillage quand la locomotive sort, même si le wagon est encore dans le cercle', () => {
    const inside = parked(42.8), outside = parked(43.2), id = inside.network.root.next.id;
    expect(controllableJunction(inside.network, inside.trains[0])).toBe(id);
    expect(controllableJunction(outside.network, outside.trains[0])).toBeUndefined();
    const wagon = positionOnRoute(outside.trains[0].pieces, outside.trains[0].distance - 24), center = outside.network.junctions[id].point;
    expect(Math.hypot(wagon.x - center.x, wagon.y - center.y)).toBeLessThan(25);
    expect(toggleJunction(outside, id).trains[0].pieces).toEqual(outside.trains[0].pieces);
  });
  it('utilise la même limite à la sortie d’un virage et après une correction', () => {
    const base = parked(0, true), id = base.network.root.next.id, bend = base.network.junctions[id].turn.pieces[0].length;
    const inside = parked(bend + 6.8, true), outside = parked(bend + 7.2, true);
    expect(controllableJunction(inside.network, inside.trains[0])).toBe(id);
    expect(controllableJunction(outside.network, outside.trains[0])).toBeUndefined();
    const corrected = toggleJunction(inside, id);
    expect(controllableJunction(corrected.network, corrected.trains[0])).toBe(id);
    expect(corrected.trains[0].next).toEqual(corrected.network.junctions[id].straight.next);
  });
  it('change la direction après le centre sans déplacer la locomotive', () => {
    let game = parked(30); const id = game.network.root.next.id;
    const before = positionOnRoute(game.trains[0].pieces, game.trains[0].distance);
    expect(game.trains[0].activeJunction).toBe(id);
    const target = destination(game.network, game.switches.map((s, i) => i === id ? !s : s));
    game = { ...game, trains: game.trains.map(t => ({ ...t, colorId: target.color.id })) };
    game = toggleJunction(game, id);
    const after = positionOnRoute(game.trains[0].pieces, game.trains[0].distance);
    expect(after.x).toBeCloseTo(before.x, 5); expect(after.y).toBeCloseTo(before.y, 5);
    expect(after.angle).toBeCloseTo(before.angle, 4);
    expect(game.trains[0].next).toEqual(game.network.junctions[id].turn.next);
    game = advanceTrains(game, 60_000); expect(game.correct).toBe(1); expect(game.errors).toBe(0);
  });
  it('permet de revenir au rail droit après être entré dans le virage', () => {
    let game = parked(15, true); const id = game.network.root.next.id;
    const before = positionOnRoute(game.trains[0].pieces, game.trains[0].distance);
    game = toggleJunction(game, id);
    const after = positionOnRoute(game.trains[0].pieces, game.trains[0].distance);
    expect(game.switches[id]).toBe(false); expect(game.trains[0].next).toEqual(game.network.junctions[id].straight.next);
    expect(after.x).toBeCloseTo(before.x, 5); expect(after.y).toBeCloseTo(before.y, 5);
    game = advanceTrains(game, 60_000); expect(game.deliveries).toHaveLength(1);
  });
  it('fonctionne jusqu’au bord de la sortie courbe du cercle', () => {
    const base = newTrainGame(3, { random: seeded(6) });
    let game = parked(base.network.junctions[base.network.root.next.id].turn.pieces[0].length + 5, true);
    const id = game.network.root.next.id; expect(game.trains[0].activeJunction).toBe(id);
    game = toggleJunction(game, id); expect(game.trains[0].next).toEqual(game.network.junctions[id].straight.next);
  });
  it('n’affecte plus le train sorti du cercle et agit sur le suivant', () => {
    let game = parked(45); const id = game.network.root.next.id, before = game.trains[0].pieces, target = game.trains[0].next;
    expect(game.trains[0].activeJunction).toBeUndefined();
    game = toggleJunction(game, id); expect(game.trains[0].pieces).toEqual(before); expect(game.trains[0].next).toEqual(target);
    expect(game.switches[id]).toBe(true);
  });
  it('supporte plusieurs corrections dans le cercle et ne compte qu’une livraison', () => {
    let game = parked(15); const id = game.network.root.next.id;
    for (let t = 20; t <= 240; t += 20) game = toggleJunction(game, id, t);
    game = advanceTrains(game, 60_000); expect(game.deliveries).toHaveLength(1);
    expect(game.correct + game.errors).toBe(1);
  });
  it('livre tous les trains après des changements continus sur un grand réseau', () => {
    let game = newTrainGame(8, { random: seeded(2) });
    for (let t = 111; t < 120_000; t += 111) game = toggleJunction(game, Math.floor(t / 111) % game.network.junctions.length, t);
    game = advanceTrains(game, 240_000); expect(game.over).toBe(true); expect(game.trains).toHaveLength(0); expect(game.deliveries).toHaveLength(game.schedule.length);
  });
});

describe('pause réelle', () => {
  it('gèle temps, trains, départs et aiguillages, puis reprend au même instant', () => {
    let game = advanceTrains(newTrainGame(1, { random: seeded(1) }), 10_000); game = setTrainPaused(game, true, 10_200);
    const snapshot = game;
    expect(advanceTrains(game, 180_000)).toBe(snapshot); expect(toggleJunction(game, 0, 180_000)).toBe(snapshot);
    game = setTrainPaused(game, false); expect(game.elapsedMs).toBe(10_200);
    game = advanceTrains(game, 10_300); expect(game.elapsedMs).toBe(10_300); expect(game.spawnIndex).toBe(snapshot.spawnIndex);
  });
  it('retire les durées de pause du temps actif, sans pause involontaire en arrière-plan', () => {
    let clock = newTrainClock(1000);
    clock = tickTrainClock(clock, 6000); expect(clock.elapsedMs).toBe(5000);
    clock = pauseTrainClock(clock, true, 7000); expect(clock.elapsedMs).toBe(6000);
    clock = tickTrainClock(clock, 100_000); expect(clock.elapsedMs).toBe(6000);
    clock = pauseTrainClock(clock, false, 200_000); clock = tickTrainClock(clock, 201_000); expect(clock.elapsedMs).toBe(7000);
    clock = tickTrainClock(clock, 260_000); expect(clock.elapsedMs).toBe(66000);
  });
  it('gèle aussi les derniers trains après la fin des apparitions', () => {
    let game = setTrainPaused(advanceTrains(newTrainGame(1, { random: seeded(1) }), 120_000), true);
    const pending = game.trains; expect(advanceTrains(game, 200_000).trains).toBe(pending);
    game = advanceTrains(setTrainPaused(game, false), 200_000); expect(game.over).toBe(true);
  });
});

describe('score et progression', () => {
  it('continue après quatre fautes, puis compte tous les trains une seule fois', () => {
    let game = newTrainGame(1, { random: seeded(1) }); const target = destination(game.network, game.switches);
    const wrong = game.network.stations.find(s => s.id !== target.id)!.color.id;
    game = { ...game, schedule: game.schedule.map(s => ({ ...s, colorId: wrong })) };
    game = advanceTrains(game, 60_000); expect(game.errors).toBeGreaterThan(4); expect(game.over).toBe(false);
    game = advanceTrains(game, 120_000); expect(game.over).toBe(false);
    game = advanceTrains(game, 240_000); expect(game.over).toBe(true); expect(game.errors).toBe(game.schedule.length); expect(game.score).toBe(0);
  });
  it('donne seulement les points annoncés et refuse le double comptage', () => {
    expect(TRAIN_LEVELS.map(l => pointsPerTrain(l.stations))).toEqual([150, 175, 200, 225, 250, 275, 300, 325]);
    let score = recordDelivery(emptyTrainScore(), { trainId: 1, stationId: 0, correct: true, atMs: 1000 }, 4);
    expect(recordDelivery(score, { trainId: 1, stationId: 1, correct: false, atMs: 2000 }, 4)).toBe(score);
    score = recordDelivery(score, { trainId: 2, stationId: 1, correct: false, atMs: 3000 }, 4);
    expect(score.score).toBe(150); expect(score.correct).toBe(1); expect(score.errors).toBe(1);
  });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  afterEach(() => { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  function complete(level = 1, errors = 0) {
    const game = advanceTrains(newTrainGame(level), 240_000);
    return { ...game, errors, correct: game.deliveries.length - errors, score: (game.deliveries.length - errors) * pointsPerTrain(levelConfig(level).stations) };
  }
  it.each([0, 1, 2, 3, 4, 5])('débloque si et seulement si %s fautes sont au plus trois', errors => {
    expect(levelPassed(errors)).toBe(errors <= 3);
    const saved = finishTrainGame(emptyTrainProgress(), complete(1, errors), `game-${errors}`);
    expect(saved.result.passed).toBe(errors <= 3); expect(saved.progress.unlocked).toBe(errors <= 3 ? 2 : 1);
  });
  it('conserve les niveaux et records, et évite le double enregistrement', () => {
    let p = finishTrainGame(emptyTrainProgress(), complete(), 'one').progress; const best = p.best[1];
    p = finishTrainGame(p, complete(2), 'two').progress; p = finishTrainGame(p, complete(1, 6), 'fail').progress;
    expect(p.unlocked).toBe(3); expect(p.best[1]).toBe(best); expect(p.best[2]).toBeGreaterThan(0);
    expect(finishTrainGame(p, complete(), 'one').progress).toBe(p);
    expect(finishTrainGame({ ...p, unlocked: 8 }, complete(8), 'eight').progress.unlocked).toBe(8);
  });
  it('refuse une partie avant les dernières livraisons, même si le timer est à zéro', () => {
    const game = advanceTrains(newTrainGame(1, { random: seeded(1) }), 120_000);
    expect(() => finishTrainGame(emptyTrainProgress(), game, 'pending')).toThrow();
    expect(() => finishTrainGame(emptyTrainProgress(), newTrainGame(1), 'early')).toThrow();
    expect(() => finishTrainGame(emptyTrainProgress(), advanceTrains(game, 240_000), 'done')).not.toThrow();
  });
  it('sauvegarde sans modifier les anciens progrès de Déclic', () => {
    const data = new Map([['declic.progress.v1', 'memory-data']]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => data.get(k), setItem: (k: string, v: string) => data.set(k, v) } });
    const p = { ...finishTrainGame(emptyTrainProgress(), complete(), 'saved').progress, tutorialDone: true };
    expect(saveTrainProgress(p)).toBe(true); expect(loadTrainProgress()).toEqual(p); expect(data.get('declic.progress.v1')).toBe('memory-data');
    data.set(TRAIN_STORAGE_KEY, '{broken'); expect(loadTrainProgress()).toEqual(emptyTrainProgress());
  });
  it('fonctionne en mémoire quand le stockage est indisponible', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('unavailable'); } });
    expect(loadTrainProgress()).toEqual(emptyTrainProgress()); expect(saveTrainProgress(emptyTrainProgress())).toBe(false);
  });
});
