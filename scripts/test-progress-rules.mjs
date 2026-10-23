import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

export async function testProgress(env, succeeds, fails) {
  const alice = env.authenticatedContext('social-alice').firestore(), bob = env.authenticatedContext('social-bob').firestore();
  const guest = env.unauthenticatedContext().firestore(), orphan = env.authenticatedContext('no-profile').firestore();
  const ref = (store, uid = 'social-alice', save = 'progress') => doc(store, 'users', uid, 'saves', save);
  const data = (extra = {}) => ({ version: 1, payload: '{"version":1}', updatedAt: serverTimestamp(), ...extra });
  await fails(getDoc(ref(guest)));
  await fails(setDoc(ref(guest), data()));
  await fails(setDoc(ref(bob), data()));
  await fails(setDoc(ref(orphan, 'no-profile'), data()));
  await fails(setDoc(ref(alice, 'social-alice', 'arbitrary'), data()));
  for (const invalid of [{ version: 2 }, { version: '1' }, { payload: 1 }, { payload: '' }, { payload: 'x'.repeat(150001) }, { updatedAt: Timestamp.fromMillis(0) }, { ownerId: 'social-bob' }, { isAdmin: true }]) {
    await fails(setDoc(ref(alice), data(invalid)));
  }
  await succeeds(setDoc(ref(alice), data()));
  await succeeds(getDoc(ref(alice)));
  await fails(getDoc(ref(bob)));
  await fails(getDocs(collection(alice, 'users', 'social-alice', 'saves')));
  await fails(getDocs(collection(guest, 'users', 'social-alice', 'saves')));
  for (const invalid of [{ version: 2 }, { payload: 'x'.repeat(150001) }, { payload: null }, { updatedAt: Timestamp.fromMillis(0) }, { uid: 'social-bob' }, { role: 'admin' }]) {
    await fails(updateDoc(ref(alice), { ...invalid, ...(invalid.updatedAt ? {} : { updatedAt: serverTimestamp() }) }));
  }
  await fails(updateDoc(ref(alice), { payload: deleteField(), updatedAt: serverTimestamp() }));
  await fails(setDoc(ref(alice), { version: 1, updatedAt: serverTimestamp() }));
  await fails(deleteDoc(ref(alice)));
  await fails(updateDoc(ref(bob), data()));
  await succeeds(updateDoc(ref(alice), data({ payload: 'x'.repeat(150000) })));
  await succeeds(updateDoc(ref(alice), data()));
  console.log('Sauvegarde privée : propriétaire, schéma create/update, taille, timestamps, versions, listes, droits et sous-collection orpheline vérifiés.');
}
