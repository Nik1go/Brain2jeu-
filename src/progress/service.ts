import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { playerDatabase } from '../auth/database';
import { BOARDS, mergeCompetition } from '../leaderboards/model';
import type { PublicRecords } from '../friends/model';
import { decodeProgress, encodeCloudProgress, mergeProgress, recoverSharedProgress } from './model';
import type { ProgressTransport } from './sync';

export function createProgressTransport(store: Firestore): ProgressTransport { return {
  watch(uid, next, error) {
    return onSnapshot(doc(store, 'users', uid, 'saves', 'progress'), { includeMetadataChanges: true }, snapshot => {
      if (!snapshot.exists() || snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
      try { next(decodeProgress(snapshot.data().payload)); } catch (cause) { error(cause); }
    }, error);
  },
  async merge(uid, incoming) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('progress/offline');
    const ref = doc(store, 'users', uid, 'saves', 'progress');
    return runTransaction(store, async tx => {
      const snapshot = await tx.get(ref);
      let remote = snapshot.exists() ? decodeProgress(snapshot.data().payload) : null;
      if (!remote) {
        // One-time recovery of pre-sync data already owned by this account.
        const profile = await tx.get(doc(store, 'publicProfiles', uid));
        const entries = await Promise.all(BOARDS.map(board => tx.get(doc(store, 'leaderboards', board.id, 'entries', uid))));
        const scores = Object.fromEntries(entries.flatMap((entry, i) => entry.exists() ? [[BOARDS[i].id, entry.data()!.score]] : []));
        remote = recoverSharedProgress(mergeCompetition({}, { scores, trainProgress: profile.data()?.trainProgress }), profile.data()?.records as PublicRecords | undefined);
      }
      const merged = mergeProgress(incoming, remote);
      const payload = encodeCloudProgress(merged);
      if (!snapshot.exists() || snapshot.data().payload !== payload) tx.set(ref, { version: 1, payload, updatedAt: serverTimestamp() });
      return merged;
    });
  },
}; }
export const progressTransport: ProgressTransport = {
  watch: (uid, next, error) => createProgressTransport(playerDatabase()).watch(uid, next, error),
  merge: (uid, incoming) => createProgressTransport(playerDatabase()).merge(uid, incoming),
};
