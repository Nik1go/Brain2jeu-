import { TRAIN_LEVELS, TRAIN_RULES } from './config';
import { levelPassed } from './scoring';
import type { TrainGame } from './simulation';

export const TRAIN_STORAGE_KEY = 'declic.petit-train.v1';
export interface TrainResult { id: string; date: string; level: number; score: number; correct: number; delivered: number; errors: number; passed: boolean }
export interface TrainProgress { version: 1; unlocked: number; tutorialDone: boolean; best: Record<string, number>; history: TrainResult[] }
export const emptyTrainProgress = (): TrainProgress => ({ version: 1, unlocked: 1, tutorialDone: false, best: {}, history: [] });
const validScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isInteger(v);
export function loadTrainProgress(): TrainProgress {
  try {
    const p = JSON.parse(localStorage.getItem(TRAIN_STORAGE_KEY) ?? 'null');
    if (!p || p.version !== 1) return emptyTrainProgress();
    const best = Object.fromEntries(Object.entries(p.best && typeof p.best === 'object' ? p.best : {}).filter(([k, v]) => Number.isInteger(Number(k)) && Number(k) >= 1 && Number(k) <= TRAIN_LEVELS.length && validScore(v)));
    return { version: 1, unlocked: Number.isInteger(p.unlocked) ? Math.max(1, Math.min(TRAIN_LEVELS.length, p.unlocked)) : 1, tutorialDone: p.tutorialDone === true, best: best as Record<string, number>, history: Array.isArray(p.history) ? p.history.filter((h: TrainResult) => h && typeof h.id === 'string' && typeof h.date === 'string' && Number.isFinite(Date.parse(h.date)) && Number.isInteger(h.level) && h.level >= 1 && h.level <= TRAIN_LEVELS.length && validScore(h.score) && validScore(h.correct) && validScore(h.delivered) && validScore(h.errors) && h.correct + h.errors === h.delivered && h.passed === levelPassed(h.errors)).slice(-100) : [] };
  } catch { return emptyTrainProgress(); }
}
export function saveTrainProgress(progress: TrainProgress): boolean {
  try { localStorage.setItem(TRAIN_STORAGE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
export function finishTrainGame(progress: TrainProgress, game: TrainGame, id: string): { progress: TrainProgress; result: TrainResult; newRecord: boolean } {
  if (!game.over || game.elapsedMs < TRAIN_RULES.durationMs || game.trains.length || game.deliveries.length !== game.schedule.length) throw new Error('Only complete, fully delivered train games can be recorded.');
  const existing = progress.history.find(h => h.id === id);
  if (existing) return { progress, result: existing, newRecord: false };
  const level = game.network.level, passed = levelPassed(game.errors);
  const result: TrainResult = { id, date: new Date().toISOString(), level, score: game.score, correct: game.correct, delivered: game.deliveries.length, errors: game.errors, passed };
  return {
    result, newRecord: game.score > (progress.best[level] ?? -1),
    progress: { ...progress, unlocked: Math.max(progress.unlocked, passed ? Math.min(TRAIN_LEVELS.length, level + 1) : level), best: { ...progress.best, [level]: Math.max(progress.best[level] ?? 0, game.score) }, history: [...progress.history, result].slice(-100) },
  };
}
