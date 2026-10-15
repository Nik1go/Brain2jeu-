import { TRAIN_RULES } from './config';
export interface Delivery { trainId: number; stationId: number; correct: boolean; atMs: number }
export interface TrainScore { score: number; correct: number; errors: number; deliveries: Delivery[] }
export const emptyTrainScore = (): TrainScore => ({ score: 0, correct: 0, errors: 0, deliveries: [] });
export const pointsPerTrain = (stationCount: number) => 100 + 25 * (stationCount - 2);
export const levelPassed = (errors: number) => errors <= TRAIN_RULES.maxErrors;
export function recordDelivery(score: TrainScore, delivery: Delivery, stationCount: number): TrainScore {
  if (score.deliveries.some(d => d.trainId === delivery.trainId)) return score;
  return { score: score.score + (delivery.correct ? pointsPerTrain(stationCount) : 0), correct: score.correct + Number(delivery.correct), errors: score.errors + Number(!delivery.correct), deliveries: [...score.deliveries, delivery] };
}
