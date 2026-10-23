import { emptyProgress, parseProgress } from '../platform/storage';
import type { Progress, SavedResult } from '../platform/storage';
import { emptyTrainProgress, parseTrainProgress } from '../train/storage';
import type { TrainProgress } from '../train/storage';
import { emptyMathProgress, parseMathProgress } from '../math/storage';
import type { MathProgress } from '../math/storage';
import { BOARDS } from '../leaderboards/model';
import type { CompetitionUpdate } from '../leaderboards/model';
import type { PublicRecords } from '../friends/model';

export interface PlayerProgress { version: 1; mirror: Progress; train: TrainProgress; math: MathProgress }
export const emptyPlayerProgress = (): PlayerProgress => ({ version: 1, mirror: emptyProgress(), train: emptyTrainProgress(), math: emptyMathProgress() });
export const MAX_PAYLOAD_LENGTH = 150_000;

export function decodeProgress(payload: string | null): PlayerProgress {
  if (!payload) return emptyPlayerProgress();
  if (payload.length > MAX_PAYLOAD_LENGTH) throw new Error('progress/invalid-save');
  const value = JSON.parse(payload);
  // Never overwrite an unknown future save format with a blank current save.
  if (!value || value.version !== 1 || !value.mirror || value.mirror.version !== 1 || !value.train || value.train.version !== 1 || !value.math || value.math.version !== 1) throw new Error('progress/unsupported-version');
  return { version: 1, mirror: parseProgress(JSON.stringify(value.mirror) ?? null), train: parseTrainProgress(JSON.stringify(value.train) ?? null), math: parseMathProgress(JSON.stringify(value.math) ?? null) };
}

function records(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort((x, y) => Number(x) - Number(y)).map(key => [key, Math.max(a[key] ?? 0, b[key] ?? 0)]));
}
function best(a: number | null, b: number | null): number | null { return a === null && b === null ? null : Math.max(a ?? 0, b ?? 0); }
function history<T extends { id?: string; date: string }>(a: T[], b: T[]): T[] {
  const entries = new Map<string, T>();
  // Stable tie-breaking makes repeated merges converge even for duplicate IDs.
  for (const item of [...a, ...b].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))) {
    entries.set(item.id || JSON.stringify(item), item);
  }
  return [...entries.values()].sort((x, y) => Date.parse(x.date) - Date.parse(y.date) || (x.id || JSON.stringify(x)).localeCompare(y.id || JSON.stringify(y))).slice(-100);
}
export function mergeProgress(local: PlayerProgress, remote: PlayerProgress): PlayerProgress {
  const a = local.mirror, b = remote.mirror;
  const previous = a.previousLevelRecords || b.previousLevelRecords;
  const mirrorHistory = history<SavedResult>(a.history, b.history);
  const trainHistory = history(local.train.history, remote.train.history);
  const mathHistory = history(local.math.history, remote.math.history);
  const bestByLevel = { small: Math.max(local.math.bestByLevel.small, remote.math.bestByLevel.small), large: Math.max(local.math.bestByLevel.large, remote.math.bestByLevel.large), finance: Math.max(local.math.bestByLevel.finance, remote.math.bestByLevel.finance) };
  return {
    version: 1,
    mirror: { ...a, unlocked: Math.max(a.unlocked, b.unlocked), tutorialDone: a.tutorialDone || b.tutorialDone, survivalBest: best(a.survivalBest, b.survivalBest), challengeBest: records(a.challengeBest, b.challengeBest), legacyChallengeBest: records(a.legacyChallengeBest, b.legacyChallengeBest), previousLevelRecords: previous ? { survivalBest: best(a.previousLevelRecords?.survivalBest ?? null, b.previousLevelRecords?.survivalBest ?? null), challengeBest: records(a.previousLevelRecords?.challengeBest ?? {}, b.previousLevelRecords?.challengeBest ?? {}) } : null, history: mirrorHistory },
    train: { ...local.train, unlocked: Math.max(local.train.unlocked, remote.train.unlocked), tutorialDone: local.train.tutorialDone || remote.train.tutorialDone, best: records(local.train.best, remote.train.best), history: trainHistory },
    math: { version: 1, tutorialDone: local.math.tutorialDone || remote.math.tutorialDone, best: Math.max(...Object.values(bestByLevel)), bestByLevel, history: mathHistory },
  };
}
export function encodeCloudProgress(progress: PlayerProgress): string {
  // Sound and reduced motion are preferences of this device.
  const payload = JSON.stringify({ ...progress, mirror: { ...progress.mirror, sound: true, reducedMotion: false } });
  if (payload.length > MAX_PAYLOAD_LENGTH) throw new Error('progress/invalid-save');
  return payload;
}

// Recover only data already attributed to this UID. Aggregated Train/Challenge
// records do not identify a level and must never be assigned to an arbitrary one.
export function recoverSharedProgress(competition: CompetitionUpdate, publicRecords?: PublicRecords): PlayerProgress {
  const recovered = emptyPlayerProgress();
  const scores = competition.scores ?? {};
  recovered.train.unlocked = competition.trainProgress?.unlocked ?? 1;
  recovered.mirror.survivalBest = publicRecords?.mirrorSurvival ?? null;
  for (const board of BOARDS) {
    const score = scores[board.id];
    if (score === undefined) continue;
    if (board.id === 'mirror-survival-v2') recovered.mirror.survivalBest = best(recovered.mirror.survivalBest, score);
    if (board.id.startsWith('mirror-challenge-v2-l')) {
      const level = Number(board.id.split('-l')[1]);
      recovered.mirror.challengeBest[level] = score;
      recovered.mirror.unlocked = Math.max(recovered.mirror.unlocked, level);
    }
    if (board.game === 'train') {
      const level = Number(board.id.split('-l')[1]);
      recovered.train.best[level] = score;
      recovered.train.unlocked = Math.max(recovered.train.unlocked, level);
    }
  }
  for (const level of ['small', 'large', 'finance'] as const) {
    const key = { small: 'mathSmall', large: 'mathLarge', finance: 'mathFinance' } as const;
    recovered.math.bestByLevel[level] = Math.max(scores[`math-${level}-v1`] ?? 0, publicRecords?.[key[level]] ?? 0);
  }
  recovered.math.best = Math.max(...Object.values(recovered.math.bestByLevel));
  recovered.mirror.tutorialDone = recovered.mirror.survivalBest !== null || Object.keys(recovered.mirror.challengeBest).length > 0;
  recovered.train.tutorialDone = recovered.train.unlocked > 1 || Object.keys(recovered.train.best).length > 0;
  recovered.math.tutorialDone = recovered.math.best > 0;
  return recovered;
}
