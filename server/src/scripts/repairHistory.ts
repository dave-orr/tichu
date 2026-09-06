/**
 * History repair: fixes the gaps the stats audit (auditStats.ts) finds.
 *
 *  1. Backfills `games/{id}` summaries for finished games whose round logs
 *     exist but that predate summary writing (found via a collection-group
 *     query on `rounds`). Unfinished orphans are reported and left alone.
 *  2. Fills missing player uids in round logs and summaries by seat + name
 *     continuity within a game (a player who was disconnected when a round
 *     was logged, or who rejoined as a guest).
 *  3. `--attribute GAME:SEAT=UID` assigns a guest seat to an account for one
 *     game (repeatable). Only fills seats that currently have no uid.
 *  4. `--clean-legacy` deletes the dead counters: the literal dotted fields
 *     that set+merge created (e.g. a top-level field named "stats.roundsPlayed"),
 *     the nested `stats.*` counters on users (Elo fields are kept), and the
 *     `stats.*` counters + `breakdown` map on teams (Elo kept).
 *
 * Dry-run by default: prints every write it would make. Add `--apply` to
 * write. Run the audit afterwards to confirm.
 *
 * Usage (from the repo root, with server/.env populated):
 *   npm run repair-history                                  # dry run: 1 + 2
 *   npm run repair-history -- --attribute 9XX8_1782572159651:2=<uid>
 *   npm run repair-history -- --clean-legacy                # dry run incl. 4
 *   npm run repair-history -- --clean-legacy --apply        # write everything
 *   npm run repair-history -- --target 500                  # non-default target score
 */
import 'dotenv/config';
import {
  GameSummary, RoundLog, Seat, EMPTY_STAT_TOTALS,
  reconstructSummary, repairUids, SeatAttribution, UidFill,
} from '@tichu/shared';
import { firebaseAdmin } from '../firebase.js';

type Doc = FirebaseFirestore.DocumentData;
type Ref = FirebaseFirestore.DocumentReference;

type Write =
  | { kind: 'set'; ref: Ref; data: Doc; why: string }
  | { kind: 'update'; ref: Ref; data: Doc; why: string }
  | { kind: 'deleteFields'; ref: Ref; paths: FirebaseFirestore.FieldPath[]; why: string };

const LEGACY_COUNTER_KEYS = Object.keys(EMPTY_STAT_TOTALS);
const ELO_KEYS = new Set(['elo', 'eloGames', 'eloPeak']);

function parseArgs(argv: string[]) {
  const attributions: SeatAttribution[] = [];
  let apply = false, cleanLegacy = false, target = 1000;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--clean-legacy') cleanLegacy = true;
    else if (a === '--target') target = Number(argv[++i]);
    else if (a === '--attribute') {
      const m = /^([^:]+):([0-3])=(.+)$/.exec(argv[++i] ?? '');
      if (!m) { console.error(`--attribute expects GAME:SEAT=UID, got "${argv[i]}"`); process.exit(2); }
      attributions.push({ gameId: m[1], seat: Number(m[2]) as Seat, uid: m[3] });
    } else { console.error(`Unknown argument: ${a}`); process.exit(2); }
  }
  if (!Number.isFinite(target) || target <= 0) { console.error('--target must be a positive number'); process.exit(2); }
  return { attributions, apply, cleanLegacy, target };
}

function toSummary(data: Doc): GameSummary {
  return {
    gameId: data.gameId,
    finishedAt: data.finishedAt ?? 0,
    players: data.players ?? [],
    finalScores: data.finalScores ?? [0, 0],
    winningTeam: data.winningTeam ?? null,
    rounds: data.rounds ?? 0,
  };
}

const summaryDoc = (s: GameSummary): Doc => ({
  ...s,
  playerUids: s.players.map(p => p.uid).filter((u): u is string => !!u),
});

function describeFill(f: UidFill): string {
  const where = f.roundNumber === 0 ? 'summary' : `round ${f.roundNumber}`;
  return `${where} seat ${f.seat} (${f.name}) -> ${f.uid} [${f.reason}]`;
}

async function main(): Promise<void> {
  const { attributions, apply, cleanLegacy, target } = parseArgs(process.argv.slice(2));
  if (!firebaseAdmin) {
    console.error('Firebase is not configured. Run from server/ with a populated .env (FIREBASE_* vars).');
    process.exit(1);
  }
  const db = firebaseAdmin.firestore();
  const { FieldPath, FieldValue } = firebaseAdmin.firestore;
  const writes: Write[] = [];

  // ---- Load every round log, grouped by game, plus existing summaries ----
  const roundsSnap = await db.collectionGroup('rounds').get();
  const roundsByGame = new Map<string, { ref: Ref; data: RoundLog }[]>();
  for (const d of roundsSnap.docs) {
    const gameId = d.ref.parent.parent?.id;
    if (!gameId) continue;
    const list = roundsByGame.get(gameId) ?? [];
    list.push({ ref: d.ref, data: d.data() as RoundLog });
    roundsByGame.set(gameId, list);
  }
  for (const list of roundsByGame.values()) list.sort((a, b) => a.data.roundNumber - b.data.roundNumber);

  const gamesSnap = await db.collection('games').get();
  const summaries = new Map<string, GameSummary>(gamesSnap.docs.map(d => [d.id, toSummary(d.data())]));

  console.log(`Found ${roundsSnap.size} round logs across ${roundsByGame.size} games; ${summaries.size} have summaries.\n`);

  for (const a of attributions) {
    if (!roundsByGame.has(a.gameId)) console.warn(`⚠ --attribute: no round logs for game ${a.gameId}`);
  }

  // ---- 1 + 2 + 3: per game ----
  const unfinished: string[] = [];
  for (const [gameId, roundDocs] of roundsByGame) {
    const rounds = roundDocs.map(r => r.data);
    let summary = summaries.get(gameId) ?? null;
    let backfilled = false;

    if (!summary) {
      summary = reconstructSummary(gameId, rounds, target);
      if (!summary) { unfinished.push(gameId); continue; }
      backfilled = true;
    }

    const repaired = repairUids(gameId, rounds, summary, attributions);
    const summaryChanged = backfilled || repaired.fills.some(f => f.roundNumber === 0);

    if (summaryChanged) {
      const why = backfilled
        ? `backfill summary (${summary.rounds} rounds, ${summary.finalScores.join('-')}, team ${summary.winningTeam} won, ${new Date(summary.finishedAt).toISOString().slice(0, 10)})`
        : 'summary uids';
      writes.push({ kind: 'set', ref: db.collection('games').doc(gameId), data: summaryDoc(repaired.summary!), why: `${gameId}: ${why}` });
    }
    for (let i = 0; i < roundDocs.length; i++) {
      const fillsHere = repaired.fills.filter(f => f.roundNumber === rounds[i].roundNumber);
      if (fillsHere.length === 0) continue;
      writes.push({
        kind: 'update', ref: roundDocs[i].ref, data: { players: repaired.rounds[i].players },
        why: `${gameId} round ${rounds[i].roundNumber}: ${fillsHere.map(describeFill).join('; ')}`,
      });
    }
    const summaryFills = repaired.fills.filter(f => f.roundNumber === 0);
    if (summaryFills.length > 0 && !backfilled) {
      console.log(`${gameId}: ${summaryFills.map(describeFill).join('; ')}`);
    }
  }
  if (unfinished.length > 0) {
    console.log(`Orphaned round logs for ${unfinished.length} unfinished game(s), left alone: ${unfinished.join(', ')}\n`);
  }

  // ---- 4: legacy counters ----
  if (cleanLegacy) {
    const dotted = (data: Doc) => Object.keys(data).filter(k => k.includes('.')).map(k => new FieldPath(k));

    const usersSnap = await db.collection('users').get();
    for (const d of usersSnap.docs) {
      const data = d.data();
      const paths = dotted(data);
      for (const k of LEGACY_COUNTER_KEYS) {
        if (data.stats && k in data.stats) paths.push(new FieldPath('stats', k));
      }
      if (paths.length > 0) writes.push({ kind: 'deleteFields', ref: d.ref, paths, why: `user ${data.displayName ?? d.id}: drop ${paths.length} legacy field(s)` });
    }

    const teamsSnap = await db.collection('teams').get();
    for (const d of teamsSnap.docs) {
      const data = d.data();
      const paths = dotted(data);
      for (const k of Object.keys(data.stats ?? {})) {
        if (!ELO_KEYS.has(k)) paths.push(new FieldPath('stats', k));
      }
      if ('breakdown' in data) paths.push(new FieldPath('breakdown'));
      if (paths.length > 0) writes.push({ kind: 'deleteFields', ref: d.ref, paths, why: `team ${d.id}: drop ${paths.length} legacy field(s)` });
    }
  }

  // ---- Report / apply ----
  if (writes.length === 0) {
    console.log('Nothing to repair.');
    return;
  }
  console.log(`${apply ? 'Applying' : 'Would apply'} ${writes.length} write(s):`);
  for (const w of writes) console.log(`  ${w.kind.padEnd(12)} ${w.ref.path}  — ${w.why}`);
  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) {
      if (w.kind === 'set') batch.set(w.ref, w.data, { merge: true });
      else if (w.kind === 'update') batch.update(w.ref, w.data);
      else {
        const [first, ...rest] = w.paths;
        const more: unknown[] = [];
        for (const p of rest) more.push(p, FieldValue.delete());
        batch.update(w.ref, first, FieldValue.delete(), ...more);
      }
    }
    await batch.commit();
  }
  console.log(`\nDone. Run the audit (npm run audit-stats) to confirm.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
