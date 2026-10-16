// Read-only production check. Credentials stay in the Firebase CLI's account store.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const rules = require('firebase-tools/lib/gcp/rules');
const project = 'brain2jeu';
const snapshot = process.argv.includes('--snapshot');
await requireAuth({ project, nonInteractive: true, ...auth.getProjectDefaultAccount(process.cwd()) });
const releases = await rules.listAllReleases(project);
const release = releases.find(item => item.name === `projects/${project}/releases/cloud.firestore`);
if (!release) throw new Error('Default Firestore release not found.');
const files = await rules.getRulesetContent(release.rulesetName);
const remote = files.find(file => file.name === 'firestore.rules');
if (!remote) throw new Error('Expected firestore.rules source not found.');
const local = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const digest = source => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
const report = {
  verifiedAt: new Date().toISOString(), project, database: '(default)', release,
  localSha256: digest(local), remoteSha256: digest(remote.content), matchesLocal: digest(local) === digest(remote.content),
  hasPublicProfiles: remote.content.includes('match /publicProfiles/{uid}'),
  hasFriendships: remote.content.includes('match /friendships/{id}'),
  hasLeaderboards: remote.content.includes('match /leaderboards/{board}/entries/{uid}'),
  hasTrainProgress: remote.content.includes('validTrainProgress'),
};
const output = new URL('../artifacts/', import.meta.url);
mkdirSync(output, { recursive: true });
const prefix = snapshot ? 'firestore-rules-before-leaderboards' : 'firestore-rules-live';
// A baseline snapshot is never silently replaced.
writeFileSync(new URL(`${prefix}.json`, output), JSON.stringify(report, null, 2) + '\n', { flag: snapshot ? 'wx' : 'w' });
if (snapshot) writeFileSync(new URL(`${prefix}.rules`, output), remote.content, { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
if (!snapshot && !report.matchesLocal) process.exitCode = 1;
