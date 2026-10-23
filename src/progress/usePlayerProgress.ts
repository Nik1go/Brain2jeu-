import { useCallback, useEffect, useRef, useState } from 'react';
import { hasGuestProgress, loadGuestProgress, loadPlayerProgress, savePlayerProgress } from './cache';
import type { PlayerProgress } from './model';
import { ProgressSync } from './sync';
import type { SyncStatus } from './sync';
import { progressTransport } from './service';

// App is keyed by UID, so no state or active game crosses an account boundary.
export function usePlayerProgress(uid?: string) {
  const [value, setValue] = useState(() => loadPlayerProgress(uid));
  const [status, setStatus] = useState<SyncStatus>(uid ? 'pending' : 'local');
  const [storageError, setStorageError] = useState(false);
  const [legacyAvailable, setLegacyAvailable] = useState(() => !!uid && hasGuestProgress());
  const sync = useRef<ProgressSync | null>(null);
  const current = useRef(value);
  useEffect(() => {
    const session = new ProgressSync(current.current, uid, progressTransport, next => {
      current.current = next;
      setValue(next);
      setStorageError(!savePlayerProgress(next, uid));
    }, setStatus);
    sync.current = session;
    session.start();
    const retry = () => session.retry();
    const visible = () => { if (document.visibilityState === 'visible') retry(); };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', visible);
    // Retry transient failures even if the browser never emitted an offline event.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') retry(); }, 60_000);
    return () => { session.stop(); sync.current = null; window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', visible); clearInterval(timer); };
  }, [uid]);
  const update = useCallback((change: PlayerProgress | ((previous: PlayerProgress) => PlayerProgress)) => {
    const session = sync.current;
    if (!session) return;
    const next = typeof change === 'function' ? change(session.value) : change;
    if (JSON.stringify(next) !== JSON.stringify(session.value)) session.update(next);
  }, []);
  return { value, status, storageError, update, retry: () => sync.current?.retry(), legacyAvailable,
    importLegacy: () => { if (uid) { const legacy = loadGuestProgress(); update({ ...legacy, mirror: { ...legacy.mirror, sound: current.current.mirror.sound, reducedMotion: current.current.mirror.reducedMotion } }); setLegacyAvailable(false); } },
  };
}
