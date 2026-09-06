/**
 * Stats audit: recompute every player's and pairing's totals from the game
 * history (`games/*` + `games/*\/rounds`) with the same shared function the
 * stats page uses, and compare them field-by-field against the legacy
 * counters stored on `users/*.stats` and `teams/*`. Also sanity-checks the
 * history itself (score continuity between rounds, round counts, winners).
 *
 * Read-only: never writes to Firestore.
 *
 * Usage (from the server/ directory, with server/.env populated):
 *   npm run audit-stats                    # human-readable report
 *   npm run audit-stats -- --json          # report as JSON (for sharing)
 *   npm run audit-stats -- --dump FILE     # also write the raw collections to FILE
 *
 * The dump and the report contain uids, emails and display names — keep
 * them out of git (server/stats-audit*.json is ignored).
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import {
  GameSummary, RoundLog, StatTotals, EMPTY_STAT_TOTALS, GameRecord,
  computePlayerStats, computePairingBreakdown, teamOf,
} from '@tichu/shared';
import { firebaseAdmin } from '../firebase.js';

type Doc = FirebaseFirestore.DocumentData;

type Mismatch = { field: string; stored: number | null; derived: number };

type UserFinding = {
  uid: string;
  name: string;
  hasUserDoc: boolean;
  mismatches: Mismatch[];
  elo: { elo: number | null; eloGames: number | null; eloPeak: number | null };
  derivedGames: number;
};

type TeamFinding = {
  key: string;
  names: string;
  hasTeamDoc: boolean;
  mismatches: Mismatch[];
  elo: { elo: number | null; eloGames: number | null };
  derivedGames: number;
};

type HistoryIssue = { gameId: string; issue: string };

type Report = {
  generatedAt: string;
  counts: { users: number; teams: number; games: number; rounds: number };
  users: UserFinding[];
  teams: TeamFinding[];
  history: HistoryIssue[];
};

const STAT_FIELDS = Object.keys(EMPTY_STAT_TOTALS) as (keyof StatTotals)[];

/** Fields the legacy per-team counters actually tracked. */
const TEAM_FIELDS: (keyof StatTotals)[] = [
  'gamesPlayed', 'gamesWon', 'roundsPlayed', 'doubleVictories',
  'totalPointDifferential', 'bombsPlayed', 'bombsFaced',
];
/** Fields the legacy per-team `breakdown.{uid}` tracked. */
const BREAKDOWN_FIELDS: (keyof StatTotals)[] = [
  'tichuCalls', 'tichuSuccesses', 'grandTichuCalls', 'grandTichuSuccesses',
  'roundsWonFirstOut', 'bombsPlayed',
];

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

function compare(stored: Doc | undefined, derived: StatTotals, fields: (keyof StatTotals)[], prefix = ''): Mismatch[] {
  const out: Mismatch[] = [];
  for (const f of fields) {
    const s = num(stored?.[f]);
    // A missing counter means 0 was written; only flag if the derived value differs.
    if ((s ?? 0) !== derived[f]) out.push({ field: prefix + f, stored: s, derived: derived[f] });
  }
  return out;
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

function checkHistory(records: GameRecord[]): HistoryIssue[] {
  const issues: HistoryIssue[] = [];
  for (const { summary, rounds } of records) {
    const g = summary.gameId;
    const add = (issue: string) => issues.push({ gameId: g, issue });

    if (rounds.length === 0) { add('no round logs'); continue; }
    if (summary.rounds !== rounds.length) add(`summary says ${summary.rounds} rounds, found ${rounds.length}`);

    const nums = rounds.map(r => r.roundNumber);
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] !== i + 1) { add(`round numbers not contiguous: ${nums.join(',')}`); break; }
    }

    for (let i = 1; i < rounds.length; i++) {
      const prev = rounds[i - 1], cur = rounds[i];
      if (prev.scoresAfterRound[0] !== cur.scoresBeforeRound[0] || prev.scoresAfterRound[1] !== cur.scoresBeforeRound[1]) {
        add(`round ${cur.roundNumber} starts at ${cur.scoresBeforeRound} but round ${prev.roundNumber} ended at ${prev.scoresAfterRound}`);
      }
    }
    const first = rounds[0];
    if (first.scoresBeforeRound[0] !== 0 || first.scoresBeforeRound[1] !== 0) {
      add(`round ${first.roundNumber} starts at ${first.scoresBeforeRound}, not 0-0`);
    }
    const last = rounds[rounds.length - 1];
    if (last.scoresAfterRound[0] !== summary.finalScores[0] || last.scoresAfterRound[1] !== summary.finalScores[1]) {
      add(`final round ends at ${last.scoresAfterRound} but summary finalScores is ${summary.finalScores}`);
    }

    for (const r of rounds) {
      const expected: [number, number] = [
        r.scoresBeforeRound[0] + r.roundCardPoints[0] + r.tichuBonuses[0],
        r.scoresBeforeRound[1] + r.roundCardPoints[1] + r.tichuBonuses[1],
      ];
      if (expected[0] !== r.scoresAfterRound[0] || expected[1] !== r.scoresAfterRound[1]) {
        add(`round ${r.roundNumber}: before + points + bonuses = ${expected} but after = ${r.scoresAfterRound}`);
      }
      if (r.players.length !== 4) add(`round ${r.roundNumber}: ${r.players.length} player entries`);
      for (const p of r.players) {
        if (p.uid === null) add(`round ${r.roundNumber}: seat ${p.seat} (${p.name}) has no uid — guest or AI; not credited`);
        else if (teamOf(summary, p.uid) === null) add(`round ${r.roundNumber}: seat ${p.seat} uid ${p.uid} (${p.name}) is not in the summary (substituted out?)`);
      }
    }

    const [s0, s1] = summary.finalScores;
    const expectedWinner = s0 === s1 ? null : s0 > s1 ? 0 : 1;
    if (summary.winningTeam !== expectedWinner) add(`winningTeam ${summary.winningTeam} but finalScores ${summary.finalScores}`);
    if (summary.players.length !== 4) add(`summary has ${summary.players.length} players`);
    for (const p of summary.players) {
      if (p.uid === null) add(`seat ${p.seat} (${p.name}) has no uid in summary — guest or AI`);
    }
  }
  return issues;
}

function fmt(n: number | null): string {
  return n === null ? '(missing)' : String(n);
}

function printReport(r: Report): void {
  const c = r.counts;
  console.log(`Audited ${c.users} user docs, ${c.teams} team docs, ${c.games} games, ${c.rounds} rounds.\n`);

  console.log('=== Players: stored counters vs derived from history ===');
  let clean = 0;
  for (const u of r.users) {
    if (u.mismatches.length === 0 && u.hasUserDoc) { clean++; continue; }
    console.log(`\n${u.name} (${u.uid})${u.hasUserDoc ? '' : '  ** no users/ doc **'}`);
    console.log(`  Elo ${fmt(u.elo.elo)}, rated games ${fmt(u.elo.eloGames)}, peak ${fmt(u.elo.eloPeak)}; finished games in history: ${u.derivedGames}`);
    for (const m of u.mismatches) {
      console.log(`  ${m.field.padEnd(26)} stored ${fmt(m.stored).padStart(9)}   derived ${String(m.derived).padStart(6)}`);
    }
  }
  console.log(`\n${clean} player(s) with counters matching history exactly.`);

  console.log('\n=== Pairings: stored counters vs derived from history ===');
  clean = 0;
  for (const t of r.teams) {
    if (t.mismatches.length === 0 && t.hasTeamDoc) { clean++; continue; }
    console.log(`\n${t.names} (${t.key})${t.hasTeamDoc ? '' : '  ** no teams/ doc **'}`);
    console.log(`  Pairing Elo ${fmt(t.elo.elo)}, rated games ${fmt(t.elo.eloGames)}; finished games together in history: ${t.derivedGames}`);
    for (const m of t.mismatches) {
      console.log(`  ${m.field.padEnd(40)} stored ${fmt(m.stored).padStart(9)}   derived ${String(m.derived).padStart(6)}`);
    }
  }
  console.log(`\n${clean} pairing(s) with counters matching history exactly.`);

  console.log('\n=== History self-consistency ===');
  if (r.history.length === 0) console.log('No issues found.');
  for (const h of r.history) console.log(`  ${h.gameId}: ${h.issue}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const dumpIdx = args.indexOf('--dump');
  const dumpFile = dumpIdx >= 0 ? (args[dumpIdx + 1] ?? 'stats-audit-dump.json') : null;

  if (!firebaseAdmin) {
    console.error('Firebase is not configured. Run from server/ with a populated .env (FIREBASE_* vars).');
    process.exit(1);
  }
  const db = firebaseAdmin.firestore();

  // ---- Load everything ----
  const [usersSnap, teamsSnap, gamesSnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('teams').get(),
    db.collection('games').get(),
  ]);
  const users = new Map<string, Doc>(usersSnap.docs.map(d => [d.id, d.data()]));
  const teams = new Map<string, Doc>(teamsSnap.docs.map(d => [d.id, d.data()]));

  const records: GameRecord[] = await Promise.all(gamesSnap.docs.map(async d => {
    const roundsSnap = await d.ref.collection('rounds').get();
    const rounds = roundsSnap.docs
      .map(r => r.data() as RoundLog)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    return { summary: toSummary(d.data()), rounds };
  }));
  const roundCount = records.reduce((n, r) => n + r.rounds.length, 0);

  if (dumpFile) {
    const dump = {
      users: Object.fromEntries(users),
      teams: Object.fromEntries(teams),
      games: records,
    };
    writeFileSync(dumpFile, JSON.stringify(dump, null, 2));
    console.error(`Wrote raw dump to ${dumpFile}`);
  }

  const nameOf = (uid: string): string => {
    const fromUser = users.get(uid)?.displayName;
    if (fromUser) return fromUser;
    for (const { summary } of records) {
      const p = summary.players.find(pl => pl.uid === uid);
      if (p) return p.name;
    }
    return 'Player';
  };

  // ---- Players: every user doc, plus any uid that appears in history without one ----
  const allUids = new Set<string>(users.keys());
  for (const { summary } of records) {
    for (const p of summary.players) if (p.uid) allUids.add(p.uid);
  }
  const userFindings: UserFinding[] = [];
  for (const uid of allUids) {
    const stored = users.get(uid);
    const derived = computePlayerStats(records, uid);
    if (!stored && derived.gamesPlayed === 0) continue;
    userFindings.push({
      uid,
      name: nameOf(uid),
      hasUserDoc: !!stored,
      mismatches: compare(stored?.stats, derived, STAT_FIELDS),
      elo: { elo: num(stored?.stats?.elo), eloGames: num(stored?.stats?.eloGames), eloPeak: num(stored?.stats?.eloPeak) },
      derivedGames: derived.gamesPlayed,
    });
  }
  userFindings.sort((a, b) => b.mismatches.length - a.mismatches.length || a.name.localeCompare(b.name));

  // ---- Pairings: every team doc, plus any pairing seen in history without one ----
  const pairKeys = new Set<string>(teams.keys());
  for (const { summary } of records) {
    for (const team of [0, 1] as const) {
      const uids = summary.players.filter(p => p.team === team).map(p => p.uid);
      if (uids.length === 2 && uids.every((u): u is string => !!u)) pairKeys.add([...uids].sort().join('_'));
    }
  }
  const teamFindings: TeamFinding[] = [];
  for (const key of pairKeys) {
    const stored = teams.get(key);
    const uids: string[] = stored?.playerUids ?? key.split('_');
    if (uids.length !== 2) {
      teamFindings.push({ key, names: '?', hasTeamDoc: !!stored, mismatches: [], elo: { elo: null, eloGames: null }, derivedGames: 0 });
      continue;
    }
    const [a, b] = uids;
    const bd = computePairingBreakdown(records, a, b);
    if (!stored && bd.totals.gamesPlayed === 0) continue;
    const mismatches = compare(stored?.stats, bd.totals, TEAM_FIELDS);
    mismatches.push(...compare(stored?.breakdown?.[a], bd.perPlayer[0], BREAKDOWN_FIELDS, `breakdown.${nameOf(a)}.`));
    mismatches.push(...compare(stored?.breakdown?.[b], bd.perPlayer[1], BREAKDOWN_FIELDS, `breakdown.${nameOf(b)}.`));
    teamFindings.push({
      key,
      names: `${nameOf(a)} + ${nameOf(b)}`,
      hasTeamDoc: !!stored,
      mismatches,
      elo: { elo: num(stored?.stats?.elo), eloGames: num(stored?.stats?.eloGames) },
      derivedGames: bd.totals.gamesPlayed,
    });
  }
  teamFindings.sort((a, b) => b.mismatches.length - a.mismatches.length || a.names.localeCompare(b.names));

  const report: Report = {
    generatedAt: new Date().toISOString(),
    counts: { users: users.size, teams: teams.size, games: records.length, rounds: roundCount },
    users: userFindings,
    teams: teamFindings,
    history: checkHistory(records),
  };

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
