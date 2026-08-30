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

### `ERR_REQUIRE_ESM: Must use import to load ES Module`

pm2 is loading the entry point with `require()` instead of `import()`. Every
workspace is ESM (`"type": "module"`), so this kills the process before it
binds a port and repeats identically on every restart — `pm2 restart` will
never clear it.

This is a pm2/Node problem on the host, not a code problem. pm2 decides how to
load the script in `lib/ProcessContainerFork.js`: `ProcessUtils.isESModule()`
walks up from the script's directory to the nearest `package.json` — for
`server/dist/index.js` that is `server/package.json`, which is `"type":
"module"` — and dynamic-`import()`s when true. Versions from roughly pm2 4.5
onward do this. Older pm2 has no such check and always `require()`s.

The catch: **the pm2 daemon keeps running the Node and pm2 it was started
with.** `pm2 restart` only restarts the app, so a stale daemon forks every
process under the old Node forever. Under nvm this bites twice, because pm2 is
installed per Node version — switching Node leaves you with no pm2, or an old
one, unless you reinstall it. A reboot can trigger this on its own: `pm2
startup` writes an init script pinned to one Node path, so the resurrected
daemon may not be the one that had been running fine.

Check what is actually running before changing anything:

```sh
pm2 -v                                # pm2 version (client)
node -v                               # must be >= 22.22.2
pm2 report | grep -iE 'node version|pm2 version'   # what the DAEMON runs
```

Fix by moving the host onto Node 22 and rebuilding the daemon under it:

```sh
pm2 save                 # keep the process list
pm2 kill                 # stop the OLD daemon — restart is not enough

nvm install 22 && nvm alias default 22
node -v                  # confirm v22.22.x before continuing

npm install -g pm2       # pm2 is per-Node-version under nvm; reinstall it

cd <repo> && npm ci && npm run build

pm2 start ecosystem.config.js
pm2 save
```

If the box must survive a reboot, re-point the init script at the new Node —
the old one still references the Node 20 path:

```sh
pm2 unstartup && pm2 startup   # run the command it prints, then: pm2 save
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

### Process is up, but the proxy still returns 503

The app is listening on a different port than the reverse proxy forwards to.
Ask each side what it thinks the port is.

What the app bound (it logs the port on every boot):

```sh
pm2 logs tichu --lines 20 --nostream | grep 'running on port'
ss -lptn | grep node                  # authoritative: what is actually bound
curl -s localhost:<port>/health       # should return JSON
```

What the proxy forwards to:

```sh
sudo nginx -T 2>/dev/null | grep -n proxy_pass
# Caddy instead:
grep -rn reverse_proxy /etc/caddy/Caddyfile
```

If `/health` answers on the app's port but the site is still 503, the two
numbers disagree — fix whichever is wrong and reload the proxy
(`sudo nginx -s reload`).

The usual cause is `PORT` being set in two places. It belongs in
`server/.env` only. `ecosystem.config.js` deliberately does not set it, since
a value there silently overrides the one the proxy was configured against.

### `server/.env` is being ignored (wrong port, auth disabled)

`server/src/index.ts` does `import 'dotenv/config'`, and dotenv resolves
`.env` against `process.cwd()` — **not** the script's own directory. So the
env file is only picked up when the process runs with its cwd inside
`server/`. `ecosystem.config.js` sets `cwd` there for exactly this reason;
starting the app by hand from the repo root does not.

Run from the repo root, the server still boots and looks healthy, but on the
default port 3000 instead of whatever `server/.env` says, with
`FIREBASE_PROJECT_ID not set — auth verification disabled` in the log, no
Firestore persistence, and `ALLOWED_ORIGINS`/`TRUST_PROXY` unset. The tell is
that warning appearing on a host that does have credentials configured:

```sh
pm2 logs tichu --lines 20 --nostream | grep -i firebase
```

Start it through the config rather than by hand:

```sh
cd <repo> && pm2 delete tichu; pm2 start ecosystem.config.js && pm2 save
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
  `server/.env.example`). A missing — or unread — `.env` does **not** crash the
  server: it logs `FIREBASE_PROJECT_ID not set — auth verification disabled`
  and runs without auth or persistence, on the default port. So a crash loop is
  never a missing `.env`, but a silent wrong-port 503 can be.
- After changing `server/.env`, restart with `--update-env`; pm2 otherwise
  reuses the environment captured when the process was first started.
- `pm2 save` after a `start`/`delete` so the process list survives a reboot.
- `pm2 restart` restarts the app, not the daemon. After changing Node versions
  or upgrading pm2, `pm2 kill` (or `pm2 update`) is what actually moves the
  daemon onto the new runtime — otherwise it keeps forking under the old one.
