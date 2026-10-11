import { Card, GameSummary, RoundLog, RoundPlay, Seat } from './types.js';
import { identifyCombo, isBomb } from './combinations.js';
import { GameRecord, gameComeback, teamOf } from './stats.js';

// ===== Achievements =====
//
// Counting achievements: each is a moment that can happen any number of
// times, derived (like the rest of the stats page) from game history, so
// achievements apply retroactively wherever the history has the data.

export type AchievementId =
  | 'grand-theft'
  | 'phoenix-rising'
  | 'lazarus'
  | 'out-bombed'
  | 'double-tap'
  | 'photo-finish'
  | 'wire-to-wire'
  | 'hat-trick'
  | 'dragons-hoard'
  | 'ganis'
  | 'score-based-grand';

export type AchievementDef = {
  id: AchievementId;
  name: string;
  description: string;
  /**
   * Needs data that round logs only started recording later (every play, or
   * the first 8 cards), so it only counts games played since.
   */
  newLogsOnly?: boolean;
};

/** Photo Finish: winning margin at most this. */
export const PHOTO_FINISH_MARGIN = 10;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'grand-theft', name: 'Grand Theft', description: 'Make a Grand Tichu when an opponent also called Grand' },
  { id: 'phoenix-rising', name: 'Phoenix Rising', description: 'Win a game after trailing by 500 or more' },
  { id: 'lazarus', name: 'Lazarus', description: 'Win a game after trailing by 1000 or more' },
  { id: 'out-bombed', name: 'Out-Bombed', description: 'Have your bomb bombed', newLogsOnly: true },
  { id: 'double-tap', name: 'Double Tap', description: 'Play two bombs in the same hand' },
  { id: 'photo-finish', name: 'Photo Finish', description: `Win a game by ${PHOTO_FINISH_MARGIN} points or less` },
  { id: 'wire-to-wire', name: 'Wire to Wire', description: 'Win a game while ahead after every round' },
  { id: 'hat-trick', name: 'Hat Trick', description: 'Make Tichu or Grand Tichu three rounds in a row' },
  { id: 'dragons-hoard', name: "Dragon's Hoard", description: 'Bomb your own Dragon', newLogsOnly: true },
  { id: 'ganis', name: 'Ganis!', description: 'Play a 14-card straight', newLogsOnly: true },
  {
    id: 'score-based-grand',
    name: 'Score-Based Grand',
    description: 'Call Grand Tichu without a Dragon, Phoenix or Ace in your first 8 cards',
    newLogsOnly: true,
  },
];

export type AchievementCount = {
  id: AchievementId;
  count: number;
  /** The most recent game it was earned in. */
  lastGame: GameSummary | null;
};

const isSpecial = (c: Card, name: string) => c.type === 'special' && c.name === name;
const isBombPlay = (p: RoundPlay) => {
  const combo = identifyCombo(p.cards);
  return !!combo && isBomb(combo);
};

/** Plays that directly preceded each play in the same trick (null for a lead). */
function previousInTrick(plays: readonly RoundPlay[], i: number): RoundPlay | null {
  return i > 0 && plays[i - 1].trick === plays[i].trick ? plays[i - 1] : null;
}

/** How many times `uid` earned each achievement in one round. */
function roundAchievements(r: RoundLog, uid: string, earn: (id: AchievementId) => void): void {
  const mine = r.players.filter(pl => pl.uid === uid);
  if (mine.length === 0) return;
  const mySeats = new Set<Seat>(mine.map(pl => pl.seat));

  for (const pl of mine) {
    if (pl.tichuCall !== 'grand') continue;
    if (pl.outOrder === 1 && r.players.some(o => o.team !== pl.team && o.tichuCall === 'grand')) {
      earn('grand-theft');
    }
    const eight = pl.firstEight;
    if (eight && eight.length === 8 && !eight.some(c =>
      isSpecial(c, 'dragon') || isSpecial(c, 'phoenix') || (c.type === 'normal' && c.rank === 14))) {
      earn('score-based-grand');
    }
  }

  if (r.bombs.filter(b => mySeats.has(b.seat)).length >= 2) earn('double-tap');

  const plays = r.plays ?? [];
  plays.forEach((play, i) => {
    if (!mySeats.has(play.seat)) {
      // Someone else's bomb right on top of one of ours.
      const prev = previousInTrick(plays, i);
      if (prev && mySeats.has(prev.seat) && isBombPlay(prev) && isBombPlay(play)) earn('out-bombed');
      return;
    }
    if (play.cards.length === 14 && identifyCombo(play.cards)?.type === 'straight') earn('ganis');
    const prev = previousInTrick(plays, i);
    if (prev && prev.seat === play.seat && prev.cards.length === 1 && isSpecial(prev.cards[0], 'dragon')
      && isBombPlay(play)) {
      earn('dragons-hoard');
    }
  });
}

/** Achievement counts for `uid` across `records`, in `ACHIEVEMENTS` order. */
export function computeAchievements(records: readonly GameRecord[], uid: string): AchievementCount[] {
  const counts = new Map<AchievementId, AchievementCount>(
    ACHIEVEMENTS.map(a => [a.id, { id: a.id, count: 0, lastGame: null }]),
  );

  for (const record of records) {
    const { summary } = record;
    const team = teamOf(summary, uid);
    if (team === null) continue;
    const other = team === 0 ? 1 : 0;
    const rounds = [...record.rounds].sort((a, b) => a.roundNumber - b.roundNumber);

    const earn = (id: AchievementId) => {
      const c = counts.get(id)!;
      c.count++;
      if (!c.lastGame || summary.finishedAt > c.lastGame.finishedAt) c.lastGame = summary;
    };

    // ---- Game-level (team result) ----
    if (summary.winningTeam === team) {
      const comeback = gameComeback(record);
      if (comeback && comeback.deficit >= 500) earn('phoenix-rising');
      if (comeback && comeback.deficit >= 1000) earn('lazarus');
      if (summary.finalScores[team] - summary.finalScores[other] <= PHOTO_FINISH_MARGIN) earn('photo-finish');
      if (rounds.length > 0 && rounds.every(r => r.scoresAfterRound[team] > r.scoresAfterRound[other])) {
        earn('wire-to-wire');
      }
    }

    // ---- Round-level (the player's own seat) ----
    let streak = 0;
    for (const r of rounds) {
      roundAchievements(r, uid, earn);
      // Hat trick: made calls in consecutive rounds this player sat in. Each
      // run of three counts once, then the streak starts over.
      const mine = r.players.filter(pl => pl.uid === uid);
      const made = mine.some(pl => pl.tichuCall !== 'none' && pl.outOrder === 1);
      streak = made ? streak + 1 : 0;
      if (streak === 3) {
        earn('hat-trick');
        streak = 0;
      }
    }
  }

  return ACHIEVEMENTS.map(a => counts.get(a.id)!);
}
