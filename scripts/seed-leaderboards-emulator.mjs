// Disposable fixtures for visual QA. This script refuses every non-local destination.
import './seed-friends-emulator.mjs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('Local emulators required');
const env = await initializeTestEnvironment({ projectId: 'demo-brain2jeu', firestore: { host: '127.0.0.1', port: 8080 } });
try {
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    const people = (await getDocs(collection(store, 'publicProfiles'))).docs.filter(d => ['AliceTest', 'BobTest', 'CharlyTest'].includes(d.data().username));
    const batch = writeBatch(store);
    const boards = ['math-small-v1', 'math-large-v1', 'math-finance-v1', 'mirror-survival-v2', ...Array.from({ length: 17 }, (_, i) => `mirror-challenge-v2-l${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `train-v1-l${i + 1}`)];
    for (const person of people) {
      const name = person.data().username;
      if (name === 'CharlyTest') continue;
      for (const board of boards) batch.set(doc(store, 'leaderboards', board, 'entries', person.id), { username: name, score: name === 'AliceTest' ? 9000 : 1500, updatedAt: serverTimestamp() });
      batch.update(person.ref, { trainProgress: name === 'AliceTest' ? { unlocked: 6, completed: 5 } : { unlocked: 8, completed: 8 }, updatedAt: serverTimestamp() });
    }
    const [a, b] = people.filter(d => ['AliceTest', 'BobTest'].includes(d.data().username)).map(d => d.id).sort();
    batch.set(doc(store, 'friendships', `${a.length}:${a}${b.length}:${b}`), { members: [a, b], from: a, to: b, status: 'accepted', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    for (let i = 0; i < 100; i++) batch.set(doc(store, 'leaderboards', 'math-small-v1', 'entries', `visual-fixture-${String(i).padStart(3, '0')}`), { username: `Esprit${String(i + 1).padStart(3, '0')}`, score: i * 10, updatedAt: serverTimestamp() });
    await batch.commit();
  });
  console.log('Classements de démonstration prêts sur les émulateurs : AliceTest et BobTest sont amis, 100 scores fictifs, parcours Train différents. Aucun joueur réel modifié.');
} finally { await env.cleanup(); }
