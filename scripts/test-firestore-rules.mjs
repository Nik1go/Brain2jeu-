import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { testFriends } from './test-friends-rules.mjs';

// This runner cannot reach production: it requires an explicit local emulator.
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) {
  throw new Error('Ce test nécessite les émulateurs Firestore et Auth sur 127.0.0.1.');
}
const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-brain2jeu',
  firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
});
let checks = 0;
async function succeeds(value) { await assertSucceeds(value); checks++; }
async function fails(value) { await assertFails(value); checks++; }
const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const guest = env.unauthenticatedContext().firestore();
function reserve(store, uid, username, extra = {}) {
  const batch = writeBatch(store);
  batch.set(doc(store, 'users', uid), { username, usernameKey: username.toLowerCase(), createdAt: serverTimestamp(), ...extra });
  batch.set(doc(store, 'usernames', username.toLowerCase()), { uid });
  return batch.commit();
}
try {
  await env.clearFirestore();
  await fails(getDocs(collection(guest, 'users')));
  await fails(getDoc(doc(guest, 'users', 'alice')));
  await fails(getDoc(doc(guest, 'usernames', 'alice')));
  await fails(reserve(guest, 'guest', 'Guest'));
  await succeeds(reserve(alice, 'alice', 'Alice'));
  await succeeds(getDoc(doc(alice, 'users', 'alice')));
  assert.equal((await getDoc(doc(alice, 'users', 'alice'))).data().username, 'Alice');
  await fails(getDoc(doc(bob, 'users', 'alice')));
  await fails(getDocs(collection(bob, 'users')));
  await fails(getDocs(collection(bob, 'usernames')));
  await succeeds(getDoc(doc(bob, 'usernames', 'alice')));
  await fails(reserve(bob, 'bob', 'ALICE'));
  await fails(reserve(bob, 'alice', 'Hijack'));
  await fails(setDoc(doc(bob, 'usernames', 'orphan'), { uid: 'bob' }));
  await fails(setDoc(doc(bob, 'users', 'bob'), { username: 'Bob', usernameKey: 'bob', createdAt: serverTimestamp() }));
  await fails(reserve(bob, 'bob', 'ValidBob', { isAdmin: true }));
  await fails(reserve(bob, 'bob', 'ValidBob', { username: 'x'.repeat(10000) }));
  await fails(reserve(bob, 'bob', 'ValidBob', { username: 42 }));
  await fails(reserve(bob, 'bob', 'ValidBob', { createdAt: Timestamp.fromMillis(0) }));
  await fails(reserve(bob, 'bob', 'ValidBob', { usernameKey: 'different' }));
  await fails(updateDoc(doc(alice, 'users', 'alice'), { username: 'x'.repeat(10000) }));
  await fails(updateDoc(doc(alice, 'users', 'alice'), { isAdmin: true }));
  await fails(updateDoc(doc(alice, 'users', 'alice'), { createdAt: serverTimestamp() }));
  await fails(setDoc(doc(alice, 'users', 'alice'), { username: 'Alice' }));
  await fails(updateDoc(doc(alice, 'usernames', 'alice'), { uid: 'bob' }));
  await fails(deleteDoc(doc(alice, 'usernames', 'alice')));
  await fails(deleteDoc(doc(alice, 'users', 'alice')));
  await fails(setDoc(doc(alice, 'users', 'alice', 'private', 'extra'), { value: 1 }));
  const results = await Promise.allSettled([reserve(bob, 'bob', 'Shared'), reserve(env.authenticatedContext('charlie').firestore(), 'charlie', 'SHARED')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'Un seul joueur peut réserver un pseudo concurrent'); checks++;
  await testFriends(env, succeeds, fails);
  console.log(`${checks} contrôles Firestore réussis : profils privés et publics, schéma strict, droits, timestamps, réservations atomiques, amis et concurrence.`);
  const app = initializeApp({ projectId: 'demo-brain2jeu', apiKey: 'demo-brain2jeu-key', appId: 'demo-brain2jeu-app' }, 'auth-integration-test');
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const store = getFirestore(app);
    connectFirestoreEmulator(store, host, Number(port));
    const email = `player-${Date.now()}@example.test`;
    const password = 'LocalTest_42!';
    const created = await createUserWithEmailAndPassword(auth, email, password);
    const uid = created.user.uid;
    await reserve(store, uid, 'EmulatorPlayer');
    assert.equal((await getDoc(doc(store, 'users', uid))).data().username, 'EmulatorPlayer');
    await signOut(auth);
    await assert.rejects(signInWithEmailAndPassword(auth, email, 'incorrect-password'));
    const restored = await signInWithEmailAndPassword(auth, email, password);
    assert.equal(restored.user.uid, uid);
    assert.equal((await getDoc(doc(store, 'users', uid))).data().username, 'EmulatorPlayer');
    await sendPasswordResetEmail(auth, email);
    await signOut(auth);
    console.log('Parcours Auth + Firestore réussi : inscription e-mail, profil privé, déconnexion, refus du mauvais mot de passe, reconnexion au même compte et demande de réinitialisation.');
  } finally { await deleteApp(app); }
} finally { await env.cleanup(); }
