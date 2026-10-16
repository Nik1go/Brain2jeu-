import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { resolveFirebaseConfig } from './config';

const config = resolveFirebaseConfig({
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
});

export const firebaseConfigured = Boolean(config.apiKey && config.appId);
export const firebaseApp = firebaseConfigured ? initializeApp(config) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
if (firebaseAuth) {
  firebaseAuth.languageCode = 'fr';
  if (useEmulators) connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
}
