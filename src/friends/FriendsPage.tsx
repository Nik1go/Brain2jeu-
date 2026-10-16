import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Clock3, Gamepad2, Search, ShieldCheck, Sparkles, Trophy, UserPlus, UsersRound, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { friendError, RECORD_LABELS } from './model';
import type { Friendship, PublicProfile, PublicRecords, RecordKey } from './model';
import { acceptFriend, readPublicProfile, removeFriend, requestFriend, searchPlayers, watchFriendships, watchPublicProfile } from './service';
import './friends.css';

interface Props { records: PublicRecords; ready: boolean; syncError: string; onSync: (records?: Partial<PublicRecords>) => Promise<void> }
export function FriendsPage(props: Props) {
  const account = useAuth();
  return <section className="friends-page">
    <header className="friends-heading"><div><div className="eyebrow">LES DÉCLICS, ÇA SE PARTAGE</div><h1>Mes amis<span>.</span></h1><p>Retrouve tes amis. Découvre leurs meilleurs scores.</p></div><div className="friends-emblem" aria-hidden="true"><UsersRound size={43} strokeWidth={1.4}/><Sparkles size={19}/><span/></div></header>
    {!account.user || !account.profile ? <div className="friends-gate panel"><span className="friend-round"><UserPlus size={29}/></span><h2>Un pseudo, et on se retrouve.</h2><p>Connecte-toi pour chercher des joueurs, envoyer des demandes et découvrir leurs records.</p><button className="primary" onClick={account.openPortal}>Me connecter <ArrowRight size={17}/></button></div> : <ConnectedFriends key={account.user.uid} uid={account.user.uid} username={account.profile.username} {...props}/>}
  </section>;
}

function ConnectedFriends({ uid, username, records, ready, syncError, onSync }: Props & { uid: string; username: string }) {
  const [relationships, setRelationships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [version, setVersion] = useState(0);
  const [people, setPeople] = useState<Record<string, PublicProfile | null>>({});
  const [peopleError, setPeopleError] = useState('');
  const [tab, setTab] = useState<'accepted' | 'received' | 'sent'>('accepted');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState(uid);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [importing, setImporting] = useState(false);
  const searchId = useId();
  const profilePanel = useRef<HTMLElement>(null);
  function selectProfile(other: string) {
    setSelected(other);
    if (window.matchMedia('(max-width: 900px)').matches) profilePanel.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  const byPerson = useMemo(() => new Map(relationships.map(r => [r.members.find(member => member !== uid)!, r])), [relationships, uid]);
  const accepted = relationships.filter(r => r.status === 'accepted');
  const received = relationships.filter(r => r.status === 'pending' && r.to === uid);
  const sent = relationships.filter(r => r.status === 'pending' && r.from === uid);
  const shown = (tab === 'accepted' ? accepted : tab === 'received' ? received : sent)
    .slice().sort((a, b) => (people[a.members.find(m => m !== uid)!]?.username || '').localeCompare(people[b.members.find(m => m !== uid)!]?.username || '', 'fr'));
  const normalized = term.trim();
  const validSearch = /^[a-zA-Z0-9_]{3,20}$/.test(normalized);

  useEffect(() => {
    setLoading(true); setListError('');
    return watchFriendships(uid, items => { setRelationships(items); setLoading(false); }, cause => { setListError(friendError(cause)); setLoading(false); });
  }, [uid, version]);
  useEffect(() => {
    let active = true;
    const ids = relationships.map(r => r.members.find(member => member !== uid)!);
    setPeopleError('');
    void Promise.all(ids.map(async id => [id, await readPublicProfile(id)] as const)).then(entries => {
      if (active) setPeople(Object.fromEntries(entries));
    }).catch(cause => { if (active) setPeopleError(friendError(cause)); });
    return () => { active = false; };
  }, [relationships, uid, version]);
  useEffect(() => {
    let active = true;
    setResults([]); setSearchError(''); setSearching(validSearch && ready);
    if (!validSearch || !ready) return;
    const timer = window.setTimeout(() => {
      void searchPlayers(normalized).then(items => { if (active) setResults(items.filter(p => p.uid !== uid)); })
        .catch(cause => { if (active) setSearchError(friendError(cause)); })
        .finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [normalized, validSearch, ready, uid, version]);
  useEffect(() => {
    setProfile(null); setProfileError(''); setProfileLoading(true);
    return watchPublicProfile(selected, value => { setProfile(value); setProfileLoading(false); }, cause => { setProfileError(friendError(cause)); setProfileLoading(false); });
  }, [selected, version]);

  async function act(other: string, action: 'request' | 'accept' | 'remove') {
    setBusy(other); setActionError(''); setNotice('');
    try {
      const relation = byPerson.get(other);
      if (action === 'request') await requestFriend(uid, other);
      else if (relation) {
        if (action === 'accept') await acceptFriend(uid, relation.id);
        else await removeFriend(uid, relation.id);
      }
      setConfirmRemove('');
      setNotice(action === 'request' ? 'Demande envoyée !' : action === 'accept' ? 'Vous êtes maintenant amis !' : relation?.status === 'accepted' ? 'Ce joueur a été retiré de tes amis.' : 'Demande supprimée.');
    } catch (cause) { setActionError(friendError(cause)); }
    finally { setBusy(''); }
  }
  function actions(other: string) {
    if (other === uid) return null;
    const relation = byPerson.get(other), disabled = !!busy || !ready;
    if (relation?.status === 'accepted') return confirmRemove === other ? <div className="friend-confirm"><span>Retirer cet ami ?</span><button disabled={disabled} onClick={() => void act(other, 'remove')}>Confirmer</button><button onClick={() => setConfirmRemove('')}>Garder</button></div> : <><span className="friend-connected"><Check size={14}/> Amis</span><button className="friend-subtle" disabled={disabled} onClick={() => setConfirmRemove(other)}>Retirer</button></>;
    if (relation?.to === uid) return <><button className="friend-action" disabled={disabled} onClick={() => void act(other, 'accept')}><Check size={15}/>Accepter</button><button className="friend-subtle" disabled={disabled} onClick={() => void act(other, 'remove')}>Refuser</button></>;
    if (relation) return <><span className="friend-pending"><Clock3 size={13}/> Envoyée</span><button className="friend-subtle" disabled={disabled} onClick={() => void act(other, 'remove')}>Annuler</button></>;
    return <button className="friend-action" disabled={disabled} onClick={() => void act(other, 'request')}><UserPlus size={15}/>{busy === other ? 'Envoi…' : 'Ajouter'}</button>;
  }
  function playerRow(other: string, person: PublicProfile | null | undefined) {
    const name = person?.username || 'Joueur indisponible';
    return <article className={`friend-row ${selected === other ? 'chosen' : ''}`} key={other} aria-label={name}>
      <button className="friend-person" onClick={() => selectProfile(other)} aria-label={`Voir le profil de ${name}`}><Avatar name={name}/><span><strong>{name}</strong><small>Voir le profil <ArrowRight size={11}/></small></span></button>
      <div className="friend-row-actions">{actions(other)}</div>
    </article>;
  }
  const retry = () => setVersion(v => v + 1);
  const hasLocalRecords = Object.values(records).some(value => value !== null);
  return <>
    {syncError && <div className="friend-error" role="alert">Publication du profil : {syncError}<button onClick={() => void onSync().catch(() => {})}>Réessayer</button></div>}
    <div className="friends-layout"><div className="friends-main">
      <section className="friend-search panel" aria-labelledby={`${searchId}-heading`}><div className="friend-section-title"><span className="friend-mini-icon"><Search size={18}/></span><div><h2 id={`${searchId}-heading`}>Retrouver un joueur</h2><p>Il suffit de connaître son pseudo.</p></div></div>
        <label className="friend-search-label" htmlFor={searchId}>Rechercher par username</label><div className="friend-search-input"><Search size={18}/><input id={searchId} type="search" autoComplete="off" spellCheck={false} maxLength={20} placeholder="Par exemple : EspritCurieux" value={term} onChange={e => setTerm(e.target.value)} aria-describedby={`${searchId}-hint`}/>{term && <button aria-label="Effacer la recherche" onClick={() => setTerm('')}><X size={17}/></button>}</div>
        <p id={`${searchId}-hint`} className="friend-search-hint">3 caractères minimum · lettres, chiffres et _</p>
        <div className="friend-search-status" role="status">{!ready && !syncError ? 'Préparation de ton profil public…' : searching ? 'Recherche en cours…' : normalized && !validSearch ? 'Entre au moins 3 lettres, chiffres ou _.' : validSearch && !searchError && !results.length && ready ? 'Aucun joueur trouvé. Essaie un autre pseudo.' : validSearch && results.length ? `${results.length} joueur${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}` : ''}</div>
        {searchError && <div className="friend-error" role="alert">{searchError}<button onClick={retry}>Réessayer</button></div>}
        {results.length > 0 && <div className="friend-results">{results.map(person => playerRow(person.uid, person))}</div>}
      </section>
      <section className="friend-network panel" aria-label="Tes relations"><div className="friend-section-title"><span className="friend-mini-icon green"><UsersRound size={19}/></span><div><h2>Ton petit cercle</h2><p>Des esprits curieux, comme toi.</p></div></div>
        <div className="friend-tabs" role="group" aria-label="Afficher les relations">{([{ id: 'accepted', label: 'Amis', count: accepted.length }, { id: 'received', label: 'Reçues', count: received.length }, { id: 'sent', label: 'Envoyées', count: sent.length }] as const).map(item => <button key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}>{item.label}<span>{item.count}</span></button>)}</div>
        {listError || peopleError ? <div className="friend-error" role="alert">{listError || peopleError}<button onClick={retry}>Réessayer</button></div> : loading ? <p className="friend-empty" role="status">Chargement de tes amis…</p> : shown.length ? <div className="friend-list">{shown.map(r => { const other = r.members.find(m => m !== uid)!; return playerRow(other, people[other]); })}</div> : <div className="friend-empty"><UsersRound size={31}/><h3>{tab === 'accepted' ? 'Le début d’un petit cercle.' : tab === 'received' ? 'Tout est à jour.' : 'Aucune demande en attente.'}</h3><p>{tab === 'accepted' ? 'Cherche un pseudo au-dessus pour inviter ton premier ami.' : tab === 'received' ? 'Les invitations de tes amis apparaîtront ici.' : 'Tes invitations envoyées apparaîtront ici.'}</p></div>}
      </section>
      <div className="friend-feedback" aria-live="polite">{busy ? 'Un instant…' : notice}</div>{actionError && <div className="friend-error" role="alert">{actionError}</div>}
    </div>
    <aside ref={profilePanel} className="friend-profile panel" aria-label="Profil public">
      {selected !== uid && <button className="friend-back" onClick={() => setSelected(uid)}><ChevronLeft size={14}/>Mon profil public</button>}
      {profileError ? <div className="friend-error" role="alert">{profileError}<button onClick={retry}>Réessayer</button></div> : profileLoading || (!profile && selected === uid && !ready && !syncError) ? <p className="friend-empty" role="status">Chargement du profil…</p> : !profile ? <div className="friend-empty"><h2>Profil indisponible</h2><p>Ce joueur n’a pas encore publié son profil.</p><button className="text-link" onClick={retry}>Réessayer</button></div> : <>
        <div className="friend-public-heading"><span className="friend-public-tag">{selected === uid ? 'TON PROFIL PUBLIC' : 'PROFIL DU JOUEUR'}</span><Avatar name={profile.username} large/><h2>{profile.username}</h2><p>{selected === uid ? 'C’est toi, esprit curieux.' : 'Un esprit curieux de plus.'}</p><div className="friend-profile-actions">{actions(selected)}</div></div>
        <div className="friend-record-heading"><Trophy size={16}/><h3>Meilleurs scores</h3></div><div className="friend-score-list">{(Object.entries(RECORD_LABELS) as [RecordKey, string][]).map(([key, label]) => <div className="friend-score" key={key}><span>{label}</span><strong>{profile.records[key] === null ? <span className="friend-unplayed">Pas encore joué</span> : <>{profile.records[key]!.toLocaleString('fr-FR')}<small> pts</small></>}</strong></div>)}</div>
        {selected === uid && <div className="friend-import"><p>Déjà joué sur cet appareil ? Ajoute tes anciens records à ceux de <strong>{username}</strong>.</p><button className="secondary" disabled={importing || !hasLocalRecords || !ready} onClick={async () => { setImporting(true); setNotice(''); try { await onSync(records); setNotice('Les records de cet appareil sont publiés.'); } catch { /* The sync error is displayed above. */ } finally { setImporting(false); } }}>{importing ? 'Publication…' : 'Publier mes records de cet appareil'}</button></div>}
        {profile.updatedAt && <p className="friend-updated">Mis à jour le {profile.updatedAt.toDate().toLocaleDateString('fr-FR')}</p>}
      </>}
      <div className="friend-privacy"><ShieldCheck size={17}/><p>Ton pseudo et tes records sont visibles par les joueurs connectés. Ton e-mail reste privé.</p></div>
    </aside></div>
    <footer className="friends-footer"><Gamepad2 size={15}/> Un petit défi entre amis, juste pour le plaisir.</footer>
  </>;
}

export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return <span className={`friend-avatar ${large ? 'large' : ''}`} aria-hidden="true">{name.slice(0, 2).toUpperCase()}{large && <Sparkles size={18}/>}</span>;
}
