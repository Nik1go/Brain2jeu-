import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDocFromServer, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { createProgressTransport } from '../src/progress/service';
import { decodeProgress, emptyPlayerProgress } from '../src/progress/model';
import { emptyRecords } from '../src/friends/model';
import { testProgress } from '../scripts/test-progress-rules.mjs';

// No production SDK configuration or current-user global is used in this test.
vi.mock('../src/auth/database', () => ({ playerDatabase: () => { throw new Error('Use explicit emulator clients'); } }));
const local = /^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '') && /^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '');
describe.skipIf(!local)('progression — deux appareils Firebase indépendants', () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
    env = await initializeTestEnvironment({ projectId: 'demo-brain2jeu', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
  });
  afterAll(async () => { await env?.cleanup(); });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'users', 'sync-user'), { username: 'SyncPlayer', usernameKey: 'syncplayer', createdAt: serverTimestamp() });
    });
  });
  const value = (mirror: number, train: number) => {
    const result = emptyPlayerProgress(); result.mirror.unlocked = mirror; result.train.unlocked = train; return result;
  };
  it('refuse les accès croisés et les enveloppes invalides à la création et à la mise à jour', async () => {
    await env.withSecurityRulesDisabled(async context => {
      for (const uid of ['social-alice', 'social-bob']) await setDoc(doc(context.firestore(), 'users', uid), { username: uid });
    });
    let checks = 0;
    await testProgress(env, async request => { await assertSucceeds(request); checks++; }, async request => { await assertFails(request); checks++; });
    expect(checks).toBe(30);
  }, 30000);
  it('retrouve les trois jeux sur un appareil vide et résiste à deux sauvegardes concurrentes', async () => {
    const first = env.authenticatedContext('sync-user').firestore();
    const second = env.authenticatedContext('sync-user').firestore();
    expect(first.app.name).not.toBe(second.app.name);
    const a = createProgressTransport(first), b = createProgressTransport(second);
    const saved = value(10, 6);
    saved.mirror.survivalBest = 1200; saved.mirror.tutorialDone = true;
    saved.train.best = { 5: 900 }; saved.train.tutorialDone = true;
    saved.math.bestByLevel.finance = saved.math.best = 700; saved.math.tutorialDone = true;
    saved.math.history = [{ id: 'finance-game', date: '2026-10-23T12:00:00Z', level: 'finance', score: 700, correct: 7, answers: 8, durationMs: 8000 }];
    await a.merge('sync-user', saved);
    const restored = await b.merge('sync-user', emptyPlayerProgress());
    expect(restored).toEqual(saved);
    await Promise.all([a.merge('sync-user', value(13, 2)), b.merge('sync-user', value(4, 8))]);
    const remote = decodeProgress((await getDocFromServer(doc(second, 'users', 'sync-user', 'saves', 'progress'))).data()!.payload);
    expect(remote.mirror.unlocked).toBe(13); expect(remote.train.unlocked).toBe(8);
    expect(remote.mirror.survivalBest).toBe(1200); expect(remote.math.bestByLevel.finance).toBe(700);
    expect(remote.math.history).toHaveLength(1);
  }, 30000);
  it('récupère les données publiques du même UID à la première synchronisation', async () => {
    const first = env.authenticatedContext('sync-user').firestore();
    const batch = writeBatch(first);
    batch.set(doc(first, 'publicProfiles', 'sync-user'), { username: 'SyncPlayer', usernameKey: 'syncplayer', records: { ...emptyRecords(), mirrorSurvival: 1000, mathSmall: 600 }, trainProgress: { unlocked: 7, completed: 6 }, updatedAt: serverTimestamp() });
    batch.set(doc(first, 'leaderboards', 'train-v1-l6', 'entries', 'sync-user'), { username: 'SyncPlayer', score: 1500, updatedAt: serverTimestamp() });
    await batch.commit();
    const restored = await createProgressTransport(first).merge('sync-user', emptyPlayerProgress());
    expect(restored.train.unlocked).toBe(7); expect(restored.train.best).toEqual({ 6: 1500 });
    expect(restored.mirror.survivalBest).toBe(1000); expect(restored.math.bestByLevel.small).toBe(600);
  }, 30000);
  it('propage une progression en direct puis fusionne après un signal hors ligne', async () => {
    const first = env.authenticatedContext('sync-user').firestore();
    const second = env.authenticatedContext('sync-user').firestore();
    const a = createProgressTransport(first), b = createProgressTransport(second);
    await a.merge('sync-user', value(5, 3));
    let stop: () => void = () => {};
    try {
      const observed = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Realtime save not observed')), 10000);
        stop = b.watch('sync-user', next => { if (next.mirror.unlocked === 11) { clearTimeout(timer); resolve(); } }, reject);
      });
      await a.merge('sync-user', value(11, 5));
      await observed;
      await disableNetwork(second);
      vi.stubGlobal('navigator', { onLine: false });
      await expect(b.merge('sync-user', value(6, 8))).rejects.toBeDefined();
      vi.unstubAllGlobals();
      await enableNetwork(second);
      const resumed = await b.merge('sync-user', value(6, 8));
      expect(resumed.mirror.unlocked).toBe(11); expect(resumed.train.unlocked).toBe(8);
    } finally { vi.unstubAllGlobals(); stop(); await enableNetwork(second); }
  }, 30000);
});
