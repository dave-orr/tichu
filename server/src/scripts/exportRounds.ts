/**
 * Round-log export for bot research (dave-orr/tichu-ai): prints summary
 * statistics of every logged round (1-2 rate, Tichu/Grand call and success
 * rates, bombs) and writes the rounds as anonymized JSON Lines (no uids or
 * names; game ids replaced by a sequence number).
 *
 * Read-only: never writes to Firestore.
 *
 * Usage (from the repo root, with server/.env populated):
 *   npm run export-rounds                          # stats + server/rounds-export.jsonl
 *   npm run export-rounds -- --out FILE            # choose the output file
 *   npm run export-rounds -- --stats-only          # just the stats
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { RoundLog } from '@tichu/shared';
import { firebaseAdmin } from '../firebase.js';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'rounds-export.jsonl';
const statsOnly = args.includes('--stats-only');

if (!firebaseAdmin) {
  console.error('Firebase is not configured (server/.env).');
  process.exit(1);
}

const snap = await firebaseAdmin.firestore().collectionGroup('rounds').get();
const rounds = snap.docs.map(d => d.data() as RoundLog).sort((a, b) => a.timestamp - b.timestamp);

const gameIds = new Map<string, number>();
const anon = rounds.map(r => {
  if (!gameIds.has(r.gameId)) gameIds.set(r.gameId, gameIds.size);
  return {
    ...r,
    gameId: gameIds.get(r.gameId),
    players: r.players.map(({ uid, name, ...p }) => ({ ...p, signedIn: uid != null })),
  };
});

const pct = (n: number, d: number) => (d ? `${(100 * n / d).toFixed(1)}%` : '-');
const calls = { small: [0, 0], grand: [0, 0] };
for (const r of rounds) {
  for (const p of r.players) {
    if (p.tichuCall === 'small' || p.tichuCall === 'grand') {
      calls[p.tichuCall][0]++;
      if (p.outOrder === 1) calls[p.tichuCall][1]++;
    }
  }
}
const n = rounds.length;
const doubles = rounds.filter(r => r.isDoubleVictory).length;
const bombs = rounds.reduce((s, r) => s + (r.bombs?.length ?? 0), 0);
console.log(`rounds: ${n} in ${gameIds.size} games (${rounds.filter(r => r.plays?.length).length} with a play log)`);
console.log(`1-2 finishes: ${doubles} (${pct(doubles, n)} of rounds)`);
console.log(`Tichu calls: ${calls.small[0]} (${pct(calls.small[0], 4 * n)} of seats), made ${pct(calls.small[1], calls.small[0])}`);
console.log(`Grand calls: ${calls.grand[0]} (${pct(calls.grand[0], 4 * n)} of seats), made ${pct(calls.grand[1], calls.grand[0])}`);
console.log(`bombs: ${bombs} (${(bombs / Math.max(n, 1)).toFixed(2)} per round)`);

if (!statsOnly) {
  writeFileSync(out, anon.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log(`wrote ${n} anonymized rounds to ${out}`);
}
process.exit(0);
