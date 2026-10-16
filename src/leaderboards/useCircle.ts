import { useEffect, useState } from 'react';
import { friendError } from '../friends/model';
import type { PublicProfile } from '../friends/model';
import { watchFriendships, watchPublicProfile } from '../friends/service';

// Only accepted friendships belong to the comparison circle. Stop every listener on account changes.
export function useCircle(uid: string, version = 0) {
  const [state, setState] = useState<{ profiles: PublicProfile[]; loading: boolean; error: string }>({ profiles: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    let generation = 0;
    let stops: (() => void)[] = [];
    setState({ profiles: [], loading: true, error: '' });
    const fail = (cause: unknown) => { if (active) setState(s => ({ ...s, loading: false, error: friendError(cause) })); };
    const stop = watchFriendships(uid, relationships => {
      const current = ++generation;
      stops.forEach(unsubscribe => unsubscribe());
      const ids = [uid, ...relationships.filter(r => r.status === 'accepted').map(r => r.members.find(id => id !== uid)!)];
      const pending = new Set(ids), people = new Map<string, PublicProfile>();
      const errors = new Map<string, string>();
      setState({ profiles: [], loading: true, error: '' });
      stops = ids.map(id => watchPublicProfile(id, person => {
        if (!active || current !== generation) return;
        pending.delete(id);
        errors.delete(id);
        if (person) people.set(id, person); else people.delete(id);
        setState({ profiles: [...people.values()], loading: pending.size > 0, error: [...errors.values()][0] ?? '' });
      }, cause => {
        if (!active || current !== generation) return;
        pending.delete(id); errors.set(id, friendError(cause));
        setState({ profiles: [...people.values()], loading: pending.size > 0, error: [...errors.values()][0] });
      }));
    }, fail);
    return () => { active = false; stop(); stops.forEach(unsubscribe => unsubscribe()); };
  }, [uid, version]);
  return state;
}
