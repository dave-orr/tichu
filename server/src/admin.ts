import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRoomDetails, getActivitySummary, type RoomDetail } from './rooms.js';
import { getPersistStatus, persistenceEnabled } from './persistence.js';

/**
 * Operator dashboard: which rooms are live, how old they are, when they last
 * saw activity, and whether their Firestore snapshot is current — the things
 * to check before restarting the server.
 *
 *   GET /admin                 HTML page (holds no data; asks for the token)
 *   GET /admin/rooms           JSON, requires `Authorization: Bearer $ADMIN_TOKEN`
 *   GET /admin/rooms?format=text   the same as a plain-text table (scripts/rooms.sh)
 *
 * Room codes are join credentials and the list carries player names, so the
 * data routes are disabled entirely unless ADMIN_TOKEN is set in server/.env.
 */

const MIN_TOKEN_LENGTH = 16;
const startedAt = Date.now();

function digest(s: string): Buffer {
  return crypto.createHash('sha256').update(s).digest();
}

function requireToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN ?? '';
  if (expected.length < MIN_TOKEN_LENGTH) {
    res.status(404).json({ error: `Dashboard disabled: set ADMIN_TOKEN (>= ${MIN_TOKEN_LENGTH} chars) in server/.env` });
    return;
  }
  const header = req.headers.authorization ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Compare digests so the check is constant-time regardless of length.
  if (!given || !crypto.timingSafeEqual(digest(given), digest(expected))) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

type RoomRow = RoomDetail & { snapshot: { savedAt: number | null; pending: boolean } };

function buildReport() {
  const rooms: RoomRow[] = getRoomDetails()
    .map(r => ({ ...r, snapshot: getPersistStatus(r.code) }))
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  return {
    now: Date.now(),
    serverStartedAt: startedAt,
    persistence: persistenceEnabled(),
    summary: getActivitySummary(),
    rooms,
  };
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h${String(m % 60).padStart(2, '0')}m` : `${Math.floor(h / 24)}d`;
}

function snapshotLabel(r: RoomRow, now: number): string {
  if (r.phase === 'waiting') return 'not saved (waiting)';
  if (!r.snapshot.savedAt) return r.snapshot.pending ? 'saving' : 'none';
  const age = `${ago(now - r.snapshot.savedAt)} ago`;
  return r.snapshot.pending ? `${age}, saving` : age;
}

function textReport(): string {
  const report = buildReport();
  const { now, rooms } = report;
  const lines = [
    `server up ${ago(now - report.serverStartedAt)}, persistence ${report.persistence ? 'on' : 'OFF — a restart loses every game'}`,
    `${rooms.length} room(s), ${report.summary.roomsInGame} in a game, ` +
      `${report.summary.playersConnected}/${report.summary.playersSeated} humans connected`,
  ];
  if (rooms.length === 0) return lines.join('\n') + '\n';
  const header = ['CODE', 'PHASE', 'RND', 'SCORE', 'AGE', 'IDLE', 'HUMANS', 'SNAPSHOT', 'PLAYERS'];
  const rows = rooms.map(r => {
    const humans = r.players.filter(p => p.name && !p.isAi);
    return [
      r.code,
      r.phase,
      String(r.roundNumber),
      `${r.scores[0]}-${r.scores[1]}`,
      ago(now - r.createdAt),
      ago(now - r.lastActivityAt),
      `${humans.filter(p => p.connected).length}/${humans.length}`,
      snapshotLabel(r, now),
      r.players.map(p => (p.name ? `${p.name}${p.isAi ? '(ai)' : p.connected ? '' : '(dc)'}` : '-')).join(', '),
    ];
  });
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map(row => row[i].length)));
  const fmt = (row: string[]) => row.map((c, i) => (i === row.length - 1 ? c : c.padEnd(widths[i]))).join('  ');
  return [...lines, '', fmt(header), ...rows.map(fmt)].join('\n') + '\n';
}

export function createAdminRouter(): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/', (_req, res) => {
    res.type('html').send(DASHBOARD_HTML);
  });

  router.get('/rooms', requireToken, (req, res) => {
    if (req.query.format === 'text') {
      res.type('text/plain').send(textReport());
      return;
    }
    res.json(buildReport());
  });

  return router;
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Tichu Rooms</title>
<style>
  :root { --bg:#f7f6f3; --fg:#1d1d1b; --muted:#6b6a66; --line:#dddbd5; --card:#fff;
          --ok:#1f7a3a; --warn:#a15c00; --bad:#b3261e; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#161615; --fg:#ecebe8; --muted:#9a9893; --line:#33322f; --card:#1f1f1d;
            --ok:#5cc47a; --warn:#e0a040; --bad:#ef6b62; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; background:var(--bg); color:var(--fg);
         font:14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .muted { color:var(--muted); }
  .verdict { margin:16px 0; padding:12px 14px; border-radius:8px; background:var(--card);
             border:1px solid var(--line); border-left-width:5px; }
  .verdict.ok { border-left-color:var(--ok); } .verdict.warn { border-left-color:var(--warn); }
  .verdict.bad { border-left-color:var(--bad); }
  .verdict b { display:block; font-size:16px; margin-bottom:2px; }
  .wrap { overflow-x:auto; background:var(--card); border:1px solid var(--line); border-radius:8px; }
  table { border-collapse:collapse; width:100%; min-width:760px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); font-weight:600; }
  tr:last-child td { border-bottom:0; }
  td.num { font-variant-numeric:tabular-nums; }
  code { font:600 14px ui-monospace, Menlo, monospace; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:1px; }
  .on { background:var(--ok); } .off { background:var(--bad); } .ai { background:var(--muted); }
  .tag { font-size:12px; padding:1px 6px; border-radius:4px; border:1px solid var(--line); white-space:nowrap; }
  .hot { color:var(--warn); font-weight:600; }
  .warn-t { color:var(--warn); } .bad-t { color:var(--bad); }
  form { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }
  input { flex:1; min-width:200px; padding:8px; font:inherit; background:var(--card); color:var(--fg);
          border:1px solid var(--line); border-radius:6px; }
  button { padding:8px 14px; font:inherit; border-radius:6px; border:1px solid var(--line);
           background:var(--card); color:var(--fg); cursor:pointer; }
  .bar { display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; }
</style>
</head>
<body>
<div class="bar">
  <div><h1>Tichu rooms</h1><div class="muted" id="meta">Loading…</div></div>
  <button id="logout" hidden>Forget token</button>
</div>
<div id="login" hidden>
  <form id="form"><input id="token" type="password" placeholder="ADMIN_TOKEN from server/.env" autocomplete="off"><button>Show rooms</button></form>
  <p class="muted" id="err"></p>
</div>
<div id="main" hidden>
  <div class="verdict" id="verdict"></div>
  <div class="wrap"><table>
    <thead><tr><th>Room</th><th>Phase</th><th>Score</th><th>Age</th><th>Last activity</th><th>Players</th><th>Snapshot</th></tr></thead>
    <tbody id="rows"></tbody>
  </table></div>
  <p class="muted">Last activity = last state change (a play, join, leave or reconnect). Waiting rooms are never
  snapshotted, so a restart drops them. A game whose humans are all disconnected is deleted at the time shown.
  Refreshes every 5s.</p>
</div>
<script>
(function () {
  var KEY = 'tichu-admin-token';
  var token = null;
  try { token = localStorage.getItem(KEY); } catch (e) {}
  var $ = function (id) { return document.getElementById(id); };
  var timer = null;

  function ago(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    var h = Math.floor(m / 60);
    return h < 48 ? h + 'h ' + (m % 60) + 'm' : Math.floor(h / 24) + 'd';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clock(t) { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  function showLogin(msg) {
    clearTimeout(timer);
    $('main').hidden = true; $('logout').hidden = true; $('login').hidden = false;
    $('meta').textContent = 'Enter the admin token to continue.';
    $('err').textContent = msg || '';
  }

  function render(d) {
    $('login').hidden = true; $('main').hidden = false; $('logout').hidden = false;
    var now = d.now, live = 0, recent = 0;
    $('meta').textContent = 'Server up ' + ago(now - d.serverStartedAt) + ' · persistence ' +
      (d.persistence ? 'on' : 'OFF') + ' · updated ' + new Date(now).toLocaleTimeString();
    var rows = d.rooms.map(function (r) {
      var inGame = r.phase !== 'waiting' && r.phase !== 'gameEnd';
      var idle = now - r.lastActivityAt;
      if (inGame) { live++; if (idle < 10 * 60 * 1000) recent++; }
      var players = r.players.map(function (p) {
        if (!p.name) return '<span class="muted">empty</span>';
        var cls = p.isAi ? 'ai' : p.connected ? 'on' : 'off';
        var title = p.isAi ? 'AI' : p.connected ? 'connected' : 'disconnected';
        return '<span title="' + title + '"><span class="dot ' + cls + '"></span>' + esc(p.name) + '</span>';
      }).join('<br>');
      var snap;
      if (r.phase === 'waiting') snap = '<span class="muted">not saved</span>';
      else if (!d.persistence) snap = '<span class="bad-t">off</span>';
      else if (!r.snapshot.savedAt) snap = r.snapshot.pending ? 'saving…' : '<span class="warn-t">none yet</span>';
      else {
        var stale = r.snapshot.savedAt < r.lastActivityAt - 5000 && !r.snapshot.pending;
        snap = '<span class="' + (stale ? 'warn-t' : '') + '">' + ago(now - r.snapshot.savedAt) + ' ago</span>' +
          (r.snapshot.pending ? ' · saving…' : '');
      }
      var cleanup = r.abandonedCleanupAt
        ? '<br><span class="bad-t">deleted at ' + clock(r.abandonedCleanupAt) + ' (in ' + ago(r.abandonedCleanupAt - now) + ')</span>' : '';
      return '<tr>' +
        '<td><code>' + esc(r.code) + '</code></td>' +
        '<td><span class="tag">' + esc(r.phase) + '</span>' + (r.roundNumber ? '<br><span class="muted">round ' + r.roundNumber + '</span>' : '') + '</td>' +
        '<td class="num">' + r.scores[0] + ' – ' + r.scores[1] + '<br><span class="muted">to ' + r.targetScore + '</span></td>' +
        '<td class="num">' + ago(now - r.createdAt) + (r.phase !== 'waiting' ? '<br><span class="muted">game ' + ago(now - r.gameStartedAt) + '</span>' : '') + '</td>' +
        '<td class="num"><span class="' + (inGame && idle < 2 * 60 * 1000 ? 'hot' : '') + '">' + ago(idle) + ' ago</span>' + cleanup + '</td>' +
        '<td>' + players + '</td>' +
        '<td>' + snap + '</td>' +
      '</tr>';
    });
    $('rows').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="7" class="muted">No rooms.</td></tr>';

    var v = $('verdict'), cls, head, body;
    var waiting = d.summary.phases.waiting || 0;
    if (!d.persistence && live) { cls = 'bad'; head = 'Restarting now loses ' + live + ' game(s).'; body = 'Persistence is off (no Firebase), so nothing comes back after a restart.'; }
    else if (recent) { cls = 'warn'; head = recent + ' game(s) active in the last 10 minutes.'; body = 'A restart disconnects them; they reconnect to the saved snapshot once the server is back.'; }
    else if (live) { cls = 'warn'; head = live + ' game(s) in progress, all idle 10+ minutes.'; body = 'They are snapshotted and will be restored after a restart.'; }
    else { cls = 'ok'; head = 'No games in progress.'; body = 'Safe to restart.'; }
    if (waiting) body += ' ' + waiting + ' waiting room(s) will be dropped.';
    v.className = 'verdict ' + cls;
    v.innerHTML = '<b>' + esc(head) + '</b>' + esc(body);
  }

  function load() {
    clearTimeout(timer);
    fetch('/admin/rooms', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' })
      .then(function (res) {
        if (res.status === 401) { try { localStorage.removeItem(KEY); } catch (e) {} token = null; showLogin('Wrong token.'); return null; }
        if (!res.ok) return res.json().then(function (j) { throw new Error(j.error || res.statusText); });
        return res.json();
      })
      .then(function (d) { if (d) { render(d); timer = setTimeout(load, 5000); } })
      .catch(function (e) { $('meta').textContent = 'Error: ' + e.message + ' — retrying'; timer = setTimeout(load, 5000); });
  }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    token = $('token').value.trim();
    if (!token) return;
    try { localStorage.setItem(KEY, token); } catch (err) {}
    $('token').value = '';
    load();
  });
  $('logout').addEventListener('click', function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    token = null; showLogin();
  });

  if (token) load(); else showLogin();
})();
</script>
</body>
</html>
`;
