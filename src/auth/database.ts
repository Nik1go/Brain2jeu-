import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { firebaseApp, useEmulators } from './firebase';

let database: Firestore | undefined;
export function playerDatabase(): Firestore {
  if (!firebaseApp) throw { code: 'firebase/not-configured' };
  if (!database) {
    database = getFirestore(firebaseApp, import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)');
    if (useEmulators) connectFirestoreEmulator(database, '127.0.0.1', 8080);
  }
  return database;
}
