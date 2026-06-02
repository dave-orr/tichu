/**
 * One-off Elo seeding / import script.
 *
 * Use this to set players' Elo ratings manually — e.g. to carry over ratings
 * from BoardGameArena. Because BGA and this app both use a 400-point divisor,
 * converting between the two scales is just an additive shift: BGA starts at 0,
 * we start at 1500, so the default conversion is `chessElo = bgaScore + 1500`.
 *
 * Usage (from the server/ directory, with server/.env populated):
 *   npm run import-elo                 # reads ./elo-import.json
 *   npm run import-elo my-file.json    # reads a specific file
 *   npm run import-elo --dry-run       # show what would change, write nothing
 *
 * See elo-import.example.json for the file format.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { ELO_INITIAL, ELO_PROVISIONAL_GAMES } from '@tichu/shared';
import { firebaseAdmin } from '../firebase.js';

type PlayerEntry = {
  uid?: string;    // Firebase uid (most precise match)
  email?: string;  // Google account email
  name?: string;   // displayName (used only if uid/email absent)
  bga?: number;    // BoardGameArena-scale score (converted via offset)
  elo?: number;    // OR a direct chess-scale rating (skips conversion)
  games?: number;  // optional: rated games already played (controls K-factor)
};

type ImportConfig = {
  offset?: number;       // added to each `bga` score (default 1500 = our starting Elo)
  defaultGames?: number; // games assigned to imported players (default = provisional threshold, so they use the standard K)
  players: PlayerEntry[];
};

function label(entry: PlayerEntry): string {
  return entry.uid ?? entry.email ?? entry.name ?? '(unidentified)';
}

async function resolveUser(
  db: FirebaseFirestore.Firestore,
  entry: PlayerEntry,
): Promise<{ uid: string; data: FirebaseFirestore.DocumentData | undefined } | null> {
  if (entry.uid) {
    const snap = await db.collection('users').doc(entry.uid).get();
    return snap.exists ? { uid: snap.id, data: snap.data() } : null;
  }
  if (entry.email) {
    const q = await db.collection('users').where('email', '==', entry.email).limit(1).get();
    if (!q.empty) return { uid: q.docs[0].id, data: q.docs[0].data() };
  }
  if (entry.name) {
    const q = await db.collection('users').where('displayName', '==', entry.name).limit(2).get();
    if (q.size > 1) {
      console.warn(`  ⚠ multiple users named "${entry.name}" — use uid or email to disambiguate; skipping`);
      return null;
    }
    if (!q.empty) return { uid: q.docs[0].id, data: q.docs[0].data() };
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = args.find(a => !a.startsWith('--')) ?? 'elo-import.json';

  if (!firebaseAdmin) {
    console.error('Firebase is not configured. Run from server/ with a populated .env (FIREBASE_* vars).');
    process.exit(1);
  }

  let config: ImportConfig;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Could not read/parse ${file}:`, (err as Error).message);
    process.exit(1);
  }

  const offset = config.offset ?? ELO_INITIAL;
  const defaultGames = config.defaultGames ?? ELO_PROVISIONAL_GAMES;
  const db = firebaseAdmin.firestore();

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Importing ${config.players.length} player(s) from ${file} (offset ${offset})\n`);

  let updated = 0;
  let skipped = 0;

  for (const entry of config.players) {
    const elo =
      typeof entry.elo === 'number' ? Math.round(entry.elo)
      : typeof entry.bga === 'number' ? Math.round(entry.bga + offset)
      : NaN;
    if (Number.isNaN(elo)) {
      console.warn(`  ⚠ ${label(entry)}: no "bga" or "elo" value — skipping`);
      skipped++;
      continue;
    }

    const user = await resolveUser(db, entry);
    if (!user) {
      console.warn(`  ⚠ ${label(entry)}: no matching user found — skipping`);
      skipped++;
      continue;
    }

    const games = entry.games ?? defaultGames;
    const prevPeak = typeof user.data?.stats?.eloPeak === 'number' ? user.data.stats.eloPeak : ELO_INITIAL;
    const peak = Math.max(prevPeak, elo);
    const name = user.data?.displayName ?? user.data?.email ?? user.uid;

    console.log(`  ${name} (${user.uid}): elo=${elo} games=${games} peak=${peak}`);

    if (!dryRun) {
      await db.collection('users').doc(user.uid).set(
        { stats: { elo, eloGames: games, eloPeak: peak } },
        { merge: true },
      );
    }
    updated++;
  }

  console.log(`\n${dryRun ? '[DRY RUN] would update' : 'Updated'} ${updated} player(s), skipped ${skipped}.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
