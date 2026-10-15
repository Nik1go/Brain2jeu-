import { TRAIN_RULES } from './config';
import type { Random } from './config';
import { generateNetwork, pathLength } from './network';
import type { Network, Target, TrackPiece } from './network';
import { emptyTrainScore, recordDelivery } from './scoring';
import type { TrainScore } from './scoring';
import { createSchedule } from './waves';
import type { Spawn } from './waves';

export interface MovingTrain { id: number; colorId: string; pieces: TrackPiece[]; distance: number; next: Target }
export interface TrainGame extends TrainScore {
  network: Network; switches: boolean[]; schedule: Spawn[]; spawnIndex: number;
  trains: MovingTrain[]; elapsedMs: number; over: boolean;
}
export function newTrainGame(level: number, options: { random?: Random; previousSignature?: string; previousColors?: string[] } = {}): TrainGame {
  const network = generateNetwork(level, options);
  return { ...emptyTrainScore(), network, switches: network.junctions.map(() => false), schedule: createSchedule(network, options.random, options.previousColors), spawnIndex: 0, trains: [], elapsedMs: 0, over: false };
}
export function spawnTrain(network: Network, spawn: Spawn): MovingTrain {
  return { id: spawn.id, colorId: spawn.colorId, pieces: [...network.root.pieces], distance: 0, next: network.root.next };
}
function moveUntil(game: TrainGame, targetMs: number): TrainGame {
  const distance = (targetMs - game.elapsedMs) / 1000 * TRAIN_RULES.speed;
  let score: TrainScore = game;
  const trains: MovingTrain[] = [];
  for (const original of game.trains) {
    const train = { ...original, distance: original.distance + distance, pieces: [...original.pieces] };
    let length = pathLength(train.pieces);
    // A choice is captured on ENTERING the module, 18 units before its centre.
    while (train.distance >= length && train.next.kind === 'switch') {
      const junction = game.network.junctions[train.next.id];
      const route = game.switches[junction.id] ? junction.turn : junction.straight;
      train.pieces.push(...route.pieces);
      train.next = route.next;
      length = pathLength(train.pieces);
    }
    if (train.distance >= length && train.next.kind === 'station') {
      const station = game.network.stations[train.next.id];
      const atMs = targetMs - (train.distance - length) / TRAIN_RULES.speed * 1000;
      score = recordDelivery(score, { trainId: train.id, stationId: station.id, correct: station.color.id === train.colorId, atMs }, game.network.stations.length);
    } else trains.push(train);
  }
  return { ...game, score: score.score, correct: score.correct, errors: score.errors, deliveries: score.deliveries, trains, elapsedMs: targetMs };
}
/** Absolute elapsed time: missed frames/background tabs still deliver every scheduled train. */
export function advanceTrains(game: TrainGame, elapsedMs: number): TrainGame {
  if (game.over || elapsedMs <= game.elapsedMs) return game;
  const target = Math.min(TRAIN_RULES.durationMs, elapsedMs);
  let next = game;
  while (next.spawnIndex < next.schedule.length && next.schedule[next.spawnIndex].atMs <= target) {
    const spawn = next.schedule[next.spawnIndex];
    next = moveUntil(next, spawn.atMs);
    next = { ...next, spawnIndex: next.spawnIndex + 1, trains: [...next.trains, spawnTrain(next.network, spawn)] };
  }
  next = moveUntil(next, target);
  return { ...next, over: target === TRAIN_RULES.durationMs };
}
export function toggleJunction(game: TrainGame, id: number, elapsedMs = game.elapsedMs): TrainGame {
  const next = advanceTrains(game, elapsedMs);
  if (next.over || !next.network.junctions[id]) return next;
  return { ...next, switches: next.switches.map((active, i) => i === id ? !active : active) };
}
