import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../platform/storage';
import { emptyTrainProgress } from '../train/storage';
import { emptyMathProgress } from '../math/storage';
import { emptyRecords, friendshipId, localRecords, mergeRecords, pairMembers } from './model';

describe('friend identity and public scores', () => {
  it('uses one collision-free pair for both request directions, including custom UIDs', () => {
    expect(friendshipId('alice', 'bob')).toBe(friendshipId('bob', 'alice'));
    expect(pairMembers('bob', 'alice')).toEqual(['alice', 'bob']);
    expect(friendshipId('a_b', 'c')).not.toBe(friendshipId('a', 'b_c'));
    expect(friendshipId('a:b', 'c')).not.toBe(friendshipId('a', 'b:c'));
    expect(() => friendshipId('alice', 'alice')).toThrow();
    expect(() => friendshipId('alice', 'bad/uid')).toThrow();
  });
  it('merges independent device scores without losing better existing records', () => {
    expect(mergeRecords({ ...emptyRecords(), train: 750, mathSmall: 900 }, { train: 500, mathFinance: 300 })).toEqual({ ...emptyRecords(), train: 750, mathSmall: 900, mathFinance: 300 });
  });
  it('keeps unplayed distinct from a finished game with zero points', () => {
    expect(mergeRecords(emptyRecords(), { train: 0 }).train).toBe(0);
    expect(localRecords(emptyProgress(), emptyTrainProgress(), emptyMathProgress())).toEqual(emptyRecords());
    const math = emptyMathProgress();
    math.history.push({ id: 'zero', date: new Date().toISOString(), level: 'large', score: 0, correct: 0, answers: 1, durationMs: 5000 });
    expect(localRecords(emptyProgress(), emptyTrainProgress(), math).mathLarge).toBe(0);
  });
  it('only publishes finite bounded integers and known public fields', () => {
    for (const train of [-1, NaN, Infinity, 1.5, 1_000_000_001]) expect(mergeRecords(emptyRecords(), { train })).toEqual(emptyRecords());
    expect(mergeRecords(emptyRecords(), { email: 'private@example.test' } as never)).toEqual(emptyRecords());
  });
  it('summarizes current game records without publishing private histories or old mirror rules', () => {
    const mirror = emptyProgress(), train = emptyTrainProgress(), math = emptyMathProgress();
    mirror.challengeBest = { 1: 200, 4: 1200 }; mirror.survivalBest = 600;
    mirror.previousLevelRecords = { survivalBest: 20000, challengeBest: { 5: 50000 } };
    train.best = { 1: 400, 5: 1000 }; math.bestByLevel.finance = 300;
    expect(localRecords(mirror, train, math)).toEqual({ mirrorSurvival: 600, mirrorChallenge: 1200, train: 1000, mathSmall: null, mathLarge: null, mathFinance: 300 });
  });
});
