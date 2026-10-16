import publicConfig from './firebase-public.json';

interface FirebaseEnvironment {
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
}

export function resolveFirebaseConfig(env: FirebaseEnvironment) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim() || publicConfig.projectId;
  const useDefault = projectId === publicConfig.projectId;
  // Firebase Web identifiers are public client configuration. Keeping the
  // default app here lets a fresh VPS checkout build without a private .env.
  // An explicit alternate project must supply its own key and app ID.
  return {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() || (useDefault ? publicConfig.apiKey : undefined),
    appId: env.VITE_FIREBASE_APP_ID?.trim() || (useDefault ? publicConfig.appId : undefined),
    projectId,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || (useDefault ? publicConfig.authDomain : `${projectId}.firebaseapp.com`),
  };
}
