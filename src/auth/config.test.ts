import { describe, expect, it } from 'vitest';
import { resolveFirebaseConfig } from './config';
import publicConfig from './firebase-public.json';

describe('Firebase Web build configuration', () => {
  it('keeps authentication configured in a fresh VPS checkout without .env.local', () => {
    expect(resolveFirebaseConfig({})).toEqual(publicConfig);
    expect(publicConfig.apiKey).toMatch(/^AIza[\w-]+$/);
    expect(publicConfig.appId).toMatch(/^1:\d+:web:[a-f0-9]+$/);
  });
  it('uses defaults when optional environment variables are blank', () => {
    expect(resolveFirebaseConfig({ VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_APP_ID: ' ', VITE_FIREBASE_PROJECT_ID: '' })).toEqual(publicConfig);
  });
  it('uses an explicit test project without falling back to production credentials', () => {
    expect(resolveFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: 'demo-brain2jeu' })).toEqual({ projectId: 'demo-brain2jeu', apiKey: undefined, appId: undefined, authDomain: 'demo-brain2jeu.firebaseapp.com' });
    expect(resolveFirebaseConfig({ VITE_FIREBASE_PROJECT_ID: 'demo-brain2jeu', VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_APP_ID: 'demo-app', VITE_FIREBASE_AUTH_DOMAIN: 'localhost' })).toEqual({ projectId: 'demo-brain2jeu', apiKey: 'demo-key', appId: 'demo-app', authDomain: 'localhost' });
  });
});
