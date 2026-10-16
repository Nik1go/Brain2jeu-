import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Globe2, RefreshCw, TrainFront, Trophy, UsersRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../friends/FriendsPage';
import { friendError } from '../friends/model';
import type { PublicProfile } from '../friends/model';
import { BOARDS, rankEntries, standingText } from './model';
import type { BoardGame, BoardId, LeaderboardEntry, Standing } from './model';
import { readEntries, readLeaderboard, readStanding } from './service';
import type { LeaderboardCursor } from './service';
import { useCircle } from './useCircle';
import './leaderboards.css';

interface Props { initialBoard: BoardId; beforeRead: () => Promise<void>; onFriends: () => void }
export function LeaderboardPage(props: Props) {
  const account = useAuth();
  return <section className="leaderboard-page">
    <header className="leaderboard-heading"><div><div className="eyebrow">UN DÉCLIC, ET TU TE DÉPASSES</div><h1>Les classements<span>.</span></h1><p>Ton record, tes amis et des joueurs du monde entier.</p></div><span className="leaderboard-emblem"><Trophy size={38} strokeWidth={1.5}/></span></header>
    {!account.user || !account.profile ? <div className="ranking-gate panel"><Globe2 size={32}/><h2>À toi de faire ta place.</h2><p>Connecte-toi pour comparer tes records et suivre le parcours de tes amis.</p><button className="primary" onClick={account.openPortal}>Me connecter <ArrowRight size={17}/></button></div> : <ConnectedLeaderboard key={account.user.uid} uid={account.user.uid} {...props}/>}
  </section>;
}
function ConnectedLeaderboard({ uid, initialBoard, beforeRead, onFriends }: Props & { uid: string }) {
  const [board, setBoard] = useState(BOARDS.some(b => b.id === initialBoard) ? initialBoard : BOARDS[0].id);
  const [view, setView] = useState<'global' | 'friends' | 'progress'>('global');
  const [version, setVersion] = useState(0);
  const circle = useCircle(uid, version);
  const game = BOARDS.find(b => b.id === board)!.game;
  function selectGame(next: BoardGame) { setBoard(BOARDS.find(b => b.game === next)!.id); setView(next === 'train' ? 'progress' : view === 'progress' ? 'global' : view); }
  return <>
    <div className="ranking-controls panel">
      <div className="ranking-games" role="group" aria-label="Jeu du classement">{([{ id: 'math', label: 'Calcul mental' }, { id: 'mirror', label: 'Miroirs cachés' }, { id: 'train', label: 'Petit train' }] as const).map(item => <button key={item.id} aria-pressed={game === item.id} onClick={() => selectGame(item.id)}>{item.label}</button>)}</div>
      <div className="ranking-options"><div className="ranking-scopes" role="group" aria-label="Joueurs à comparer"><button aria-pressed={view === 'global'} onClick={() => setView('global')}><Globe2 size={16}/>Global</button><button aria-pressed={view === 'friends'} onClick={() => setView('friends')}><UsersRound size={16}/>Mes amis</button>{game === 'train' && <button aria-pressed={view === 'progress'} onClick={() => setView('progress')}><TrainFront size={16}/>Parcours</button>}</div>{view !== 'progress' && <label className="ranking-level">Mode / niveau<select value={board} onChange={event => setBoard(event.target.value)}>{BOARDS.filter(b => b.game === game).map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>}</div>
    </div>
    <div className="ranking-section-heading"><div><h2>{view === 'progress' ? 'Le voyage de tes amis' : view === 'friends' ? 'Dans ton cercle' : 'À travers le monde'}</h2><p>{view === 'progress' ? 'Niveau atteint et étapes réussies, mis à jour quand tes amis jouent.' : 'Un record par joueur. Les ex æquo partagent la même place.'}</p></div><button className="ranking-refresh" onClick={() => setVersion(v => v + 1)} aria-label="Actualiser les classements"><RefreshCw size={17}/><span>Actualiser</span></button></div>
    {circle.loading ? <p className="ranking-status" role="status">Chargement des joueurs…</p> : circle.error ? <div className="friend-error" role="alert">{circle.error}<button onClick={() => setVersion(v => v + 1)}>Réessayer</button></div> : view === 'progress' ? <TrainJourney profiles={circle.profiles} uid={uid}/> : <ScoreBoard key={`${board}-${view}-${version}`} board={board} scope={view} uid={uid} profiles={circle.profiles} beforeRead={beforeRead}/>}
    {circle.profiles.length <= 1 && !circle.loading && <div className="ranking-invite"><UsersRound size={22}/><p>Invite tes amis pour vous retrouver dans les classements et suivre leurs voyages.</p><button onClick={onFriends}>Retrouver mes amis <ArrowRight size={16}/></button></div>}
    <p className="ranking-footnote">Seuls les joueurs ayant publié un record dans ce mode et ce niveau sont comptés. Les scores sont déclarés par l’application.</p>
  </>;
}

function ScoreBoard({ board, scope, uid, profiles, beforeRead }: { board: BoardId; scope: 'global' | 'friends'; uid: string; profiles: PublicProfile[]; beforeRead: () => Promise<void> }) {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [own, setOwn] = useState<LeaderboardEntry>();
  const [standing, setStanding] = useState<Standing>();
  const [loading, setLoading] = useState(true), [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(''), [moreError, setMoreError] = useState('');
  const [version, setVersion] = useState(0);
  const [cursor, setCursor] = useState<LeaderboardCursor>();
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);
  const circleKey = profiles.map(p => `${p.uid}:${p.updatedAt?.toMillis()}`).sort().join('|');
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setError(''); setRows([]); setOwn(undefined); setStanding(undefined); setHasMore(false); setMoreError(''); setMoreLoading(false);
    void (async () => {
      await beforeRead();
      const [mine] = await readEntries(board, [uid]);
      const [page, position] = await Promise.all([
        scope === 'global' ? readLeaderboard(board) : readEntries(board, profiles.map(p => p.uid)).then(entries => ({ entries, cursor: undefined, hasMore: false })),
        mine && scope === 'global' ? readStanding(board, mine.score) : undefined,
      ]);
      if (current !== generation.current) return;
      setOwn(mine); setRows(page.entries); setStanding(position); setCursor(page.cursor); setHasMore(page.hasMore);
    })().catch(cause => { if (current === generation.current) setError(friendError(cause)); }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [board, scope, uid, beforeRead, circleKey, version]);
  async function more() {
    if (!cursor || moreLoading) return;
    const current = generation.current;
    setMoreLoading(true); setMoreError('');
    try {
      const page = await readLeaderboard(board, cursor);
      if (current !== generation.current) return;
      setRows(old => [...new Map([...old, ...page.entries].map(entry => [entry.uid, entry])).values()]); setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (cause) { if (current === generation.current) setMoreError(friendError(cause)); }
    finally { if (current === generation.current) setMoreLoading(false); }
  }
  if (loading) return <p className="ranking-status" role="status">Calcul du classement…</p>;
  if (error) return <div className="friend-error" role="alert">{error}<button onClick={() => setVersion(v => v + 1)}>Réessayer</button></div>;
  const ranked = rankEntries(rows);
  const friendRank = ranked.find(row => row.uid === uid);
  return <>
    <div className="ranking-own panel">{own ? <><span className="ranking-own-icon"><Trophy size={24}/></span><div><small>TON RECORD PARTAGÉ · {own.score.toLocaleString('fr-FR')} PTS</small><strong>{standing ? standingText(standing) : `N° ${friendRank?.rank ?? '—'} parmi tes amis`}</strong><p>{scope === 'global' ? `${standing?.total.toLocaleString('fr-FR')} joueur${standing?.total === 1 ? '' : 's'} dans ce classement` : `${rows.length} joueur${rows.length > 1 ? 's' : ''}, toi compris`}</p></div>{standing?.topOnePercent && <span className="ranking-top">TOP 1 %</span>}</> : <><Trophy size={26}/><div><strong>Ta place t’attend.</strong><p>Termine une partie connecté pour apparaître ici. Tu peux publier tes anciens records depuis Mes amis.</p></div></>}</div>
    {!rows.length ? <div className="ranking-empty panel"><Trophy size={32}/><h3>Le premier déclic est à prendre.</h3><p>{scope === 'friends' ? 'Aucun record partagé dans ton cercle pour ce niveau.' : 'Aucun record partagé pour ce niveau. À toi de lancer le jeu !'}</p></div> : <div className="ranking-table panel"><table><caption>{scope === 'global' ? 'Classement global' : 'Classement entre amis'} · {BOARDS.find(b => b.id === board)?.label}</caption><thead><tr><th scope="col">Place</th><th scope="col">Joueur</th><th scope="col">Record</th></tr></thead><tbody>{ranked.map(row => <tr key={row.uid} className={row.uid === uid ? 'is-you' : ''}><td><span className={`ranking-place place-${row.rank}`}>{row.rank <= 3 && <Trophy size={13}/>} {row.rank}</span></td><th scope="row"><span className="ranking-player"><Avatar name={row.username}/><span>{row.username}{row.uid === uid && <small>Toi</small>}</span></span></th><td>{row.score.toLocaleString('fr-FR')}<small> pts</small></td></tr>)}</tbody></table>{hasMore && <button className="ranking-more" disabled={moreLoading} onClick={() => void more()}>{moreLoading ? 'Chargement…' : 'Voir les joueurs suivants'} <ArrowRight size={16}/></button>}{moreError && <p className="friend-error" role="alert">{moreError}</p>}</div>}
  </>;
}

export function TrainJourney({ profiles, uid }: { profiles: PublicProfile[]; uid: string }) {
  const sorted = [...profiles].sort((a, b) => (b.trainProgress?.completed ?? -1) - (a.trainProgress?.completed ?? -1) || (b.trainProgress?.unlocked ?? 0) - (a.trainProgress?.unlocked ?? 0) || a.username.localeCompare(b.username, 'fr'));
  return <div className="train-journey panel">{sorted.map(person => <article key={person.uid} className={person.uid === uid ? 'is-you' : ''}><div className="journey-person"><Avatar name={person.username}/><div><strong>{person.username}{person.uid === uid && <small> · Toi</small>}</strong><p>{person.trainProgress ? person.trainProgress.completed === 8 ? 'Parcours terminé · 8 niveaux réussis' : `Niveau ${person.trainProgress.unlocked} atteint · ${person.trainProgress.completed} / 8 réussis` : 'Progression pas encore partagée'}</p></div></div><div className="journey-stops" aria-label={person.trainProgress ? `${person.trainProgress.completed} niveaux réussis sur 8` : 'Progression inconnue'}>{Array.from({ length: 8 }, (_, i) => <span key={i} className={person.trainProgress && i < person.trainProgress.completed ? 'done' : person.trainProgress && i + 1 === person.trainProgress.unlocked ? 'current' : ''}>{i + 1}</span>)}</div></article>)}</div>;
}
