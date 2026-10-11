import { Card, GameSummary, RoundLog, RoundPlay, Seat, getTeamForSeat } from './types.js';
import { identifyCombo, isBomb } from './combinations.js';
import { GameRecord, teamOf } from './stats.js';

// ===== Achievements =====
//
// Counting achievements: each is a moment that can happen any number of
// times, derived (like the rest of the stats page) from game history, so
// achievements apply retroactively wherever the history has the data. The
// same detector runs live at each round end to show what the table earned.

export type AchievementId =
  | 'grand-theft'
  | 'phoenix-rising'
  | 'lazarus'
  | 'out-bombed'
  | 'double-tap'
  | 'photo-finish'
  | 'wire-to-wire'
  | 'hat-trick'
  | 'friendly-fire'
  | 'ganis'
  | 'score-based-grand'
  | 'wish-bomb';

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
  { id: 'friendly-fire', name: 'Friendly Fire', description: 'Bomb your own Dragon', newLogsOnly: true },
  { id: 'ganis', name: 'Ganis!', description: 'Play a 14-card straight', newLogsOnly: true },
  {
    id: 'score-based-grand',
    name: 'Score-Based Grand',
    description: 'Call Grand Tichu without a Dragon, Phoenix or Ace in your first 8 cards',
    newLogsOnly: true,
  },
  {
    id: 'wish-bomb',
    name: 'Careful What You Wish For',
    description: 'Have your Mah Jong wish fulfilled by a bomb',
    newLogsOnly: true,
  },
];

export type AchievementCount = {
  id: AchievementId;
  count: number;
  /** The most recent game it was earned in. */
  lastGame: GameSummary | null;
};

/**
 * One achievement earned at the table. Round achievements belong to the seat
 * that earned them (`roundNumber` set); game achievements belong to both
 * seats of the winning team (`roundNumber` null).
 */
export type AchievementEvent = {
  id: AchievementId;
  seats: Seat[];
  roundNumber: number | null;
};

/** How the game ended; game-level achievements need it. */
export type GameOutcome = Pick<GameSummary, 'winningTeam' | 'finalScores'>;

const isSpecial = (c: Card, name: string) => c.type === 'special' && c.name === name;
const isBombPlay = (p: RoundPlay) => {
  const combo = identifyCombo(p.cards);
  return !!combo && isBomb(combo);
};

/** The play directly before `plays[i]` in the same trick (null for a lead). */
function previousInTrick(plays: readonly RoundPlay[], i: number): RoundPlay | null {
  return i > 0 && plays[i - 1].trick === plays[i].trick ? plays[i - 1] : null;
}

/** Achievements earned within a single round, as (id, seat) pairs. */
function roundEvents(r: RoundLog): Array<{ id: AchievementId; seat: Seat }> {
  const out: Array<{ id: AchievementId; seat: Seat }> = [];

  for (const pl of r.players) {
    if (pl.tichuCall !== 'grand') continue;
    if (pl.outOrder === 1 && r.players.some(o => o.team !== pl.team && o.tichuCall === 'grand')) {
      out.push({ id: 'grand-theft', seat: pl.seat });
    }
    const eight = pl.firstEight;
    if (eight && eight.length === 8 && !eight.some(c =>
      isSpecial(c, 'dragon') || isSpecial(c, 'phoenix') || (c.type === 'normal' && c.rank === 14))) {
      out.push({ id: 'score-based-grand', seat: pl.seat });
    }
  }

  for (const seat of [0, 1, 2, 3] as Seat[]) {
    if (r.bombs.filter(b => b.seat === seat).length >= 2) out.push({ id: 'double-tap', seat });
  }

  const plays = r.plays ?? [];
  plays.forEach((play, i) => {
    const prev = previousInTrick(plays, i);
    if (play.cards.length === 14 && identifyCombo(play.cards)?.type === 'straight') {
      out.push({ id: 'ganis', seat: play.seat });
    }
    if (!prev || !isBombPlay(play)) return;
    // Someone else's bomb right on top of a bomb: the bombed player earns it.
    if (prev.seat !== play.seat && isBombPlay(prev)) out.push({ id: 'out-bombed', seat: prev.seat });
    if (prev.seat === play.seat && prev.cards.length === 1 && isSpecial(prev.cards[0], 'dragon')) {
      out.push({ id: 'friendly-fire', seat: play.seat });
    }
  });

  // A wish is fulfilled by the first play after the Mah Jong that contains
  // the wished rank; the wisher earns this when that play is a bomb.
  for (const wish of r.mahJongWishes) {
    const mj = plays.findIndex(p => p.seat === wish.seat && p.cards.some(c => isSpecial(c, 'mahjong')));
    if (mj < 0) continue;
    const fulfilled = plays.slice(mj + 1).find(p => p.cards.some(c => c.type === 'normal' && c.rank === wish.rank));
    if (fulfilled && isBombPlay(fulfilled)) out.push({ id: 'wish-bomb', seat: wish.seat });
  }

  return out;
}

/**
 * Every achievement earned in a game's rounds, plus the game-level ones when
 * `outcome` is given (i.e. the game is over).
 */
export function achievementEvents(rounds: readonly RoundLog[], outcome?: GameOutcome): AchievementEvent[] {
  const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const events: AchievementEvent[] = [];

  // Hat trick: made calls by a seat in consecutive rounds. Each run of three
  // counts once, then the streak starts over.
  const streak = [0, 0, 0, 0];
  for (const r of sorted) {
    for (const e of roundEvents(r)) events.push({ id: e.id, seats: [e.seat], roundNumber: r.roundNumber });
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const pl = r.players.find(p => p.seat === seat);
      streak[seat] = pl && pl.tichuCall !== 'none' && pl.outOrder === 1 ? streak[seat] + 1 : 0;
      if (streak[seat] === 3) {
        events.push({ id: 'hat-trick', seats: [seat], roundNumber: r.roundNumber });
        streak[seat] = 0;
      }
    }
  }

  const team = outcome?.winningTeam;
  if (outcome && team != null) {
    const other = team === 0 ? 1 : 0;
    const seats: Seat[] = team === 0 ? [0, 2] : [1, 3];
    const game = (id: AchievementId) => events.push({ id, seats, roundNumber: null });
    const deficit = Math.max(0, ...sorted.map(r => r.scoresBeforeRound[other] - r.scoresBeforeRound[team]));
    if (deficit >= 500) game('phoenix-rising');
    if (deficit >= 1000) game('lazarus');
    if (outcome.finalScores[team] - outcome.finalScores[other] <= PHOTO_FINISH_MARGIN) game('photo-finish');
    if (sorted.length > 0 && sorted.every(r => r.scoresAfterRound[team] > r.scoresAfterRound[other])) {
      game('wire-to-wire');
    }
  }

  return events;
}

/** Achievement counts for `uid` across `records`, in `ACHIEVEMENTS` order. */
export function computeAchievements(records: readonly GameRecord[], uid: string): AchievementCount[] {
  const counts = new Map<AchievementId, AchievementCount>(
    ACHIEVEMENTS.map(a => [a.id, { id: a.id, count: 0, lastGame: null }]),
  );

  for (const { summary, rounds } of records) {
    const team = teamOf(summary, uid);
    if (team === null) continue;
    const roundsByNumber = new Map(rounds.map(r => [r.roundNumber, r]));

    for (const e of achievementEvents(rounds, summary)) {
      // Game achievements go to the winning team as listed in the summary;
      // round ones to whoever actually sat in the seat that round (a
      // substitute may have taken it over mid-game).
      const mine = e.roundNumber === null
        ? getTeamForSeat(e.seats[0]) === team
        : !!roundsByNumber.get(e.roundNumber)?.players.some(p => e.seats.includes(p.seat) && p.uid === uid);
      if (!mine) continue;
      const c = counts.get(e.id)!;
      c.count++;
      if (!c.lastGame || summary.finishedAt > c.lastGame.finishedAt) c.lastGame = summary;
    }
  }

  return ACHIEVEMENTS.map(a => counts.get(a.id)!);
}
