// pm2 process definition for the production server, so `pm2 start` works from
// a fresh checkout instead of relying on flags typed by hand on the host.
//
// Deploy/restart runbook lives in docs/DEPLOY.md — read it before restarting a
// box with live games on it (`curl localhost:3000/health` reports roomsInGame).
//
// Root package.json has no "type": "module", so this file is CommonJS — which
// is what pm2 expects. Keep it that way.

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'tichu',
      // Built output; `dist/` is git-ignored, so the host must run
      // `npm run build` (shared → server → client) before this resolves.
      //
      // This entry point is ESM. pm2 only loads it correctly if its
      // `isESModule()` check finds `server/package.json` ("type": "module")
      // and dynamic-imports it; older pm2 `require()`s the file and dies with
      // ERR_REQUIRE_ESM before the port is bound. Needs pm2 >= 4.5 running on
      // a daemon started under Node >= 22.22.2 — see docs/DEPLOY.md.
      script: 'server/dist/index.js',
      // Anchor every relative path to the repo root, regardless of the
      // directory pm2 happens to be invoked from.
      cwd: __dirname,

      // Rooms live in-memory in server/src/rooms.ts and Socket.IO connections
      // are sticky to one process, so this must stay a single fork. Cluster
      // mode would shard players across processes that cannot see each other's
      // rooms — do not raise `instances`.
      exec_mode: 'fork',
      instances: 1,

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // A missing build or a bad env crashes at import time, before the server
      // ever listens. Back off instead of burning hundreds of restarts against
      // a failure that is never going to fix itself.
      exp_backoff_restart_delay: 1000,
      max_restarts: 10,
      min_uptime: 10000,

      // Restart if the process balloons rather than letting the box swap.
      max_memory_restart: '600M',

      error_file: path.join(__dirname, 'logs/tichu-error.log'),
      out_file: path.join(__dirname, 'logs/tichu-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
