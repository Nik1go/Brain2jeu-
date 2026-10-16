// Disposable local fixtures for the browser journey. Never connects to production.
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local emulators required');
for (const [name, scores] of [['AliceTest', [600, 800, 400, 300, 200, 100]], ['BobTest', [900, 1200, 700, 1500, 600, 300]], ['CharlyTest', [null, null, null, null, null, null]]]) {
  const app = initializeApp({ projectId: 'demo-brain2jeu', apiKey: 'demo-brain2jeu-key', appId: 'demo-brain2jeu-app' }, name);
  try {
    const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    const store = getFirestore(app); connectFirestoreEmulator(store, '127.0.0.1', 8080);
    const email = `${name.toLowerCase()}@example.test`, password = 'LocalTest_42!';
    let user;
    try { user = (await createUserWithEmailAndPassword(auth, email, password)).user; }
    catch (cause) { if (cause.code !== 'auth/email-already-in-use') throw cause; user = (await signInWithEmailAndPassword(auth, email, password)).user; }
    if (!(await getDoc(doc(store, 'users', user.uid))).exists()) {
      const batch = writeBatch(store);
      batch.set(doc(store, 'users', user.uid), { username: name, usernameKey: name.toLowerCase(), createdAt: serverTimestamp() });
      batch.set(doc(store, 'usernames', name.toLowerCase()), { uid: user.uid });
      await batch.commit();
    }
    if (!(await getDoc(doc(store, 'publicProfiles', user.uid))).exists()) await setDoc(doc(store, 'publicProfiles', user.uid), { username: name, usernameKey: name.toLowerCase(), records: Object.fromEntries(['mirrorSurvival', 'mirrorChallenge', 'train', 'mathSmall', 'mathLarge', 'mathFinance'].map((key, i) => [key, scores[i]])), updatedAt: serverTimestamp() });
    console.log(`${name}: compte local prêt`);
  } finally { await deleteApp(app); }
}
