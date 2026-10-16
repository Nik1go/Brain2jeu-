import { useEffect, useState } from 'react';
import { ArrowRight, Globe2, UsersRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { friendError } from '../friends/model';
import { rankEntries, standingText } from './model';
import type { BoardId, LeaderboardEntry, Standing } from './model';
import { readEntries, readStanding } from './service';
import { useCircle } from './useCircle';
import './leaderboards.css';

interface Props { board: BoardId; score: number; beforeRead: () => Promise<void>; onLeaderboard: (board: BoardId) => void }
export function ResultComparison(props: Props) {
  const account = useAuth();
  if (!account.user || !account.profile) return <div className="result-comparison"><Globe2 size={20}/><strong>Et face aux autres joueurs ?</strong><p>Connecte-toi pour partager tes prochains records et voir ta place mondiale et parmi tes amis.</p><button onClick={account.openPortal}>Me connecter <ArrowRight size={15}/></button></div>;
  return <ConnectedComparison key={`${account.user.uid}-${props.board}`} uid={account.user.uid} {...props}/>;
}
function ConnectedComparison({ uid, board, score, beforeRead, onLeaderboard }: Props & { uid: string }) {
  const [version, setVersion] = useState(0);
  const circle = useCircle(uid, version);
  const [data, setData] = useState<{ own?: LeaderboardEntry; standing?: Standing; friends?: number; friendTotal: number }>();
  const [error, setError] = useState('');
  const circleKey = circle.profiles.map(p => `${p.uid}:${p.updatedAt?.toMillis()}`).sort().join('|');
  useEffect(() => {
    let active = true;
    setData(undefined); setError('');
    if (circle.loading || circle.error) return;
    void (async () => {
      // Do not calculate a percentile until the best score has reached the server.
      await beforeRead();
      const people = await readEntries(board, circle.profiles.map(p => p.uid));
      const own = people.find(p => p.uid === uid);
      const standing = own ? await readStanding(board, own.score) : undefined;
      if (active) setData({ own, standing, friends: rankEntries(people).find(p => p.uid === uid)?.rank, friendTotal: people.length });
    })().catch(cause => { if (active) setError(friendError(cause)); });
    return () => { active = false; };
  }, [uid, board, score, beforeRead, circleKey, circle.loading, circle.error, version]);
  return <div className="result-comparison" aria-live="polite">
    {error || circle.error ? <><p role="alert">Ton score reste enregistré sur cet appareil. {error || circle.error}</p><button onClick={() => setVersion(v => v + 1)}>Réessayer la comparaison</button></> : !data ? <p role="status">Publication du record et calcul de ta place…</p> : data.standing ? <><Globe2 size={21}/><strong>{standingText(data.standing)}</strong><p>{data.standing.total.toLocaleString('fr-FR')} joueur{data.standing.total > 1 ? 's' : ''} · même mode, même niveau{data.own && data.own.score > score ? ` · Record partagé : ${data.own.score.toLocaleString('fr-FR')} pts` : ''}</p>{data.standing.topOnePercent && <span className="ranking-top">TOP 1 %</span>}<div className="result-friends"><UsersRound size={17}/>{data.friendTotal > 1 ? `N° ${data.friends} sur ${data.friendTotal} parmi tes amis, toi compris` : 'Tes amis n’ont pas encore partagé de record ici.'}</div></> : <p>Publie tes records de cet appareil depuis Mes amis pour te comparer aux autres joueurs.</p>}
    <button onClick={() => onLeaderboard(board)}>Voir les classements <ArrowRight size={16}/></button>
  </div>;
}
