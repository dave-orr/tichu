import { Card, GameSummary, RoundLog, RoundPlay, Seat, Theme, getTeamForSeat } from './types.js';
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
  | 'fly-the-coop'
  | 'score-based-grand'
  | 'wish-bomb'
  | 'super-partner'
  | 'gift-horse'
  | 'hot-streak'
  | 'unstoppable'
  | 'last-word'
  | 'with-a-flourish'
  | 'crafty'
  | 'totally-kawaii'
  | 'old-master'
  | 'trick-or-treat'
  | 'spellbound';

export type AchievementDef = {
  id: AchievementId;
  name: string;
  description: string;
  /**
   * Needs data that round logs only started recording later (every play, or
   * the first 8 cards), so it only counts games played since.
   */
  newLogsOnly?: boolean;
  /** Earned at most once per player: later qualifying games don't add to it. */
  once?: boolean;
};

/** Win streak lengths that earn Hot Streak and Unstoppable. */
export const HOT_STREAK = 5;
export const UNSTOPPABLE_STREAK = 10;

/** With a Flourish: winning margin at least this. */
export const FLOURISH_MARGIN = 400;

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
    id: 'fly-the-coop',
    name: 'Fly the Coop',
    description: 'Go out on a play that includes the Mah Jong',
    newLogsOnly: true,
  },
  {
    id: 'score-based-grand',
    name: 'Score-Based Grand',
    description: 'Call Grand Tichu without a Dragon, Phoenix or Ace',
    newLogsOnly: true,
  },
  {
    id: 'wish-bomb',
    name: 'Careful What You Wish For',
    description: 'Have your wish fulfilled by a bomb',
    newLogsOnly: true,
  },
  {
    id: 'super-partner',
    name: 'Super Partner',
    description: 'Bomb, then Dog',
    newLogsOnly: true,
  },
  {
    id: 'gift-horse',
    name: 'Gift Horse',
    description: 'Pass the Dragon or Phoenix to an opponent, then make your Tichu or Grand',
  },
  { id: 'hot-streak', name: 'Hot Streak', description: `Win ${HOT_STREAK} games in a row` },
  { id: 'unstoppable', name: 'Unstoppable', description: `Win ${UNSTOPPABLE_STREAK} games in a row` },
  {
    id: 'last-word',
    name: 'The Last Word',
    description: 'Trailing going into the final hand, make your Tichu or Grand and win the match on it',
  },
  {
    id: 'with-a-flourish',
    name: 'With a Flourish',
    description: `Make a Grand on the match-winning hand and finish ${FLOURISH_MARGIN}+ points ahead`,
  },
  // Theme achievements: the whole table earns one for finishing a game, once
  // per player per theme. Only games since summaries started recording the
  // theme count.
  { id: 'crafty', name: 'Crafty', description: 'Finish a game on the Papercraft table', newLogsOnly: true, once: true },
  { id: 'totally-kawaii', name: 'Totally Kawaii', description: 'Finish a game on the Kawaii table', newLogsOnly: true, once: true },
  { id: 'old-master', name: 'Old Master', description: 'Finish a game on the Classic Baroque table', newLogsOnly: true, once: true },
  { id: 'trick-or-treat', name: 'Trick or Treat', description: 'Finish a game on the Halloween table', newLogsOnly: true, once: true },
  { id: 'spellbound', name: 'Spellbound', description: 'Finish a game on the Magic table', newLogsOnly: true, once: true },
];

/** The achievement every seat earns for finishing a game in each theme. */
export const THEME_ACHIEVEMENTS: Record<Theme, AchievementId> = {
  papercraft: 'crafty',
  kawaii: 'totally-kawaii',
  baroque: 'old-master',
  halloween: 'trick-or-treat',
  magic: 'spellbound',
};

export type AchievementCount = {
  id: AchievementId;
  count: number;
  /** The most recent game it was earned in. */
  lastGame: GameSummary | null;
};

/**
 * One achievement earned at the table. Round achievements belong to the seat
 * that earned them (`roundNumber` set); game achievements belong to the seats
 * listed (`roundNumber` null): the winning team's two, or all four for a
 * theme achievement.
 */
export type AchievementEvent = {
  id: AchievementId;
  seats: Seat[];
  roundNumber: number | null;
};

/** How the game ended; game-level achievements need it. */
export type GameOutcome = Pick<GameSummary, 'winningTeam' | 'finalScores' | 'theme'>;

/** Cards in a hand once the pass is done. */
const HAND_SIZE = 14;

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

  // Gave an opponent the Dragon or Phoenix in the pass, and made the call anyway.
  const bigCard = (c: Card | null) => !!c && (isSpecial(c, 'dragon') || isSpecial(c, 'phoenix'));
  for (const pl of r.players) {
    if (pl.tichuCall !== 'none' && pl.outOrder === 1 && (bigCard(pl.passedLeft) || bigCard(pl.passedRight))) {
      out.push({ id: 'gift-horse', seat: pl.seat });
    }
  }

  const plays = r.plays ?? [];
  // Counting cards rather than trusting outOrder: a concession marks seats
  // out without their playing a card.
  const played = [0, 0, 0, 0];
  plays.forEach((play, i) => {
    played[play.seat] += play.cards.length;
    if (played[play.seat] === HAND_SIZE && play.cards.some(c => isSpecial(c, 'mahjong'))) {
      out.push({ id: 'fly-the-coop', seat: play.seat });
    }
    const prev = previousInTrick(plays, i);
    // Your bomb, then your Dog leading the very next trick.
    const before = i > 0 ? plays[i - 1] : null;
    if (before && before.seat === play.seat && before.trick !== play.trick && isBombPlay(before)
      && play.cards.length === 1 && isSpecial(play.cards[0], 'dog')) {
      out.push({ id: 'super-partner', seat: play.seat });
    }
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

    // The match-winning hand: the winners' made calls on it. These belong to
    // the caller (and that round), not the whole team.
    const last = sorted.at(-1);
    if (last) {
      const margin = outcome.finalScores[team] - outcome.finalScores[other];
      for (const pl of last.players) {
        if (pl.team !== team || pl.tichuCall === 'none' || pl.outOrder !== 1) continue;
        const mine = (id: AchievementId) => events.push({ id, seats: [pl.seat], roundNumber: last.roundNumber });
        if (last.scoresBeforeRound[team] < last.scoresBeforeRound[other]) mine('last-word');
        if (pl.tichuCall === 'grand' && margin >= FLOURISH_MARGIN) mine('with-a-flourish');
      }
    }
  }

  // Finishing a game at all, win, lose or tie, earns the table's theme badge.
  if (outcome?.theme) events.push({ id: THEME_ACHIEVEMENTS[outcome.theme], seats: [0, 1, 2, 3], roundNumber: null });

  return events;
}

/**
 * Win streak length after each of `uid`'s games, oldest first. A loss or a
 * tie ends a streak.
 */
function streakRun(summaries: readonly GameSummary[], uid: string): Array<{ summary: GameSummary; streak: number }> {
  let streak = 0;
  return [...summaries]
    .filter(s => teamOf(s, uid) !== null)
    .sort((a, b) => a.finishedAt - b.finishedAt)
    .map(summary => {
      streak = summary.winningTeam !== null && summary.winningTeam === teamOf(summary, uid) ? streak + 1 : 0;
      return { summary, streak };
    });
}

/** The win-streak achievement a game earned `uid`, if that game took their streak to a milestone. */
export function streakMilestone(streak: number): AchievementId | null {
  return streak === HOT_STREAK ? 'hot-streak' : streak === UNSTOPPABLE_STREAK ? 'unstoppable' : null;
}

/** `uid`'s current win streak, counting back from their latest game. */
export function currentWinStreak(summaries: readonly GameSummary[], uid: string): number {
  return streakRun(summaries, uid).at(-1)?.streak ?? 0;
}

const ONCE: ReadonlySet<AchievementId> = new Set(ACHIEVEMENTS.filter(a => a.once).map(a => a.id));

/** True for achievements a player earns at most once (see AchievementDef.once). */
export const isOnceAchievement = (id: AchievementId) => ONCE.has(id);

/** True for the per-theme "finish a game on this table" badges. */
export const isThemeAchievement = (id: AchievementId) => (Object.values(THEME_ACHIEVEMENTS) as AchievementId[]).includes(id);

/**
 * Whether the game `gameId` was `uid`'s first finished game on `theme`, so it
 * earns them that theme's (once-only) badge. `summaries` must include it.
 */
export function isFirstGameOnTheme(summaries: readonly GameSummary[], uid: string, theme: Theme, gameId: string): boolean {
  const first = summaries
    .filter(s => s.theme === theme && teamOf(s, uid) !== null)
    .reduce<GameSummary | null>((a, s) => (!a || s.finishedAt < a.finishedAt ? s : a), null);
  return first?.gameId === gameId;
}

/**
 * Achievement counts for `uid` across `records`, in `ACHIEVEMENTS` order.
 * A once-only achievement counts at most 1, and its game is the first one
 * that earned it.
 */
export function computeAchievements(records: readonly GameRecord[], uid: string): AchievementCount[] {
  const counts = new Map<AchievementId, AchievementCount>(
    ACHIEVEMENTS.map(a => [a.id, { id: a.id, count: 0, lastGame: null }]),
  );

  for (const { summary, rounds } of records) {
    const team = teamOf(summary, uid);
    if (team === null) continue;
    const roundsByNumber = new Map(rounds.map(r => [r.roundNumber, r]));

    for (const e of achievementEvents(rounds, summary)) {
      // Game achievements go to their seats' team as listed in the summary;
      // round ones to whoever actually sat in the seat that round (a
      // substitute may have taken it over mid-game).
      const mine = e.roundNumber === null
        ? e.seats.some(s => getTeamForSeat(s) === team)
        : !!roundsByNumber.get(e.roundNumber)?.players.some(p => e.seats.includes(p.seat) && p.uid === uid);
      if (!mine) continue;
      const c = counts.get(e.id)!;
      if (ONCE.has(e.id)) {
        c.count = 1;
        if (!c.lastGame || summary.finishedAt < c.lastGame.finishedAt) c.lastGame = summary;
        continue;
      }
      c.count++;
      if (!c.lastGame || summary.finishedAt > c.lastGame.finishedAt) c.lastGame = summary;
    }
  }

  // Win streaks span games: each streak counts once when it reaches 5, and
  // once more if it goes on to 10.
  for (const { summary, streak } of streakRun(records.map(r => r.summary), uid)) {
    const id = streakMilestone(streak);
    if (!id) continue;
    const c = counts.get(id)!;
    c.count++;
    if (!c.lastGame || summary.finishedAt > c.lastGame.finishedAt) c.lastGame = summary;
  }

  return ACHIEVEMENTS.map(a => counts.get(a.id)!);
}
