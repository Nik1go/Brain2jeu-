import type { Timestamp } from 'firebase/firestore';
import type { Progress } from '../platform/storage';
import type { TrainProgress } from '../train/storage';
import type { MathProgress } from '../math/storage';

export const RECORD_LABELS = {
  mirrorSurvival: 'Miroirs cachés · Survie', mirrorChallenge: 'Miroirs cachés · Défi',
  train: 'Petit train', mathSmall: 'Calcul mental · Petits nombres',
  mathLarge: 'Calcul mental · Grands calculs', mathFinance: 'Calcul mental · Finance',
} as const;
export type RecordKey = keyof typeof RECORD_LABELS;
export type PublicRecords = Record<RecordKey, number | null>;
export interface PublicProfile { uid: string; username: string; usernameKey: string; records: PublicRecords; updatedAt: Timestamp | null }
export interface Friendship { id: string; members: [string, string]; from: string; to: string; status: 'pending' | 'accepted'; createdAt: Timestamp; updatedAt: Timestamp }
export const emptyRecords = (): PublicRecords => ({ mirrorSurvival: null, mirrorChallenge: null, train: null, mathSmall: null, mathLarge: null, mathFinance: null });
export const mathRecordKey = (level: 'small' | 'large' | 'finance'): RecordKey => ({ small: 'mathSmall', large: 'mathLarge', finance: 'mathFinance' })[level] as RecordKey;

export function pairMembers(first: string, second: string): [string, string] {
  if (!first || !second || first === second || [first, second].some(uid => uid.length > 128 || uid.includes('/'))) throw new Error('friends/invalid-pair');
  return first < second ? [first, second] : [second, first];
}
export function friendshipId(first: string, second: string): string {
  const [a, b] = pairMembers(first, second);
  // Length prefixes also work for custom Auth UIDs containing underscores or separators.
  return `${a.length}:${a}${b.length}:${b}`;
}
export function mergeRecords(current: PublicRecords, incoming: Partial<PublicRecords>): PublicRecords {
  const records = { ...current };
  for (const key of Object.keys(RECORD_LABELS) as RecordKey[]) {
    const score = incoming[key];
    if (typeof score === 'number' && Number.isSafeInteger(score) && score >= 0 && score <= 1_000_000_000) records[key] = Math.max(current[key] ?? 0, score);
  }
  return records;
}
export function localRecords(mirror: Progress, train: TrainProgress, math: MathProgress): PublicRecords {
  const best = (values: number[]) => values.length ? Math.max(...values) : null;
  return mergeRecords(emptyRecords(), {
    mirrorSurvival: mirror.survivalBest, mirrorChallenge: best(Object.values(mirror.challengeBest)), train: best(Object.values(train.best)),
    ...Object.fromEntries((['small', 'large', 'finance'] as const).map(level => [mathRecordKey(level), math.bestByLevel[level] > 0 || math.history.some(h => h.level === level) ? math.bestByLevel[level] : null])),
  });
}
export function friendError(cause: unknown): string {
  const code = (cause as { code?: string })?.code || (cause instanceof Error ? cause.message : '');
  if (code === 'friends/incoming') return 'Ce joueur t’a déjà envoyé une demande. Tu peux l’accepter dans les demandes reçues.';
  if (code === 'friends/stale') return 'Cette demande a changé. La liste va se mettre à jour.';
  if (code === 'friends/unavailable') return 'Ce profil est indisponible pour le moment.';
  if (code === 'permission-denied') return 'L’accès a été refusé. Réessaie après t’être reconnecté.';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'Connexion indisponible. Vérifie ta connexion et réessaie.';
  return 'Impossible de terminer cette action. Réessaie dans un instant.';
}
