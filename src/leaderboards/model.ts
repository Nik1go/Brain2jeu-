import { LEVELS } from '../game/engine';
import { MATH_LEVELS } from '../math/config';
import { TRAIN_LEVELS } from '../train/config';
import type { MathLevelId } from '../math/config';
import type { Progress } from '../platform/storage';
import type { MathProgress } from '../math/storage';
import type { TrainProgress } from '../train/storage';

export const BOARDS = [
  ...MATH_LEVELS.map(level => ({ id: `math-${level.id}-v1`, game: 'math', label: level.title })),
  { id: 'mirror-survival-v2', game: 'mirror', label: 'Survie' },
  ...LEVELS.map((_, i) => ({ id: `mirror-challenge-v2-l${i + 1}`, game: 'mirror', label: `Défi 90 s · Niveau ${i + 1}` })),
  ...TRAIN_LEVELS.map(level => ({ id: `train-v1-l${level.level}`, game: 'train', label: `Niveau ${level.level} · ${level.stations} gares` })),
] as const;
export type BoardId = string;
export type BoardGame = 'math' | 'mirror' | 'train';
export const mathBoard = (level: MathLevelId): BoardId => `math-${level}-v1`;
export const mirrorBoard = (mode: 'survival' | 'challenge', level: number): BoardId => mode === 'survival' ? 'mirror-survival-v2' : `mirror-challenge-v2-l${level}`;
export const trainBoard = (level: number): BoardId => `train-v1-l${level}`;
export interface SharedTrainProgress { unlocked: number; completed: number }
export interface CompetitionUpdate { scores?: Record<BoardId, number>; trainProgress?: SharedTrainProgress }
export interface LeaderboardEntry { uid: string; username: string; score: number }
export interface Standing { rank: number; total: number; below: number; percentile: number | null; topOnePercent: boolean }
const validScore = (score: unknown): score is number => typeof score === 'number' && Number.isSafeInteger(score) && score >= 0 && score <= 1_000_000_000;
export function mergeCompetition(current: CompetitionUpdate, incoming: CompetitionUpdate): CompetitionUpdate {
  const scores = { ...current.scores };
  for (const board of BOARDS) {
    const score = incoming.scores?.[board.id];
    if (validScore(score)) scores[board.id] = Math.max(scores[board.id] ?? 0, score);
  }
  const a = current.trainProgress, b = incoming.trainProgress;
  const validProgress = b && Number.isInteger(b.unlocked) && b.unlocked >= 1 && b.unlocked <= 8 && Number.isInteger(b.completed) && b.completed >= 0 && b.completed <= b.unlocked && (b.completed < b.unlocked || b.completed === 8);
  return { scores, ...((a || validProgress) ? { trainProgress: { unlocked: Math.max(a?.unlocked ?? 1, validProgress ? b.unlocked : 1), completed: Math.max(a?.completed ?? 0, validProgress ? b.completed : 0) } } : {}) };
}
export function localCompetition(mirror: Progress, train: TrainProgress, math: MathProgress): CompetitionUpdate {
  const scores: Record<string, number> = {};
  if (mirror.survivalBest !== null) scores[mirrorBoard('survival', 1)] = mirror.survivalBest;
  for (const [level, score] of Object.entries(mirror.challengeBest)) scores[mirrorBoard('challenge', Number(level))] = score;
  for (const [level, score] of Object.entries(train.best)) scores[trainBoard(Number(level))] = score;
  for (const level of MATH_LEVELS) if (math.bestByLevel[level.id] > 0 || math.history.some(h => h.level === level.id)) scores[mathBoard(level.id)] = math.bestByLevel[level.id];
  return mergeCompetition({}, { scores, trainProgress: { unlocked: train.unlocked, completed: Math.max(train.unlocked - 1, ...train.history.filter(h => h.passed).map(h => h.level)) } });
}
// Competition ranking: equal scores share a rank (1, 1, 3). Ties are never counted as beaten.
export function rankEntries(entries: LeaderboardEntry[]): (LeaderboardEntry & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.uid.localeCompare(b.uid));
  let rank = 1;
  return sorted.map((entry, i) => { if (i === 0 || entry.score !== sorted[i - 1].score) rank = i + 1; return { ...entry, rank }; });
}
export function standingFromCounts(total: number, ahead: number, below: number): Standing {
  const rank = ahead + 1;
  // The whole tied group must fit in the top 1%; a population tied at zero is not a top-1% achievement.
  return { rank, total, below, percentile: total > 1 ? Math.floor(below / (total - 1) * 1000) / 10 : null, topOnePercent: total >= 100 && (total - below) / total <= .01 };
}
export function standingText(standing: Standing): string {
  if (standing.topOnePercent) return `N° ${standing.rank.toLocaleString('fr-FR')} au classement mondial`;
  if (standing.percentile === null) return 'Premier joueur de ce classement';
  return `Meilleur que ${standing.percentile.toLocaleString('fr-FR')} % des autres joueurs`;
}
