import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Gamepad2, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, Zap } from 'lucide-react';
import { Brain } from '../components/Art';
import { useAuth } from './AuthProvider';
import { authErrorMessage, USERNAME_HINT, validUsername } from './identity';
import './auth.css';

type Mode = 'login' | 'signup' | 'reset';

function GoogleMark() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5a6.1 6.1 0 0 1-9.1-3.2H2.9v2.6A10.1 10.1 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.9a6 6 0 0 1 0-3.8V7.5H2.9a10 10 0 0 0 0 9l3.4-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10.1 10.1 0 0 0-9.1 5.5l3.4 2.6A6 6 0 0 1 12 6Z"/></svg>;
}

export function AuthPortal() {
  const account = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const onboarding = !!account.user;
  const switchMode = (next: Mode) => { setMode(next); setError(''); setMessage(''); setPassword(''); setConfirmPassword(''); };
  const run = async (action: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (cause) { setError(authErrorMessage(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ((onboarding || mode === 'signup') && !validUsername(username)) { setError(USERNAME_HINT); return; }
    if (!onboarding && mode === 'signup' && password !== confirmPassword) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    void run(async () => {
      if (onboarding) await account.chooseUsername(username);
      else if (mode === 'signup') await account.register(email.trim(), password, username, remember);
      else if (mode === 'login') await account.login(email.trim(), password, remember);
      else { await account.resetPassword(email.trim()); setMessage('Si un compte correspond à cet e-mail, tu recevras un lien pour choisir un nouveau mot de passe.'); }
      setPassword(''); setConfirmPassword('');
    });
  };
  const waiting = account.loading && !busy;
  return <main className="auth-page">
    <section className="auth-story" aria-label="Bienvenue sur Brain2jeu">
      <a className="brand auth-logo" href="#" onClick={e => { e.preventDefault(); account.continueAsGuest(); }} aria-label="Brain2jeu, jouer sans compte"><span className="brand-mark"><Zap size={25} fill="currentColor"/></span>Brain2jeu<span className="brand-dot">.</span></a>
      <div className="auth-story-content"><span className="auth-kicker"><span/>UN ESPRIT CURIEUX, TOUJOURS.</span><h1>Les petits jeux.<br/>Les grands <span>déclics.</span></h1><p>Une pause, quelques neurones en éveil.<br/>Et un espace rien qu’à toi.</p><div className="auth-illustration"><span className="auth-orbit orbit-one"/><span className="auth-orbit orbit-two"/><Brain/><span className="auth-float float-star"><Sparkles size={25}/></span><span className="auth-float float-game"><Gamepad2 size={25}/></span><span className="auth-sticker"><span><Check size={15}/></span> À ton rythme. Pour le plaisir.</span></div><div className="auth-story-foot"><span><ShieldCheck size={17}/> Ton compte, en toute simplicité.</span><span>01 / LE DÉBUT D’UNE BELLE HABITUDE</span></div></div>
    </section>
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-panel-top"><button className="auth-back" onClick={account.continueAsGuest}><ArrowLeft size={16}/> {onboarding ? 'Jouer pour le moment' : 'Découvrir les jeux'}</button><span>UN PETIT MOMENT POUR TOI</span></div>
      <div className="auth-card">
        <span className="auth-symbol">{onboarding ? <UserRound size={25}/> : mode === 'reset' ? <Mail size={25}/> : <Zap size={25}/>}</span>
        <div className="auth-kicker">{onboarding ? 'DERNIÈRE PETITE ÉTAPE' : mode === 'signup' ? 'TON AVENTURE COMMENCE ICI' : mode === 'reset' ? 'ON S’OCCUPE DE ÇA' : 'HEUREUX DE TE RETROUVER'}</div>
        <h2 id="auth-title">{onboarding ? 'Comment t’appelle-t-on ?' : mode === 'signup' ? 'À toi de jouer.' : mode === 'reset' ? 'Un nouveau départ.' : 'Rebonjour, toi.'}<span className="auth-heading-star">✦</span></h2>
        <p className="auth-intro">{onboarding ? 'Choisis le pseudo qui te suivra dans tes prochains déclics.' : mode === 'signup' ? 'Crée ton compte et fais une place au jeu dans ta journée.' : mode === 'reset' ? 'Indique ton e-mail pour recevoir un lien de réinitialisation.' : 'Connecte-toi pour retrouver ton espace Brain2jeu.'}</p>
        {!onboarding && mode !== 'reset' && <><div className="auth-tabs" role="group" aria-label="Accès au compte"><button aria-pressed={mode === 'login'} className={mode === 'login' ? 'selected' : ''} disabled={busy} onClick={() => switchMode('login')}>Connexion</button><button aria-pressed={mode === 'signup'} className={mode === 'signup' ? 'selected' : ''} disabled={busy} onClick={() => switchMode('signup')}>Inscription</button></div><button className="auth-google" disabled={busy || waiting || !account.configured} onClick={() => void run(() => account.loginGoogle(remember))}><GoogleMark/>Continuer avec Google<ArrowRight size={16}/></button><div className="auth-separator"><span/>ou avec ton e-mail<span/></div></>}
        {waiting ? <div className="auth-loading" role="status"><LoaderCircle className="auth-spin"/>Connexion à ton espace…</div> : <form onSubmit={submit} className="auth-form">
          {(onboarding || mode === 'signup') && <label htmlFor="auth-username">Ton pseudo<div className="auth-input"><UserRound size={18}/><input id="auth-username" name="username" autoComplete="username" placeholder="EspritCurieux" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" aria-describedby="username-hint" disabled={busy}/></div><small id="username-hint">{USERNAME_HINT}</small></label>}
          {!onboarding && <label htmlFor="auth-email">Ton e-mail<div className="auth-input"><Mail size={18}/><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="toi@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={busy}/></div></label>}
          {!onboarding && mode !== 'reset' && <><label htmlFor="auth-password">Ton mot de passe<div className="auth-input"><LockKeyhole size={18}/><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'Au moins 8 caractères' : 'Ton mot de passe'} value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 8 : 1} maxLength={128} disabled={busy}/><button type="button" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>{mode === 'signup' && <label htmlFor="auth-confirm">Confirme ton mot de passe<div className="auth-input"><LockKeyhole size={18}/><input id="auth-confirm" name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" placeholder="Encore une petite fois" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} maxLength={128} disabled={busy}/></div></label>}<div className="auth-options"><label className="auth-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={busy}/>Rester connecté</label>{mode === 'login' && <button type="button" disabled={busy} onClick={() => switchMode('reset')}>Mot de passe oublié ?</button>}</div></>}
          {(error || account.profileError) && <p className="auth-error" role="alert">{error || account.profileError}</p>}
          {message && <p className="auth-success" role="status"><Check size={17}/>{message}</p>}
          {!account.configured && <p className="auth-info" role="status">Les comptes arrivent bientôt. En attendant, les jeux sont accessibles sans compte.</p>}
          <button className="primary auth-submit" type="submit" disabled={busy || !account.configured || !!account.profileError}>{busy ? <><LoaderCircle size={19} className="auth-spin"/>Un petit instant…</> : <>{onboarding ? 'C’est mon pseudo' : mode === 'signup' ? 'Créer mon compte' : mode === 'reset' ? 'Recevoir le lien' : 'Me connecter'}<ArrowRight size={18}/></>}</button>
        </form>}
        {account.profileError && <button className="auth-secondary-link" onClick={account.retryProfile} disabled={busy}>Réessayer de charger mon profil</button>}
        {onboarding ? <button className="auth-secondary-link" disabled={busy} onClick={() => void run(account.logout)}>Se déconnecter</button> : mode === 'reset' ? <button className="auth-secondary-link" disabled={busy} onClick={() => switchMode('login')}><ArrowLeft size={15}/>Retour à la connexion</button> : <p className="auth-switch">{mode === 'login' ? 'Pas encore de compte ?' : 'Déjà dans l’aventure ?'} <button disabled={busy} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Rejoins-nous' : 'Connecte-toi'}<ArrowRight size={13}/></button></p>}
        <p className="auth-local-note"><ShieldCheck size={14}/> Ton profil est privé. Tes records restent sur cet appareil.</p>
      </div>
      <footer className="auth-footer"><span>Un peu de jeu. Beaucoup d’esprit.</span><a href="mailto:la.lutz@outlook.fr">Besoin d’un coup de main ?</a></footer>
    </section>
  </main>;
}
