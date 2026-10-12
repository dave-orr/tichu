// Must stay first: loads .env and enforces the Node floor before any module
// that reads process.env at import time (firebase.ts) is evaluated.
import { describeStartup } from './bootstrap.js';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupHandlers } from './handler.js';
import { createApiRouter } from './api.js';
import { createAdminRouter } from './admin.js';
import { getActivitySummary } from './rooms.js';
import { flushPersistence } from './persistence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Last line of defence: an unhandled rejection from a stray async path must
// not take every live game down with it. Socket handlers are individually
// guarded (see handler.ts), so this should only ever log.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const app = express();
app.use(cors());

const httpServer = createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'https://tichu.squidbox.com'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e4, // 10 KB max payload
});

const restoreDone = setupHandlers(io);

// AI player HTTP API
app.use(express.json());
app.use('/api', createApiRouter(io));

// Operator dashboard (token-protected): live rooms, age, last activity.
app.use('/admin', createAdminRouter());

// Serve static client files in production
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));

// Health + activity: aggregate counts so an operator can judge whether a
// restart would interrupt anyone (roomsInGame > 0 means live games).
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ...getActivitySummary() });
});

// SPA fallback — serve index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Log the resolved runtime before binding, so a failure to listen still leaves
// the diagnosis (wrong Node, unread .env, missing client build) in the log.
console.log(describeStartup(clientDist, PORT));

// Don't accept connections until persisted rooms are back in memory: clients
// reconnect within a second or two of a restart, and one that asks for its
// room before the restore lands is told the room is gone and drops its seat.
// Capped so a hung Firestore can't keep the site down; refused connections
// meanwhile just make clients retry.
const RESTORE_WAIT_MS = 15_000;
Promise.race([
  restoreDone,
  new Promise<void>(resolve => setTimeout(() => {
    console.error(`Room restore still running after ${RESTORE_WAIT_MS}ms — listening anyway`);
    resolve();
  }, RESTORE_WAIT_MS).unref()),
]).then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Tichu server running on port ${PORT}`);
  });
});

// pm2 stops the app with SIGINT (SIGTERM elsewhere). Without a handler Node
// exits at once and drops the last ~1.5s of debounced snapshot writes, so the
// restored game would rewind past the final moves. Flush, then exit; pm2's
// kill_timeout (ecosystem.config.js) must exceed the flush budget.
const SHUTDOWN_FLUSH_MS = 5_000;
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — flushing room snapshots before exit`);
    flushPersistence(SHUTDOWN_FLUSH_MS)
      .then(n => console.log(`Flushed ${n} snapshot write(s); exiting`))
      .catch(err => console.error('Snapshot flush failed:', err))
      .finally(() => process.exit(0));
  });
}
