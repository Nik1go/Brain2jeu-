import { TRAIN_RULES } from './config';
import type { Delivery } from './scoring';
import type { TrainGame } from './simulation';

export function stationFeedback(game: Pick<TrainGame, 'elapsedMs' | 'deliveries'>, stationId: number): Delivery | undefined {
  return game.deliveries.reduce<Delivery | undefined>((latest, delivery) => {
    const age = game.elapsedMs - delivery.atMs, duration = delivery.correct ? TRAIN_RULES.feedbackMs : TRAIN_RULES.failureFeedbackMs;
    return delivery.stationId === stationId && age >= 0 && age < duration && (!latest || delivery.atMs >= latest.atMs) ? delivery : latest;
  }, undefined);
}

export function recentFailure(game: Pick<TrainGame, 'elapsedMs' | 'deliveries'>): Delivery | undefined {
  return game.deliveries.reduce<Delivery | undefined>((latest, delivery) => {
    const age = game.elapsedMs - delivery.atMs;
    return !delivery.correct && age >= 0 && age < TRAIN_RULES.failureFeedbackMs && (!latest || delivery.atMs >= latest.atMs) ? delivery : latest;
  }, undefined);
}

/** Do not replay old deliveries after a background catch-up. Errors take priority in a batch. */
export function deliveryCue(game: Pick<TrainGame, 'elapsedMs' | 'deliveries'>, fromIndex: number): 'success' | 'failure' | undefined {
  const fresh = game.deliveries.slice(fromIndex).filter(d => game.elapsedMs >= d.atMs && game.elapsedMs - d.atMs < (d.correct ? TRAIN_RULES.feedbackMs : TRAIN_RULES.failureFeedbackMs));
  return fresh.length ? fresh.some(d => !d.correct) ? 'failure' : 'success' : undefined;
}
