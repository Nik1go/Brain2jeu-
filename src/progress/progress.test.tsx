import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgressCard } from './ProgressCard';
import { decodeProgress, emptyPlayerProgress, encodeCloudProgress, mergeProgress, recoverSharedProgress } from './model';
import { hasGuestProgress, loadPlayerProgress, progressCacheKey, savePlayerProgress } from './cache';
import { ProgressSync } from './sync';
import type { ProgressTransport } from './sync';
import type { PlayerProgress } from './model';
import { STORAGE_KEY } from '../platform/storage';
import { emptyRecords } from '../friends/model';

afterEach(() => vi.unstubAllGlobals());
function storage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  return data;
}
function progress(mirror = 1, train = 1): PlayerProgress {
  const value = emptyPlayerProgress(); value.mirror.unlocked = mirror; value.train.unlocked = train; return value;
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('sauvegarde associée au compte', () => {
  it('sépare invité, Alice, Bob et la reconnexion sans attribuer les anciennes données', () => {
    const data = storage();
    data.set(STORAGE_KEY, JSON.stringify(progress(9).mirror));
    expect(hasGuestProgress()).toBe(true);
    expect(loadPlayerProgress().mirror.unlocked).toBe(9);
    expect(loadPlayerProgress('alice').mirror.unlocked).toBe(1);
    savePlayerProgress(progress(7, 6), 'alice');
    savePlayerProgress(progress(3, 2), 'bob');
    expect(loadPlayerProgress('alice').train.unlocked).toBe(6);
    expect(loadPlayerProgress('bob').train.unlocked).toBe(2);
    expect(loadPlayerProgress().mirror.unlocked).toBe(9);
    expect(progressCacheKey('a/b')).not.toBe(progressCacheKey('a%2Fb'));
  });
  it('signale le stockage bloqué et conserve la possibilité de jouer', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } });
    expect(loadPlayerProgress('alice')).toEqual(emptyPlayerProgress());
    expect(savePlayerProgress(progress(6), 'alice')).toBe(false);
    expect(savePlayerProgress(progress(6))).toBe(false);
  });
  it('fusionne les meilleurs niveaux, records et tutoriels dans les deux sens', () => {
    const a = progress(8, 3), b = progress(2, 7);
    a.mirror.survivalBest = 1000; b.mirror.survivalBest = 500;
    a.mirror.challengeBest = { 2: 100 }; b.mirror.challengeBest = { 2: 400, 5: 600 };
    a.train.best = { 2: 900 }; b.train.best = { 2: 600, 6: 700 };
    a.math.bestByLevel.small = 500; b.math.bestByLevel.finance = 900;
    b.mirror.tutorialDone = b.train.tutorialDone = b.math.tutorialDone = true;
    const merged = mergeProgress(a, b);
    expect(merged).toEqual(mergeProgress(b, a));
    expect(merged.mirror.unlocked).toBe(8); expect(merged.train.unlocked).toBe(7);
    expect(merged.mirror.survivalBest).toBe(1000);
    expect(merged.mirror.challengeBest).toEqual({ 2: 400, 5: 600 });
    expect(merged.train.best).toEqual({ 2: 900, 6: 700 });
    expect(merged.math.bestByLevel).toEqual({ small: 500, large: 0, finance: 900 });
    expect(merged.math.best).toBe(900);
    expect(merged.mirror.tutorialDone && merged.train.tutorialDone && merged.math.tutorialDone).toBe(true);
    expect(mergeProgress(merged, b)).toEqual(merged);
  });
  it('conserve les préférences de l’appareil sans les propager', () => {
    const a = progress(4), b = progress(8);
    a.mirror.sound = false; a.mirror.reducedMotion = true;
    const merged = mergeProgress(a, b);
    expect(merged.mirror.sound).toBe(false); expect(merged.mirror.reducedMotion).toBe(true);
    expect(decodeProgress(encodeCloudProgress(merged)).mirror.sound).toBe(true);
    expect(decodeProgress(encodeCloudProgress(merged)).mirror.reducedMotion).toBe(false);
  });
  it('déduplique les parties, y compris les anciens miroirs sans UUID, et garde les 100 plus récentes', () => {
    const a = progress(), b = progress();
    const old = { date: '2026-10-15T12:00:00Z', mode: 'survival' as const, level: 3, score: 100, correct: 1, answers: 1, responseTotalMs: 500 };
    a.mirror.history = [old]; b.mirror.history = [{ ...old }];
    const games = Array.from({ length: 130 }, (_, i) => ({ id: `game-${i}`, date: new Date(1_800_000_000_000 + i * 1000).toISOString(), level: 'small' as const, score: i * 100, correct: i, answers: i, durationMs: 5000 }));
    a.math.history = games.slice(0, 90); b.math.history = games.slice(30);
    const merged = mergeProgress(a, b);
    expect(merged.mirror.history).toHaveLength(1);
    expect(merged.math.history).toHaveLength(100);
    expect(merged.math.history[0].id).toBe('game-30');
    expect(mergeProgress(merged, b)).toEqual(merged);
  });
  it('migre les anciens niveaux une seule fois et garde les archives des records', () => {
    const legacy = progress(10);
    const raw = { ...legacy, mirror: { ...legacy.mirror, progressionVersion: undefined, survivalBest: 800, challengeBest: { 2: 500 } } };
    const migrated = decodeProgress(JSON.stringify(raw));
    expect(migrated.mirror.unlocked).toBe(9);
    expect(migrated.mirror.previousLevelRecords?.survivalBest).toBe(800);
    expect(decodeProgress(encodeCloudProgress(migrated))).toEqual(migrated);
  });
  it('refuse une version inconnue ou un payload excessif sans produire une sauvegarde vide', () => {
    expect(() => decodeProgress('{')).toThrow();
    expect(() => decodeProgress('{"version":2}')).toThrow();
    expect(() => decodeProgress('{"version":1}')).toThrow();
    expect(() => decodeProgress('x'.repeat(150001))).toThrow();
    const input = progress();
    const raw = { ...input, train: { ...input.train, unlocked: 500, best: { 99: 100, 2: -5 } }, math: { ...input.math, history: [{ id: 'bad' }] }, mirror: { ...input.mirror, unlocked: '8', history: [null] } };
    const decoded = decodeProgress(JSON.stringify(raw));
    expect(decoded.train.unlocked).toBe(8); expect(decoded.train.best).toEqual({});
    expect(decoded.mirror.unlocked).toBe(1); expect(decoded.math.history).toEqual([]);
  });
  it('récupère le parcours et les records déjà liés au compte sans deviner le niveau d’un record agrégé', () => {
    const recovered = recoverSharedProgress({ scores: { 'mirror-challenge-v2-l6': 600, 'train-v1-l3': 900, 'math-finance-v1': 2000 }, trainProgress: { unlocked: 7, completed: 6 } }, { ...emptyRecords(), mirrorSurvival: 800, train: 99999, mirrorChallenge: 12345, mathSmall: 700 });
    expect(recovered.mirror.unlocked).toBe(6);
    expect(recovered.mirror.challengeBest).toEqual({ 6: 600 });
    expect(recovered.mirror.survivalBest).toBe(800);
    expect(recovered.train.unlocked).toBe(7); expect(recovered.train.best).toEqual({ 3: 900 });
    expect(recovered.math.bestByLevel).toEqual({ small: 700, large: 0, finance: 2000 });
  });
});

describe('synchronisation et reprise', () => {
  function transport() {
    let next: (value: PlayerProgress) => void = () => {};
    const stop = vi.fn();
    const remote: ProgressTransport = { watch: vi.fn((_uid, receive) => { next = receive; return stop; }), merge: vi.fn(async (_uid, value) => value) };
    return { remote, receive: (value: PlayerProgress) => next(value), stop };
  }
  it('restaure un deuxième appareil et conserve une nouvelle réussite durant la lecture distante', async () => {
    const { remote, receive } = transport();
    let resolve!: (value: PlayerProgress) => void;
    vi.mocked(remote.merge).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const changed = vi.fn(), status = vi.fn();
    const sync = new ProgressSync(progress(), 'alice', remote, changed, status);
    sync.start(); sync.update(progress(9, 5)); receive(progress(4, 7));
    resolve(progress(3, 6)); await settle();
    expect(sync.value.mirror.unlocked).toBe(9); expect(sync.value.train.unlocked).toBe(7);
    expect(remote.merge).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('synced');
    sync.stop();
  });
  it('sauvegarde hors ligne avant la requête et reprend après rechargement et reconnexion', async () => {
    storage();
    const { remote } = transport();
    vi.mocked(remote.merge).mockRejectedValue(new Error('offline'));
    const first = new ProgressSync(progress(), 'alice', remote, next => savePlayerProgress(next, 'alice'), vi.fn());
    first.start(); await settle(); first.update(progress(11, 6)); await settle(); first.stop();
    expect(loadPlayerProgress('alice').mirror.unlocked).toBe(11);
    const status = vi.fn();
    vi.mocked(remote.merge).mockImplementation(async (_uid, value) => mergeProgress(value, progress(7, 8)));
    const second = new ProgressSync(loadPlayerProgress('alice'), 'alice', remote, vi.fn(), status);
    second.start(); await settle();
    expect(second.value.mirror.unlocked).toBe(11); expect(second.value.train.unlocked).toBe(8);
    expect(status).toHaveBeenLastCalledWith('synced'); second.stop();
  });
  it('réabonne une écoute refusée et réessaie sans perdre la progression', async () => {
    const { remote } = transport();
    vi.mocked(remote.merge).mockRejectedValueOnce(new Error('permission-denied'));
    const status = vi.fn();
    const sync = new ProgressSync(progress(8), 'alice', remote, vi.fn(), status);
    sync.start(); await settle(); expect(status).toHaveBeenLastCalledWith('error');
    sync.retry(); await settle();
    expect(remote.watch).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith('synced'); expect(sync.value.mirror.unlocked).toBe(8); sync.stop();
  });
  it('ignore les callbacks tardifs et les résultats en vol après le changement de compte', async () => {
    const { remote, receive, stop } = transport();
    let resolve!: (value: PlayerProgress) => void;
    vi.mocked(remote.merge).mockImplementation(() => new Promise(done => { resolve = done; }));
    const changed = vi.fn(), status = vi.fn();
    const alice = new ProgressSync(progress(9), 'alice', remote, changed, status);
    alice.start(); alice.stop(); receive(progress(17)); resolve(progress(17)); await settle();
    expect(stop).toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    expect(remote.merge).toHaveBeenCalledWith('alice', expect.anything());
    const bob = new ProgressSync(progress(), 'bob', remote, vi.fn(), vi.fn());
    expect(bob.value.mirror.unlocked).toBe(1); bob.stop();
  });
  it('ne publie jamais une partie invitée et ne traite pas la réception distante comme une nouvelle partie', async () => {
    const { remote, receive } = transport();
    const guest = new ProgressSync(progress(), undefined, remote, vi.fn(), vi.fn());
    guest.start(); guest.update(progress(6)); await settle();
    expect(remote.merge).not.toHaveBeenCalled(); expect(remote.watch).not.toHaveBeenCalled(); guest.stop();
    const player = new ProgressSync(progress(), 'alice', remote, vi.fn(), vi.fn());
    player.start(); await settle(); vi.mocked(remote.merge).mockClear();
    receive(progress(10)); await settle();
    expect(player.value.mirror.unlocked).toBe(10); expect(remote.merge).not.toHaveBeenCalled(); player.stop();
  });
  it('affiche une sauvegarde en attente ou en erreur sans annoncer un succès', () => {
    const card = (status: 'pending' | 'error' | 'synced') => renderToStaticMarkup(<ProgressCard signedIn status={status} retry={() => {}} legacyAvailable importLegacy={() => {}}/>);
    expect(card('pending')).toContain('en cours'); expect(card('pending')).not.toContain('sont sauvegardés');
    expect(card('error')).toContain('Réessayer'); expect(card('error')).not.toContain('sont sauvegardés');
    expect(card('synced')).toContain('sont sauvegardés'); expect(card('synced')).toContain('S’ils sont à toi');
  });
});
