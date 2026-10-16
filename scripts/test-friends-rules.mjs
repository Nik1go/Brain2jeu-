import assert from 'node:assert/strict';
import { collection, deleteDoc, deleteField, doc, endAt, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAt, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';

export async function testFriends(env, succeeds, fails) {
  const alice = env.authenticatedContext('social-alice').firestore();
  const bob = env.authenticatedContext('social-bob').firestore();
  const charlie = env.authenticatedContext('social-charlie').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const records = { mirrorSurvival: null, mirrorChallenge: null, train: null, mathSmall: null, mathLarge: null, mathFinance: null };
  const profiles = [ [alice, 'social-alice', 'SocialAlice'], [bob, 'social-bob', 'SocialBob'], [charlie, 'social-charlie', 'SocialCharlie'] ];
  const pub = (username, extra = {}) => ({ username, usernameKey: username.toLowerCase(), records, updatedAt: serverTimestamp(), ...extra });
  for (const [store, uid, username] of profiles) {
    const batch = writeBatch(store);
    batch.set(doc(store, 'users', uid), { username, usernameKey: username.toLowerCase(), createdAt: serverTimestamp() });
    batch.set(doc(store, 'usernames', username.toLowerCase()), { uid });
    await succeeds(batch.commit());
  }
  await fails(setDoc(doc(guest, 'publicProfiles', 'social-alice'), pub('SocialAlice')));
  await fails(setDoc(doc(bob, 'publicProfiles', 'social-alice'), pub('SocialAlice')));
  await fails(setDoc(doc(alice, 'publicProfiles', 'social-alice'), pub('SocialBob')));
  await fails(setDoc(doc(alice, 'publicProfiles', 'social-alice'), pub('SocialAlice', { email: 'private@example.test' })));
  await fails(setDoc(doc(alice, 'publicProfiles', 'social-alice'), pub('SocialAlice', { records: {} })));
  for (const [store, uid, username] of profiles) await succeeds(setDoc(doc(store, 'publicProfiles', uid), pub(username)));
  const publicAlice = doc(alice, 'publicProfiles', 'social-alice');
  await fails(getDoc(doc(guest, 'publicProfiles', 'social-alice')));
  await fails(getDocs(query(collection(guest, 'publicProfiles'), limit(12))));
  await succeeds(getDoc(doc(bob, 'publicProfiles', 'social-alice')));
  await fails(getDoc(doc(bob, 'users', 'social-alice')));
  await fails(getDocs(collection(bob, 'publicProfiles')));
  await fails(getDocs(query(collection(bob, 'publicProfiles'), limit(21))));
  const search = query(collection(bob, 'publicProfiles'), orderBy('usernameKey'), startAt('social'), endAt('social\uf8ff'), limit(12));
  await succeeds(getDocs(search)); assert.equal((await getDocs(search)).size, 3);
  for (const patch of [ { email: 'leak' }, { username: 'x'.repeat(10000) }, { usernameKey: 42 }, { records: deleteField() }, { updatedAt: Timestamp.fromMillis(0) } ]) await fails(updateDoc(publicAlice, { ...patch, ...(patch.updatedAt ? {} : { updatedAt: serverTimestamp() }) }));
  for (const score of [-1, 1.5, '100', 1000000001, NaN]) await fails(updateDoc(publicAlice, { 'records.train': score, updatedAt: serverTimestamp() }));
  await fails(updateDoc(publicAlice, { 'records.isAdmin': true, updatedAt: serverTimestamp() }));
  await succeeds(updateDoc(publicAlice, { 'records.train': 500, updatedAt: serverTimestamp() }));
  await fails(updateDoc(publicAlice, { 'records.train': 400, updatedAt: serverTimestamp() }));
  await fails(updateDoc(publicAlice, { 'records.train': null, updatedAt: serverTimestamp() }));
  await fails(updateDoc(doc(bob, 'publicProfiles', 'social-alice'), { 'records.train': 900, updatedAt: serverTimestamp() }));
  await fails(deleteDoc(publicAlice));
  await fails(setDoc(doc(alice, 'publicProfiles', 'social-alice', 'extra', 'secret'), { value: true }));
  // Two devices updating different records must preserve both and the highest score.
  const merge = (field, score) => runTransaction(alice, async tx => { const old = await tx.get(publicAlice); tx.update(publicAlice, { [`records.${field}`]: Math.max(old.data().records[field] ?? 0, score), updatedAt: serverTimestamp() }); });
  await succeeds(Promise.all([merge('train', 600), merge('mathFinance', 900), merge('train', 550)]));
  const saved = (await getDoc(publicAlice)).data(); assert.equal(saved.records.train, 600); assert.equal(saved.records.mathFinance, 900); assert.deepEqual(Object.keys(saved).sort(), ['records', 'updatedAt', 'username', 'usernameKey']);
  const id = '12:social-alice10:social-bob';
  const pending = { members: ['social-alice', 'social-bob'], from: 'social-alice', to: 'social-bob', status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const friend = store => doc(store, 'friendships', id);
  await succeeds(getDoc(friend(alice))); // Checking a pair before its first request.
  await fails(setDoc(friend(guest), pending));
  await fails(setDoc(friend(bob), pending));
  await fails(setDoc(friend(alice), { ...pending, status: 'accepted' }));
  await fails(setDoc(friend(alice), { ...pending, members: ['social-alice', 'social-bob', 'social-charlie'] }));
  await fails(setDoc(friend(alice), { ...pending, members: ['social-bob', 'social-alice'] }));
  await fails(setDoc(friend(alice), { ...pending, to: 'social-alice' }));
  await fails(setDoc(friend(alice), { ...pending, from: 7 }));
  await fails(setDoc(friend(alice), { ...pending, createdAt: Timestamp.fromMillis(0) }));
  await fails(setDoc(friend(alice), { ...pending, isAdmin: true }));
  await fails(setDoc(doc(alice, 'friendships', 'wrong-id'), pending));
  await fails(setDoc(doc(alice, 'friendships', '12:social-alice7:missing'), { ...pending, to: 'missing', members: ['social-alice', 'missing'] }));
  await succeeds(setDoc(friend(alice), pending));
  await succeeds(getDoc(friend(bob)));
  await fails(getDoc(friend(charlie)));
  await fails(getDoc(friend(guest)));
  await fails(getDocs(collection(alice, 'friendships')));
  await fails(getDocs(query(collection(charlie, 'friendships'), where('members', 'array-contains', 'social-alice'))));
  await succeeds(getDocs(query(collection(alice, 'friendships'), where('members', 'array-contains', 'social-alice'))));
  await succeeds(getDocs(query(collection(bob, 'friendships'), where('members', 'array-contains', 'social-bob'))));
  const accept = { status: 'accepted', updatedAt: serverTimestamp() };
  await fails(updateDoc(friend(alice), accept));
  await fails(updateDoc(friend(charlie), accept));
  for (const patch of [{ from: 'social-bob', to: 'social-alice' }, { members: ['social-bob', 'social-charlie'] }, { createdAt: serverTimestamp() }, { extra: 'x'.repeat(10000) }, { status: 'approved' }, { to: deleteField() }, { updatedAt: 'today' }]) await fails(updateDoc(friend(bob), { ...accept, ...patch }));
  await succeeds(updateDoc(friend(bob), accept));
  assert.equal((await getDoc(friend(alice))).data().status, 'accepted');
  await fails(updateDoc(friend(bob), { status: 'pending', updatedAt: serverTimestamp() }));
  await fails(setDoc(friend(bob), { ...pending, from: 'social-bob', to: 'social-alice' }));
  await fails(deleteDoc(friend(charlie)));
  await succeeds(deleteDoc(friend(bob))); // Remove an accepted friend.
  await succeeds(setDoc(friend(alice), pending));
  await succeeds(deleteDoc(friend(alice))); // Sender cancels.
  await succeeds(setDoc(friend(alice), pending));
  await succeeds(deleteDoc(friend(bob))); // Recipient refuses.
  await fails(setDoc(doc(alice, 'friendships', id, 'extra', 'secret'), { value: true }));
  console.log('Parcours Amis + attaques vérifiés : recherche, profils publics sans e-mail, fusion concurrente des records, demandes privées, acceptation par le destinataire, refus, annulation et retrait.');
}
