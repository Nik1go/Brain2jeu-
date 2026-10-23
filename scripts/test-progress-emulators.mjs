import { spawnSync } from 'node:child_process';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST || '')) throw new Error('Local Auth/Firestore emulators required');
for (const args of [['node_modules/vitest/vitest.mjs', 'run', 'tests/progress-emulator.test.ts', '--testTimeout=30000']]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status || 1);
}
