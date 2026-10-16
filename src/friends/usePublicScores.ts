import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { friendError, mergeRecords, emptyRecords } from './model';
import type { PublicRecords } from './model';
import { publishRecords } from './service';
import { mergeCompetition } from '../leaderboards/model';
import type { CompetitionUpdate } from '../leaderboards/model';

export function usePublicScores() {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const owner = useRef(uid);
  owner.current = uid;
  const pending = useRef<{ uid: string | undefined; records: PublicRecords; competition: CompetitionUpdate }>({ uid, records: emptyRecords(), competition: {} });
  if (pending.current.uid !== uid) pending.current = { uid, records: emptyRecords(), competition: {} };
  const sync = useCallback(async (incoming: Partial<PublicRecords> = {}, competition: CompetitionUpdate = {}) => {
    if (!uid || !profile) return;
    pending.current.records = mergeRecords(pending.current.records, incoming);
    pending.current.competition = mergeCompetition(pending.current.competition, competition);
    try {
      await publishRecords(uid, profile, pending.current.records, pending.current.competition);
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
  useEffect(() => {
    const retry = () => { void sync().catch(() => {}); };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [sync]);
  return { ready, error, sync, publish: (records: Partial<PublicRecords>, competition: CompetitionUpdate = {}) => { void sync(records, competition).catch(() => {}); } };
}
