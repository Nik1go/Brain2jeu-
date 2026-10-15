import { TRAIN_RULES } from './config';
import type { Random } from './config';
import { curve, generateNetwork, JUNCTION_RADIUS, pathLength, piecePosition, positionOnRoute, RAIL_RADIUS, splitPath } from './network';
import type { EntryZone, Network, Target, TrackPiece } from './network';
import { emptyTrainScore, recordDelivery } from './scoring';
import type { TrainScore } from './scoring';
import { createSchedule } from './waves';
import type { Spawn } from './waves';
export interface MovingTrain { id: number; colorId: string; pieces: TrackPiece[]; distance: number; next: Target; activeJunction?: number }
export interface TrainGame extends TrainScore {
  network: Network; switches: boolean[]; schedule: Spawn[]; spawnIndex: number;
  trains: MovingTrain[]; elapsedMs: number; over: boolean; paused: boolean;
}
export function newTrainGame(level: number, options: { random?: Random; entryZone?: EntryZone; previousSignature?: string; previousColors?: string[] } = {}): TrainGame {
  const network = generateNetwork(level, options);
  return { ...emptyTrainScore(), network, switches: network.junctions.map(() => false), schedule: createSchedule(network, options.random, options.previousColors), spawnIndex: 0, trains: [], elapsedMs: 0, over: false, paused: false };
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
    while (train.distance >= length && train.next.kind === 'switch') {
      const junction = game.network.junctions[train.next.id];
      const route = game.switches[junction.id] ? junction.turn : junction.straight;
      train.pieces.push(...route.pieces); train.next = route.next; train.activeJunction = junction.id;
      length = pathLength(train.pieces);
    }
    if (train.distance >= length && train.next.kind === 'station') {
      const station = game.network.stations[train.next.id];
      score = recordDelivery(score, { trainId: train.id, stationId: station.id, correct: station.color.id === train.colorId, atMs: targetMs - (train.distance - length) / TRAIN_RULES.speed * 1000 }, game.network.stations.length);
    } else {
      if (train.activeJunction !== undefined) {
        const head = positionOnRoute(train.pieces, train.distance), center = game.network.junctions[train.activeJunction].point;
        if (Math.hypot(head.x - center.x, head.y - center.y) > JUNCTION_RADIUS + .01) train.activeJunction = undefined;
      }
      trains.push(train);
    }
  }
  return { ...game, score: score.score, correct: score.correct, errors: score.errors, deliveries: score.deliveries, trains, elapsedMs: targetMs };
}
/** Departures last 120 seconds. The clock then stays at zero while the last trains arrive. */
export function advanceTrains(game: TrainGame, elapsedMs: number): TrainGame {
  if (game.over || game.paused || !Number.isFinite(elapsedMs) || elapsedMs <= game.elapsedMs) return game;
  let next = game;
  while (next.spawnIndex < next.schedule.length && next.schedule[next.spawnIndex].atMs <= elapsedMs) {
    const spawn = next.schedule[next.spawnIndex];
    next = moveUntil(next, spawn.atMs);
    next = { ...next, spawnIndex: next.spawnIndex + 1, trains: [...next.trains, spawnTrain(next.network, spawn)] };
  }
  next = moveUntil(next, elapsedMs);
  const over = elapsedMs >= TRAIN_RULES.durationMs && next.spawnIndex === next.schedule.length && next.trains.length === 0;
  return { ...next, over, elapsedMs: over ? Math.max(TRAIN_RULES.durationMs, ...next.deliveries.map(d => d.atMs)) : elapsedMs };
}
export function toggleJunction(game: TrainGame, id: number, elapsedMs = game.elapsedMs): TrainGame {
  const next = advanceTrains(game, elapsedMs);
  if (next.over || next.paused || !next.network.junctions[id]) return next;
  const switches = next.switches.map((active, i) => i === id ? !active : active);
  const route = switches[id] ? next.network.junctions[id].turn : next.network.junctions[id].straight;
  const trains = next.trains.map(train => {
    if (train.activeJunction !== id) return train;
    const head = positionOnRoute(train.pieces, train.distance), center = next.network.junctions[id].point;
    if (Math.hypot(head.x - center.x, head.y - center.y) > JUNCTION_RADIUS + .01) return train;
    const travelled = splitPath(train.pieces, train.distance).before;
    const remainder = splitPath(route.pieces.slice(1), JUNCTION_RADIUS - RAIL_RADIUS + 1).after;
    const exit = piecePosition(remainder[0], 0), angle = head.angle * Math.PI / 180, exitAngle = exit.angle * Math.PI / 180;
    // Keep the head and its tangent exactly where they are; bend smoothly to the new exit.
    const connector = curve(head, { x: head.x + Math.cos(angle) * 8, y: head.y + Math.sin(angle) * 8 }, { x: exit.x - Math.cos(exitAngle) * 8, y: exit.y - Math.sin(exitAngle) * 8 }, exit);
    return { ...train, pieces: [...travelled, connector, ...remainder], distance: pathLength(travelled), next: route.next };
  });
  return { ...next, switches, trains };
}
export function setTrainPaused(game: TrainGame, paused: boolean, elapsedMs = game.elapsedMs): TrainGame {
  if (game.over || game.paused === paused) return game;
  return { ...(paused ? advanceTrains(game, elapsedMs) : game), paused };
}
