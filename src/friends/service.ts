import { collection, doc, endAt, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, startAt, where } from 'firebase/firestore';
import { playerDatabase } from '../auth/database';
import { usernameKey } from '../auth/identity';
import type { PlayerProfile } from '../auth/profiles';
import { emptyRecords, friendshipId, mergeRecords, pairMembers } from './model';
import type { Friendship, PublicProfile, PublicRecords } from './model';
import { mergeCompetition } from '../leaderboards/model';
import type { CompetitionUpdate } from '../leaderboards/model';

export async function publishRecords(uid: string, profile: Pick<PlayerProfile, 'username' | 'usernameKey'>, incoming: Partial<PublicRecords> = {}, competition: CompetitionUpdate = {}): Promise<void> {
  const store = playerDatabase(), ref = doc(store, 'publicProfiles', uid);
  const sanitized = mergeCompetition({}, competition);
  await runTransaction(store, async tx => {
    const previous = await tx.get(ref);
    const current = previous.exists() ? previous.data().records as PublicRecords : emptyRecords();
    const records = mergeRecords(current, incoming);
    // Existing account-owned records with an unambiguous mode can join the new boards.
    // The old aggregated Challenge and Train records cannot identify their level.
    const knownScores = Object.fromEntries(([
      ['mirror-survival-v2', records.mirrorSurvival], ['math-small-v1', records.mathSmall],
      ['math-large-v1', records.mathLarge], ['math-finance-v1', records.mathFinance],
    ] as const).flatMap(([board, score]) => score === null ? [] : [[board, score]]));
    const updates = Object.entries(mergeCompetition({ scores: knownScores }, sanitized).scores ?? {});
    // Read all documents before writing. A transaction merges simultaneous records from other devices.
    const entries = await Promise.all(updates.map(([board]) => tx.get(doc(store, 'leaderboards', board, 'entries', uid))));
    const oldProgress = previous.data()?.trainProgress;
    const trainProgress = mergeCompetition({ trainProgress: oldProgress }, sanitized).trainProgress;
    const improved = updates.some(([, score], i) => !entries[i].exists() || score > entries[i].data()!.score);
    if (!previous.exists() || improved || JSON.stringify(records) !== JSON.stringify(current) || JSON.stringify(trainProgress) !== JSON.stringify(oldProgress)) {
      tx.set(ref, { username: profile.username, usernameKey: profile.usernameKey, records, ...(trainProgress ? { trainProgress } : {}), updatedAt: serverTimestamp() });
    }
    updates.forEach(([board, score], i) => {
      if (!entries[i].exists() || score > entries[i].data()!.score) tx.set(doc(store, 'leaderboards', board, 'entries', uid), { username: profile.username, score, updatedAt: serverTimestamp() });
    });
  });
}
export async function searchPlayers(value: string): Promise<PublicProfile[]> {
  const key = usernameKey(value);
  if (!/^[a-z0-9_]{3,20}$/.test(key)) return [];
  const results = await getDocs(query(collection(playerDatabase(), 'publicProfiles'), orderBy('usernameKey'), startAt(key), endAt(key + '\uf8ff'), limit(12)));
  return results.docs.map(snapshot => ({ ...snapshot.data(), uid: snapshot.id } as PublicProfile));
}
export function watchPublicProfile(uid: string, next: (profile: PublicProfile | null) => void, error: (cause: unknown) => void) {
  return onSnapshot(doc(playerDatabase(), 'publicProfiles', uid), snapshot => {
    next(snapshot.exists() ? { ...snapshot.data(), uid: snapshot.id } as PublicProfile : null);
  }, error);
}
export async function readPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snapshot = await getDoc(doc(playerDatabase(), 'publicProfiles', uid));
  return snapshot.exists() ? { ...snapshot.data(), uid: snapshot.id } as PublicProfile : null;
}
export function watchFriendships(uid: string, next: (friends: Friendship[]) => void, error: (cause: unknown) => void) {
  return onSnapshot(query(collection(playerDatabase(), 'friendships'), where('members', 'array-contains', uid)), snapshot => {
    next(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as Friendship)));
  }, error);
}
export async function requestFriend(uid: string, other: string): Promise<void> {
  const store = playerDatabase(), ref = doc(store, 'friendships', friendshipId(uid, other));
  await runTransaction(store, async tx => {
    const [previous, target] = await Promise.all([tx.get(ref), tx.get(doc(store, 'publicProfiles', other))]);
    if (!target.exists()) throw new Error('friends/unavailable');
    if (previous.exists()) {
      if (previous.data().status === 'pending' && previous.data().to === uid) throw new Error('friends/incoming');
      return; // Double clicks cannot create duplicate or reverse requests.
    }
    tx.set(ref, { members: pairMembers(uid, other), from: uid, to: other, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
}
export async function acceptFriend(uid: string, id: string): Promise<void> {
  const store = playerDatabase(), ref = doc(store, 'friendships', id);
  await runTransaction(store, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists() || snapshot.data().to !== uid || snapshot.data().status !== 'pending') throw new Error('friends/stale');
    tx.update(ref, { status: 'accepted', updatedAt: serverTimestamp() });
  });
}
export async function removeFriend(uid: string, id: string): Promise<void> {
  const store = playerDatabase(), ref = doc(store, 'friendships', id);
  await runTransaction(store, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return;
    if (!snapshot.data().members.includes(uid)) throw new Error('friends/stale');
    tx.delete(ref);
  });
}
