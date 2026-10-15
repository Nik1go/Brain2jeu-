import { describe, expect, it } from 'vitest';
import { TRAIN_RULES } from './config';
import { deliveryCue, stationFeedback } from './feedback';
import type { Delivery } from './scoring';

const bad: Delivery = { trainId: 1, stationId: 0, correct: false, atMs: 1000 };
const good: Delivery = { trainId: 2, stationId: 1, correct: true, atMs: 1100 };
describe('retour immédiat sur une erreur', () => {
  it('garde la croix sur la gare concernée si une bonne arrivée se produit ailleurs', () => {
    const latest = { ...bad, trainId: 3, atMs: 1150 };
    expect(stationFeedback({ elapsedMs: 1200, deliveries: [latest, bad, good] }, 0)).toBe(latest);
  });
  it('retire le retour à sa limite exacte et ignore les événements futurs', () => {
    expect(stationFeedback({ elapsedMs: bad.atMs + TRAIN_RULES.failureFeedbackMs - 1, deliveries: [bad] }, 0)).toBe(bad);
    expect(stationFeedback({ elapsedMs: bad.atMs + TRAIN_RULES.failureFeedbackMs, deliveries: [bad] }, 0)).toBeUndefined();
    expect(stationFeedback({ elapsedMs: 900, deliveries: [bad] }, 0)).toBeUndefined();
  });
  it('donne la priorité au son d’erreur dans un groupe d’arrivées', () => {
    const game = { elapsedMs: 1200, deliveries: [bad, good] };
    expect(deliveryCue(game, 0)).toBe('failure');
    expect(deliveryCue(game, 1)).toBe('success');
    expect(deliveryCue(game, 2)).toBeUndefined();
  });
  it('ne rejoue aucun son après le rattrapage d’un onglet resté en arrière-plan', () => {
    const game = { elapsedMs: 30_000, deliveries: [bad, good] };
    expect(deliveryCue(game, 0)).toBeUndefined(); expect(stationFeedback(game, 0)).toBeUndefined();
  });
  it('garde l’erreur locale plus longtemps et choisit l’arrivée la plus récente de chaque gare', () => {
    expect(stationFeedback({ elapsedMs: 2000, deliveries: [bad, good] }, 0)).toBe(bad);
    expect(stationFeedback({ elapsedMs: 2000, deliveries: [bad, good] }, 1)).toBeUndefined();
    const arrived = { ...good, stationId: 0 };
    expect(stationFeedback({ elapsedMs: 1200, deliveries: [arrived, bad] }, 0)).toBe(arrived);
  });
});
