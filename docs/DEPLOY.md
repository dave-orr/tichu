# Deploy & outage runbook

The production host runs the built server under pm2 as the process `tichu`,
behind a reverse proxy that serves https://tichu.squidbox.com. There is no
deploy automation — CI (`.github/workflows/auto-merge.yml`) only builds and
tests PRs. Deploys are a manual pull-and-build on the host.

## Deploy

```sh
cd <repo>
git pull
npm ci
npm run build          # shared → server → client, in that order
pm2 restart tichu --update-env
```

`npm run build` is not optional and the order matters. `dist/` is git-ignored
in every workspace, so nothing usable ships in the checkout. The server
imports `@tichu/shared`, which npm resolves through a workspace symlink
(`node_modules/@tichu/shared → shared/`) to `shared/dist/index.js`. If
`shared/` was not rebuilt, the server dies at import time — see below.

Check for live games before restarting; a restart drops every open socket:

```sh
curl -s localhost:3000/health   # roomsInGame > 0 means people are mid-game
```

Rooms are snapshotted to Firestore and restored on boot
(`server/src/persistence.ts`), so players can reconnect after a restart — but
they still get disconnected first.

## Triage: process is "online" but the site is 503

A 503 from the proxy means nothing is listening on the app port. If
`pm2 list` shows `tichu` as `online` with a high restart count (`↺`) and only
a couple of MB of memory, the process is not actually up: it is crash-looping,
and pm2 is reporting the instant after each fork. A healthy process sits at
roughly 60–120 MB.

Read the error first — it names the cause outright:

```sh
pm2 logs tichu --err --lines 100
```

### `ERR_MODULE_NOT_FOUND: Cannot find module '.../@tichu/shared/dist/index.js'`

The build did not run, did not finish, or ran only for the server workspace.
This throws before the server binds a port, so it fails identically on every
restart — `pm2 restart` will never clear it.

```sh
npm run build
pm2 restart tichu --update-env
```

### `ERR_MODULE_NOT_FOUND` for a third-party package

`node_modules` is incomplete, usually from an `npm ci` that failed partway.
Re-run it and check that it exits 0 before rebuilding.

Confirm the host toolchain first: the repo requires Node >= 22.22.2
(`engines.node`, pinned by `.nvmrc`), and npm 12 refuses to run on older Node
entirely. A host still on Node 20 fails here.

```sh
node -v && npm -v
npm ci && npm run build
pm2 restart tichu --update-env
```

### `EADDRINUSE`

An orphaned process still holds the port. Find and kill it, then start clean:

```sh
ss -lptn 'sport = :3000'
pm2 delete tichu && pm2 start ecosystem.config.js
```

### Nothing in the logs at all

pm2 may be tailing a stale path after a `pm2 delete`/`start` cycle. Run the
server in the foreground to see the real error, then Ctrl-C:

```sh
cd <repo> && node server/dist/index.js
```

## Notes

- `pm2 start` with no arguments reads `ecosystem.config.js` from the current
  directory, so run it from the repo root.
- The app must stay a single fork process. Rooms are in-memory and Socket.IO
  connections are sticky, so cluster mode would shard players across processes
  that cannot see each other's rooms.
- `server/.env` is git-ignored and is not in the repo (see
  `server/.env.example`). A missing `.env` does **not** crash the server — it
  logs `FIREBASE_PROJECT_ID not set — auth verification disabled` and runs
  without auth or persistence. So a crash loop is never a missing `.env`.
- After changing `server/.env`, restart with `--update-env`; pm2 otherwise
  reuses the environment captured when the process was first started.
- `pm2 save` after a `start`/`delete` so the process list survives a reboot.
