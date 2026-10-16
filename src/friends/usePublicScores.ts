import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { friendError, mergeRecords, emptyRecords } from './model';
import type { PublicRecords } from './model';
import { publishRecords } from './service';

export function usePublicScores() {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const owner = useRef(uid);
  owner.current = uid;
  const pending = useRef<{ uid: string | undefined; records: PublicRecords }>({ uid, records: emptyRecords() });
  if (pending.current.uid !== uid) pending.current = { uid, records: emptyRecords() };
  const sync = useCallback(async (incoming: Partial<PublicRecords> = {}) => {
    if (!uid || !profile) return;
    pending.current.records = mergeRecords(pending.current.records, incoming);
    try {
      await publishRecords(uid, profile, pending.current.records);
      if (owner.current === uid) { setReady(true); setError(''); }
    } catch (cause) {
      if (owner.current === uid) setError(friendError(cause));
      throw cause;
    }
  }, [uid, profile]);
  useEffect(() => {
    setReady(false); setError('');
    if (uid && profile) void sync().catch(() => {});
  }, [uid, profile, sync]);
  return { ready, error, sync, publish: (records: Partial<PublicRecords>) => { void sync(records).catch(() => {}); } };
}
