import assert from 'node:assert/strict';
import { collection, deleteDoc, deleteField, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';

export async function testLeaderboards(env, succeeds, fails) {
  const alice = env.authenticatedContext('social-alice').firestore(), bob = env.authenticatedContext('social-bob').firestore();
  const guest = env.unauthenticatedContext().firestore();
  const entry = (store, board = 'math-small-v1', uid = 'social-alice') => doc(store, 'leaderboards', board, 'entries', uid);
  const data = (score, username = 'SocialAlice', extra = {}) => ({ username, score, updatedAt: serverTimestamp(), ...extra });
  await fails(setDoc(entry(guest), data(100)));
  await fails(setDoc(entry(bob), data(100)));
  for (const board of ['math-unknown-v1', 'mirror-survival-v1', 'mirror-challenge-v2-l0', 'mirror-challenge-v2-l18', 'mirror-challenge-v2-l01', 'train-v1-l9']) await fails(setDoc(entry(alice, board), data(100)));
  for (const score of [null, -1, 1.5, '100', NaN, 1000000001]) await fails(setDoc(entry(alice), data(score)));
  await fails(setDoc(entry(alice), data(100, 'SocialBob')));
  await fails(setDoc(entry(alice), data(100, 'SocialAlice', { email: 'private@example.test' })));
  await fails(setDoc(entry(alice), data(100, 'SocialAlice', { updatedAt: Timestamp.fromMillis(0) })));
  await succeeds(setDoc(entry(alice), data(0)));
  await succeeds(updateDoc(entry(alice), data(100)));
  await fails(updateDoc(entry(alice), data(99)));
  await fails(updateDoc(entry(alice), data(100, 'SocialBob')));
  await fails(updateDoc(entry(alice), { score: deleteField(), updatedAt: serverTimestamp() }));
  await fails(deleteDoc(entry(alice)));
  await fails(getDoc(entry(guest)));
  await fails(getCountFromServer(collection(guest, 'leaderboards', 'math-small-v1', 'entries')));
  await succeeds(getDoc(entry(bob)));
  const boards = ['math-small-v1', 'math-large-v1', 'math-finance-v1', 'mirror-survival-v2', ...Array.from({ length: 17 }, (_, i) => `mirror-challenge-v2-l${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `train-v1-l${i + 1}`)];
  // A full local import is one transaction/batch; verify the rules access-call budget for 29 boards.
  const batch = writeBatch(alice);
  for (const board of boards) batch.set(entry(alice, board), data(500));
  batch.update(doc(alice, 'publicProfiles', 'social-alice'), { trainProgress: { unlocked: 5, completed: 4 }, updatedAt: serverTimestamp() });
  await succeeds(batch.commit());
  const profile = doc(alice, 'publicProfiles', 'social-alice');
  for (const progress of [{ unlocked: 4, completed: 3 }, { unlocked: 5, completed: 3 }, { unlocked: 9, completed: 8 }, { unlocked: 5, completed: 5 }, { unlocked: '5', completed: 4 }, { unlocked: 5, completed: 4, admin: true }]) await fails(updateDoc(profile, { trainProgress: progress, updatedAt: serverTimestamp() }));
  await fails(updateDoc(profile, { trainProgress: deleteField(), updatedAt: serverTimestamp() }));
  await fails(updateDoc(doc(bob, 'publicProfiles', 'social-alice'), { trainProgress: { unlocked: 8, completed: 8 }, updatedAt: serverTimestamp() }));
  await succeeds(updateDoc(profile, { trainProgress: { unlocked: 8, completed: 8 }, updatedAt: serverTimestamp() }));
  const improve = score => runTransaction(alice, async tx => { const old = await tx.get(entry(alice)); tx.update(entry(alice), data(Math.max(old.data().score, score))); });
  await succeeds(Promise.all([improve(700), improve(600), improve(900)]));
  assert.equal((await getDoc(entry(alice))).data().score, 900);
  await succeeds(setDoc(entry(bob, 'math-small-v1', 'social-bob'), data(900, 'SocialBob')));
  // Disposable fixtures are only created through the emulator's disabled-rules context.
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore(), seed = writeBatch(store);
    for (let i = 0; i < 43; i++) seed.set(entry(store, 'math-small-v1', `fixture-${String(i).padStart(2, '0')}`), data(i < 3 ? 900 : i * 10, `Fixture${i}`));
    await seed.commit();
  });
  const ref = collection(alice, 'leaderboards', 'math-small-v1', 'entries');
  const top = query(ref, orderBy('score', 'desc'), limit(20));
  const page1 = await getDocs(top), page2 = await getDocs(query(ref, orderBy('score', 'desc'), startAfter(page1.docs.at(-1)), limit(20))), page3 = await getDocs(query(ref, orderBy('score', 'desc'), startAfter(page2.docs.at(-1)), limit(20)));
  assert.equal(new Set([...page1.docs, ...page2.docs, ...page3.docs].map(d => d.id)).size, 45);
  await succeeds(getDocs(top));
  await succeeds(getCountFromServer(query(ref, where('score', '>=', 0))));
  assert.equal((await getCountFromServer(ref)).data().count, 45);
  assert.equal((await getCountFromServer(query(ref, where('score', '>', 900)))).data().count, 0);
  assert.equal((await getCountFromServer(query(ref, where('score', '<', 900)))).data().count, 40);
  assert.equal((await getCountFromServer(collection(alice, 'leaderboards', 'math-large-v1', 'entries'))).data().count, 1);
  await fails(setDoc(doc(alice, 'leaderboards', 'math-small-v1'), { score: 100 }));
  await fails(setDoc(doc(alice, 'leaderboards', 'math-small-v1', 'entries', 'social-alice', 'private', 'data'), { value: true }));
  console.log('Classements vérifiés : 29 modes/niveaux, accès privé, schémas stricts, records croissants et concurrents, progression Train, pagination sans doublon et agrégations réelles avec ex æquo.');
}
