import type { User } from 'firebase/auth';
import { updateProfile } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { playerDatabase as db } from './database';
import { usernameKey, validUsername } from './identity';

export interface PlayerProfile {
  username: string;
  usernameKey: string;
  createdAt: Timestamp;
}

export function watchProfile(uid: string, next: (profile: PlayerProfile | null) => void, error: (cause: unknown) => void) {
  // Realtime is needed here: finishing onboarding must update the auth gate immediately.
  return onSnapshot(doc(db(), 'users', uid), { includeMetadataChanges: true }, snapshot => {
    if (!snapshot.exists() && snapshot.metadata.fromCache) return;
    next(snapshot.exists() ? snapshot.data() as PlayerProfile : null);
  }, error);
}

export async function claimUsername(user: User, value: string): Promise<void> {
  const username = value.trim();
  if (!validUsername(username)) throw { code: 'username/invalid' };
  const key = usernameKey(username);
  const store = db();
  const player = doc(store, 'users', user.uid);
  const reservation = doc(store, 'usernames', key);
  const chosenName = await runTransaction(store, async transaction => {
    const existing = await transaction.get(player);
    if (existing.exists()) return String(existing.data().username);
    const taken = await transaction.get(reservation);
    if (taken.exists()) throw { code: 'username/taken' };
    transaction.set(reservation, { uid: user.uid });
    transaction.set(player, { username, usernameKey: key, createdAt: serverTimestamp() });
    return username;
  });
  // Firestore is authoritative; a cosmetic Auth display name failure must not lose onboarding.
  await updateProfile(user, { displayName: chosenName }).catch(() => {});
}
