import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const dist = join(project, 'dist');
for (const file of ['index.html', 'assets', 'sw.js', 'manifest.webmanifest']) {
  if (!existsSync(join(dist, file))) throw new Error(`Build incomplet : dist/${file} est absent.`);
}
const artifacts = join(project, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const archive = join(artifacts, 'brain2jeu-vps.tar.gz');
const result = spawnSync('tar', ['-czf', archive, '-C', dist, '.'], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Archive prête : ${archive}`);
console.log('Installation sur le VPS : voir deploy/README.md.');
