import { describe, expect, it } from 'vitest';
import { emptyMathProgress } from '../math/storage';
import { emptyProgress } from '../platform/storage';
import { emptyTrainProgress } from '../train/storage';
import { BOARDS, localCompetition, mathBoard, mergeCompetition, mirrorBoard, rankEntries, standingFromCounts, standingText, trainBoard } from './model';

describe('classements comparables et percentiles', () => {
  it('sépare chaque jeu, règle, mode et niveau', () => {
    expect(new Set(BOARDS.map(b => b.id)).size).toBe(29);
    expect(mathBoard('small')).not.toBe(mathBoard('large'));
    expect(mirrorBoard('survival', 10)).toBe(mirrorBoard('survival', 1));
    expect(mirrorBoard('challenge', 1)).not.toBe(mirrorBoard('challenge', 2));
    expect(trainBoard(1)).not.toBe(trainBoard(8));
  });
  it('classe les ex æquo ensemble, sans muter les données', () => {
    const entries = [{ uid: 'a', username: 'Alice', score: 100 }, { uid: 'b', username: 'Bob', score: 300 }, { uid: 'c', username: 'Chloe', score: 300 }, { uid: 'd', username: 'Dan', score: 0 }];
    expect(rankEntries(entries).map(e => [e.uid, e.rank])).toEqual([['b', 1], ['c', 1], ['a', 3], ['d', 4]]);
    expect(entries[0].uid).toBe('a');
  });
  it('compte uniquement les autres joueurs strictement battus', () => {
    expect(standingFromCounts(5, 1, 2)).toMatchObject({ rank: 2, percentile: 50, topOnePercent: false });
    expect(standingFromCounts(4, 0, 0).percentile).toBe(0);
    expect(standingFromCounts(4, 0, 3).percentile).toBe(100);
    expect(standingFromCounts(4, 3, 0).percentile).toBe(0);
    expect(standingFromCounts(4, 1, 1).percentile).toBe(33.3);
  });
  it('ne fabrique aucun pourcentage quand on joue seul', () => {
    expect(standingFromCounts(1, 0, 0).percentile).toBeNull();
    expect(standingText(standingFromCounts(1, 0, 0))).toBe('Premier joueur de ce classement');
  });
  it('affiche le rang mondial dès le top 1 % exact, sans arrondi trompeur', () => {
    expect(standingFromCounts(99, 0, 98).topOnePercent).toBe(false);
    expect(standingText(standingFromCounts(100, 0, 99))).toContain('N° 1 au classement mondial');
    expect(standingFromCounts(1000, 9, 990).topOnePercent).toBe(true);
    expect(standingFromCounts(1000, 10, 989).topOnePercent).toBe(false);
    expect(standingFromCounts(1000, 0, 0).topOnePercent).toBe(false);
    expect(standingFromCounts(1000, 9, 989).topOnePercent).toBe(false); // Two tied at the tenth place span the threshold.
    expect(standingText(standingFromCounts(1000, 10, 989))).toContain('Meilleur que');
  });
  it('importe les records actuels par niveau et distingue zéro de jamais joué', () => {
    const mirror = emptyProgress(), math = emptyMathProgress(), train = emptyTrainProgress();
    expect(localCompetition(mirror, train, math).scores).toEqual({});
    mirror.survivalBest = 0; mirror.challengeBest = { 1: 100, 8: 1500 };
    mirror.previousLevelRecords = { survivalBest: 99999, challengeBest: { 1: 99999 } };
    mirror.legacyChallengeBest = { 3: 99999 };
    train.best = { 1: 0, 4: 1500 }; train.unlocked = 5;
    math.history.push({ id: 'zero', date: new Date().toISOString(), level: 'small', score: 0, answers: 1, correct: 0, durationMs: 5000 });
    expect(localCompetition(mirror, train, math)).toEqual({ scores: { 'mirror-survival-v2': 0, 'mirror-challenge-v2-l1': 100, 'mirror-challenge-v2-l8': 1500, 'math-small-v1': 0, 'train-v1-l1': 0, 'train-v1-l4': 1500 }, trainProgress: { unlocked: 5, completed: 4 } });
  });
  it('préserve les records et la progression de plusieurs appareils', () => {
    expect(mergeCompetition({ scores: { 'math-small-v1': 500 }, trainProgress: { unlocked: 8, completed: 8 } }, { scores: { 'math-small-v1': 100, 'mirror-survival-v2': 400 }, trainProgress: { unlocked: 2, completed: 1 } })).toEqual({ scores: { 'math-small-v1': 500, 'mirror-survival-v2': 400 }, trainProgress: { unlocked: 8, completed: 8 } });
  });
  it('refuse les champs et valeurs invalides, y compris une progression incohérente', () => {
    expect(mergeCompetition({}, { scores: { unknown: 100, 'math-small-v1': -1, 'math-large-v1': 1.5, 'math-finance-v1': NaN, 'train-v1-l1': 1000000001 }, trainProgress: { unlocked: 3, completed: 3 } })).toEqual({ scores: {} });
    expect(mergeCompetition({}, { trainProgress: { unlocked: 9, completed: 8 } })).toEqual({ scores: {} });
  });
});
