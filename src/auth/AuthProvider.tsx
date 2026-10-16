import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { firebaseAuth, firebaseConfigured } from './firebase';
import { authErrorMessage } from './identity';
import { claimUsername, watchProfile } from './profiles';
import type { PlayerProfile } from './profiles';
import { AuthPortal } from './AuthPortal';

type Account = {
  configured: boolean;
  user: User | null;
  profile: PlayerProfile | null;
  loading: boolean;
  profileError: string;
  register: (email: string, password: string, username: string, remember: boolean) => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  loginGoogle: (remember: boolean) => Promise<void>;
  chooseUsername: (username: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: () => Promise<void>;
  openPortal: () => void;
  continueAsGuest: () => void;
  retryProfile: () => void;
};

const AccountContext = createContext<Account | null>(null);
export function useAuth() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('AuthProvider manquant');
  return value;
}

function requireAuth() {
  if (!firebaseAuth) throw { code: 'firebase/not-configured' };
  return firebaseAuth;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [profileError, setProfileError] = useState('');
  const [portalOpen, setPortalOpen] = useState(true);
  const [profileAttempt, setProfileAttempt] = useState(0);
  useEffect(() => {
    if (!firebaseAuth) return;
    let stopProfile: (() => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stopAuth = onAuthStateChanged(firebaseAuth, next => {
      stopProfile?.();
      clearTimeout(timeout);
      setUser(next); setProfile(null); setProfileError('');
      if (!next) { setLoading(false); return; }
      setLoading(true);
      timeout = setTimeout(() => {
        setProfileError('La connexion à ton profil prend du temps. Vérifie ton accès Internet ou joue pour le moment sans compte.');
        setLoading(false);
      }, 15000);
      stopProfile = watchProfile(next.uid, value => {
        clearTimeout(timeout);
        setProfile(value); setProfileError(''); setLoading(false);
      }, error => {
        clearTimeout(timeout);
        setProfileError(authErrorMessage(error)); setLoading(false);
      });
    }, error => { setProfileError(authErrorMessage(error)); setLoading(false); });
    return () => { clearTimeout(timeout); stopProfile?.(); stopAuth(); };
  }, [profileAttempt]);

  const account: Account = {
    configured: firebaseConfigured, user, profile, loading, profileError,
    async register(email, password, username, remember) {
      const auth = requireAuth();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // An interrupted profile creation is recoverable after the next sign-in.
      await claimUsername(credential.user, username);
      await sendEmailVerification(credential.user).catch(() => { /* The profile offers an explicit retry. */ });
    },
    async login(email, password, remember) {
      const auth = requireAuth();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    },
    async loginGoogle(remember) {
      const auth = requireAuth();
      // Start the popup in the click handler to preserve the browser's user gesture.
      const persistence = setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await Promise.all([persistence, signInWithPopup(auth, provider)]);
    },
    async chooseUsername(username) {
      const current = requireAuth().currentUser;
      if (!current) throw { code: 'auth/invalid-credential' };
      await claimUsername(current, username);
    },
    async resetPassword(email) {
      try { await sendPasswordResetEmail(requireAuth(), email); }
      catch (error) {
        // Keep the same answer even when enumeration protection is disabled remotely.
        if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      }
    },
    async logout() {
      await signOut(requireAuth());
      setPortalOpen(true);
    },
    async verifyEmail() {
      const current = requireAuth().currentUser;
      if (current && !current.emailVerified) await sendEmailVerification(current);
    },
    openPortal() { setPortalOpen(true); },
    continueAsGuest() { setPortalOpen(false); },
    retryProfile() { setProfileAttempt(value => value + 1); },
  };
  const showPortal = portalOpen && (loading || !user || !profile);
  return <AccountContext.Provider value={account}>{showPortal ? <AuthPortal/> : children}</AccountContext.Provider>;
}
