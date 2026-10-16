import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const project = 'brain2jeu';
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Lancer ce script avec npm run firebase:setup.');
const selectedApp = process.argv[2];
function firebase(...args) {
  const result = spawnSync(process.execPath, [npm, 'exec', '--yes', '--', 'firebase-tools@latest', ...args, '--project', project, '--json', '--non-interactive'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  let output;
  try { output = JSON.parse(result.stdout); }
  catch { throw new Error('La CLI n’a pas renvoyé de JSON. Vérifier npm et la connexion Firebase.'); }
  if (result.status !== 0 || output.status !== 'success') throw new Error(output.error || 'Commande Firebase échouée.');
  return output.result;
}
let appId = selectedApp;
if (!appId) {
  const apps = firebase('apps:list', 'WEB');
  if (apps.length === 0) throw new Error('Aucune application Web. Créer l’application Web Brain2jeu dans ce projet puis relancer.');
  if (apps.length > 1) throw new Error(`Plusieurs applications : ${apps.map(app => `${app.displayName || 'Web'} (${app.appId})`).join(', ')}. Relancer npm run firebase:setup -- APP_ID.`);
  appId = apps[0].appId;
}
const { sdkConfig: config } = firebase('apps:sdkconfig', 'WEB', appId);
if (config.projectId !== project || !config.apiKey || !config.appId) throw new Error('Configuration Web invalide ou projet inattendu.');
const path = new URL('../.env.local', import.meta.url);
const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
const values = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
};
const remaining = current.split(/\r?\n/).filter(line => !Object.keys(values).some(key => line.startsWith(`${key}=`))).join('\n').trim();
writeFileSync(path, `${remaining ? `${remaining}\n` : ''}${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
console.log(`Configuration Web de ${project} enregistrée dans .env.local. Redémarrer Vite ou reconstruire le site.`);
