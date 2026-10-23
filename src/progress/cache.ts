import { loadProgress, saveProgress } from '../platform/storage';
import { loadTrainProgress, saveTrainProgress } from '../train/storage';
import { loadMathProgress, saveMathProgress } from '../math/storage';
import { decodeProgress, emptyPlayerProgress } from './model';
import type { PlayerProgress } from './model';

export const progressCacheKey = (uid: string) => `brain2jeu.account-progress.v1:${encodeURIComponent(uid)}`;
export const loadGuestProgress = (): PlayerProgress => ({ version: 1, mirror: loadProgress(), train: loadTrainProgress(), math: loadMathProgress() });
export function loadPlayerProgress(uid?: string): PlayerProgress {
  if (!uid) return loadGuestProgress();
  try { return decodeProgress(localStorage.getItem(progressCacheKey(uid))); } catch { return emptyPlayerProgress(); }
}
export function savePlayerProgress(progress: PlayerProgress, uid?: string): boolean {
  if (!uid) {
    const results = [saveProgress(progress.mirror), saveTrainProgress(progress.train), saveMathProgress(progress.math)];
    return results.every(Boolean);
  }
  try { localStorage.setItem(progressCacheKey(uid), JSON.stringify(progress)); return true; } catch { return false; }
}
export function hasGuestProgress(): boolean {
  const { mirror, train, math } = loadGuestProgress();
  return mirror.unlocked > 1 || train.unlocked > 1 || mirror.tutorialDone || train.tutorialDone || math.tutorialDone || mirror.survivalBest !== null || Object.keys(mirror.challengeBest).length > 0 || Object.keys(train.best).length > 0 || math.best > 0 || !!(mirror.history.length + train.history.length + math.history.length);
}
