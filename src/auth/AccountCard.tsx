import { useState } from 'react';
import { ArrowRight, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { authErrorMessage } from './identity';

export function AccountCard() {
  const account = useAuth();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const action = async (callback: () => Promise<void>, message = '') => {
    if (busy) return;
    setBusy(true); setStatus('');
    try { await callback(); setStatus(message); }
    catch (error) { setStatus(authErrorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="panel account-card">
    <h2><ShieldCheck size={20}/> {account.profile ? `Bienvenue, ${account.profile.username}` : account.user ? 'Termine ton profil' : 'Ton espace Brain2jeu'}</h2>
    <p className="account-email">{account.user ? account.user.email : 'Un pseudo, un compte, un espace à toi. Connecte-toi par e-mail ou avec Google.'}</p>
    <div className="account-actions">
      {(!account.user || !account.profile) && <button className="secondary" onClick={account.openPortal}>{account.user ? 'Choisir mon pseudo' : 'Connexion / Inscription'}<ArrowRight size={15}/></button>}
      {account.user && !account.user.emailVerified && <button className="secondary" disabled={busy} onClick={() => void action(account.verifyEmail, 'E-mail de vérification envoyé. Consulte ta boîte de réception et les courriers indésirables.')}><Mail size={15}/>Vérifier mon e-mail</button>}
      {account.user && <button className="secondary" disabled={busy} onClick={() => void action(account.logout)}><LogOut size={15}/>Me déconnecter</button>}
    </div>
    {status && <p className="account-status" role="status">{status}</p>}
  </div>;
}
