/**
 * Startup preflight. **This module must be imported before any other local
 * module in `index.ts`.**
 *
 * ESM evaluates every import before the importing module's own body runs, and
 * `firebase.ts` reads `process.env.FIREBASE_*` at module scope. So the .env
 * load has to happen inside an import that is evaluated first — calling
 * `dotenv.config()` from index.ts's body would run *after* firebase.ts had
 * already read an empty environment. Loading it here, rather than via
 * `import 'dotenv/config'`, is what lets us report where the file came from.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Keep in sync with `.nvmrc` and `engines.node` in the root package.json.
const MIN_NODE_MAJOR = 22;

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isFinite(nodeMajor) && nodeMajor < MIN_NODE_MAJOR) {
  // Note this cannot catch every case: a Node old enough to reject the syntax
  // in this codebase (`??` needs 14+) fails to parse the file before any of
  // this runs. It covers the realistic "host drifted to an older LTS" case.
  console.error(
    `FATAL: Tichu needs Node >= ${MIN_NODE_MAJOR}, but this process is ${process.version}.\n` +
    `       The pm2 daemon pins the Node it was started with — 'pm2 restart' does\n` +
    `       not move it. Run 'pm2 kill' and start it again under Node ${MIN_NODE_MAJOR}+.\n` +
    `       See docs/DEPLOY.md.`
  );
  process.exit(1);
}

// dotenv resolves against process.cwd(), so this only finds the file when the
// process runs with its cwd inside server/ — which is what ecosystem.config.js
// arranges. Report the outcome so a miss is visible instead of silent.
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config();

export const bootstrapInfo = {
  nodeVersion: process.version,
  cwd: process.cwd(),
  envPath,
  envLoaded: !result.error,
  /** Keys read from the .env file itself (not the ambient environment). */
  envKeys: result.parsed ? Object.keys(result.parsed) : [],
};

/** Human-readable startup banner. Never logs secret values — only key names. */
export function describeStartup(clientDist: string, port: string | number): string {
  const { nodeVersion, cwd, envPath: p, envLoaded, envKeys } = bootstrapInfo;
  const firebase = process.env.FIREBASE_PROJECT_ID
    ? `enabled (project ${process.env.FIREBASE_PROJECT_ID})`
    : 'DISABLED — no FIREBASE_PROJECT_ID (no auth, no game persistence)';
  const portSource = envKeys.includes('PORT')
    ? '.env'
    : process.env.PORT
      ? 'environment'
      : 'default';

  return [
    'Tichu server starting',
    `  node        ${nodeVersion}`,
    `  cwd         ${cwd}`,
    envLoaded
      ? `  env file    loaded ${p} (${envKeys.length} keys)`
      : `  env file    NOT FOUND at ${p} — using defaults only`,
    `  port        ${port} (from ${portSource})`,
    `  firebase    ${firebase}`,
    `  client      ${clientDist}${fs.existsSync(clientDist) ? '' : ' — MISSING, run npm run build'}`,
  ].join('\n');
}
