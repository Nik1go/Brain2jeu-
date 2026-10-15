import type { MathGame } from './game';
import type { MathScore } from './scoring';
import { isMathLevel, MATH_LEVELS, MATH_RULES } from './config';
import type { MathLevelId } from './config';

export const MATH_STORAGE_KEY = 'declic.calcul-mental.v1';
export interface MathResult extends MathScore { id: string; date: string; durationMs: number; level: MathLevelId }
export interface MathProgress { version: 1; tutorialDone: boolean; best: number; bestByLevel: Record<MathLevelId, number>; history: MathResult[] }
export const emptyMathProgress = (): MathProgress => ({ version: 1, tutorialDone: false, best: 0, bestByLevel: { small: 0, large: 0, finance: 0 }, history: [] });
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function loadMathProgress(): MathProgress {
  try {
    const p = JSON.parse(localStorage.getItem(MATH_STORAGE_KEY) ?? 'null');
    if (!p || p.version !== 1) return emptyMathProgress();
    const history: MathResult[] = Array.isArray(p.history) ? p.history.filter((h: MathResult) => h && typeof h.id === 'string' && typeof h.date === 'string' && Number.isFinite(Date.parse(h.date)) && integer(h.correct) && integer(h.answers) && h.correct <= h.answers && integer(h.score) && h.score === h.correct * MATH_RULES.points && typeof h.durationMs === 'number' && Number.isFinite(h.durationMs) && h.durationMs >= 0 && (h.level === undefined || isMathLevel(h.level))).slice(-100).map((h: MathResult) => ({ ...h, level: h.level ?? 'small' })) : [];
    const bestByLevel = { ...emptyMathProgress().bestByLevel };
    for (const { id } of MATH_LEVELS) {
      // Migrate the original game's record to Petits nombres without losing old history.
      const saved = p.bestByLevel?.[id] ?? (id === 'small' && !p.bestByLevel ? p.best : 0);
      bestByLevel[id] = Math.max(integer(saved) ? saved : 0, ...history.filter(h => h.level === id).map(h => h.score));
    }
    return { version: 1, tutorialDone: p.tutorialDone === true, best: Math.max(...Object.values(bestByLevel)), bestByLevel, history };
  } catch { return emptyMathProgress(); }
}
export function saveMathProgress(progress: MathProgress): boolean {
  try { localStorage.setItem(MATH_STORAGE_KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
export function finishMathGame(progress: MathProgress, game: MathGame, id: string): { progress: MathProgress; result: MathResult; newRecord: boolean } {
  if (game.phase !== 'over' || game.endedAt === undefined) throw new Error('Only finished math games can be saved');
  const existing = progress.history.find(h => h.id === id);
  if (existing) return { progress, result: existing, newRecord: false };
  const result: MathResult = { id, date: new Date().toISOString(), level: game.level, score: game.score, correct: game.correct, answers: game.answers, durationMs: Math.max(0, game.endedAt - game.clock.startedAt) };
  return { result, newRecord: result.score > progress.bestByLevel[game.level], progress: { ...progress, best: Math.max(progress.best, result.score), bestByLevel: { ...progress.bestByLevel, [game.level]: Math.max(progress.bestByLevel[game.level], result.score) }, history: [...progress.history, result].slice(-100) } };
}
