/**
 * Player-facing changelog: one entry per merged pull request, newest first.
 *
 * Shown in the "What's new" panel (front page and waiting room), where the
 * entries merged since the player's last finished game are highlighted.
 *
 * Adding an entry (do this in every PR that players could notice, and for
 * behind-the-scenes work too with `kind: 'internal'`):
 * - `pr`: the pull request number. Keep the list sorted newest first.
 * - `mergedAt`: the merge time as an ISO timestamp. When you don't know it yet
 *   (you're writing the PR), a plain `YYYY-MM-DD` date is fine: it counts as
 *   the end of that day (UTC), so the change still shows as new to anyone who
 *   played earlier that day.
 * - `summary`: one short line, written for players.
 * - New achievements and themes are a surprise: never name them. Put the count
 *   in `achievements` / `themes` instead and leave them out of the summary
 *   (the panel says "Added 2 achievements"). Polish to a recent theme or
 *   badge gets a generic line ("Polished one of the themes") for the same
 *   reason.
 */

export type ChangelogKind = 'new' | 'improved' | 'fixed' | 'internal';

export type ChangelogEntry = {
  pr: number;
  mergedAt: string;
  kind: ChangelogKind;
  /** One short line. Optional when the entry only adds achievements / themes. */
  summary?: string;
  /** Number of achievements this PR added (never named, to keep the surprise). */
  achievements?: number;
  /** Number of themes this PR added (or first offered in the picker). */
  themes?: number;
};

export const CHANGELOG: readonly ChangelogEntry[] = [
  { pr: 155, mergedAt: '2026-11-25', kind: 'improved', summary: 'Learning mode: a Grand Tichu caller is marked by their name and face-up hand while cards are passed' },
  { pr: 154, mergedAt: '2026-11-25', kind: 'fixed', summary: 'Computer players no longer freeze when random partners moves them to another seat' },
  { pr: 153, mergedAt: '2026-11-25', kind: 'new', summary: 'Computer players now take the name of a famous science-fiction AI' },
  { pr: 152, mergedAt: '2026-11-25', kind: 'new', summary: 'Short a player? The waiting room\'s Add bot button now seats a computer player, whenever one is online' },
  { pr: 151, mergedAt: '2026-11-25', kind: 'new', summary: "Learning mode: play with every hand face up, and after any hand the host can review it face up so the table steps through the plays together" },
  { pr: 150, mergedAt: '2026-11-25', kind: 'internal', summary: 'Deploys now update and restart the computer player too' },
  { pr: 149, mergedAt: '2026-11-25', kind: 'internal', summary: 'Computer players now hear when the game refuses a move' },
  { pr: 148, mergedAt: '2026-11-25', kind: 'internal', summary: 'Groundwork for computer players: the AI seat API now needs a bot token and tells bots the full play history of the round' },
  { pr: 147, mergedAt: '2026-11-22', kind: 'improved', summary: 'When your partner is out, the Dog runs past their seat to whoever leads next, and looks around confused if that turns out to be you' },
  { pr: 146, mergedAt: '2026-11-22', kind: 'new', achievements: 1 },
  { pr: 145, mergedAt: '2026-11-22', kind: 'improved', summary: 'When an opponent went out first, a Dragon trick goes to the other opponent without asking' },
  { pr: 144, mergedAt: '2026-11-21', kind: 'new', themes: 1, achievements: 1 },
  { pr: 143, mergedAt: '2026-11-25', kind: 'new', summary: 'The room creator can switch the play direction mid-game from the gear menu; the turn order stays the same' },
  { pr: 142, mergedAt: '2026-11-15', kind: 'improved', summary: 'Players who have gone out are marked on their seat, with a sound when it happens' },
  { pr: 141, mergedAt: '2026-11-15', kind: 'new', achievements: 1 },
  { pr: 140, mergedAt: '2026-11-14', kind: 'new', summary: 'This What’s new panel, highlighting changes since your last game' },
  { pr: 139, mergedAt: '2026-11-14T16:50:42Z', kind: 'new', achievements: 1 },
  { pr: 138, mergedAt: '2026-11-14T16:09:09Z', kind: 'fixed', summary: 'Play works again for Phoenix straights that extend either end' },
  { pr: 137, mergedAt: '2026-11-01T22:19:44Z', kind: 'improved', summary: 'Redesigned the card art for one of the themes' },
  { pr: 136, mergedAt: '2026-11-01T17:15:58Z', kind: 'improved', summary: 'Theme achievements are earned once per player' },
  { pr: 135, mergedAt: '2026-11-01T17:12:03Z', kind: 'new', themes: 1, achievements: 1, summary: 'The new theme is the default table; a seasonal theme left the picker' },
  { pr: 134, mergedAt: '2026-11-01T16:55:21Z', kind: 'improved', summary: 'Pass slots fill left opponent, right opponent, then partner' },
  { pr: 133, mergedAt: '2026-11-01T16:43:19Z', kind: 'improved', summary: 'New tricks-won icon: a deck lying on the table' },
  { pr: 132, mergedAt: '2026-11-01T16:31:09Z', kind: 'improved', summary: 'The Grand Tichu Decline button is as vivid as Call' },
  { pr: 131, mergedAt: '2026-11-01T15:57:27Z', kind: 'fixed', summary: 'Achievement tooltips no longer hide behind cards on the results screen' },
  { pr: 130, mergedAt: '2026-11-01T15:40:08Z', kind: 'improved', summary: 'Polished the colours of one of the themes' },
  { pr: 129, mergedAt: '2026-11-01T15:28:17Z', kind: 'new', summary: 'The round-end scoring screen shows the point cards each team took' },
  { pr: 128, mergedAt: '2026-11-01T15:27:36Z', kind: 'fixed', summary: 'Leftover Concede / Tichu confirm popups close between hands' },
  { pr: 127, mergedAt: '2026-10-31T20:23:32Z', kind: 'internal', summary: 'Round logs record every play, for bot research' },
  { pr: 126, mergedAt: '2026-10-31T03:26:05Z', kind: 'improved', summary: 'Toned down one theme’s table background' },
  { pr: 125, mergedAt: '2026-10-25T14:55:01Z', kind: 'new', achievements: 1 },
  { pr: 124, mergedAt: '2026-10-25T14:45:57Z', kind: 'new', themes: 1, summary: 'The new theme is the default table' },
  { pr: 123, mergedAt: '2026-10-25T14:36:18Z', kind: 'improved', summary: 'A Phoenix glows when it’s part of a multi-card play' },
  { pr: 122, mergedAt: '2026-10-25T04:23:36Z', kind: 'improved', summary: 'Redrew one of the achievement badges' },
  { pr: 121, mergedAt: '2026-10-25T03:10:23Z', kind: 'new', achievements: 4 },
  { pr: 120, mergedAt: '2026-10-25T01:11:56Z', kind: 'internal', summary: 'Read-only round export for bot research' },
  { pr: 119, mergedAt: '2026-10-24T16:54:44Z', kind: 'improved', summary: 'Received cards point an arrow toward whoever passed them' },
  { pr: 118, mergedAt: '2026-10-24T15:05:49Z', kind: 'fixed', summary: 'Passed-card tags no longer overlap the Your turn pill' },
  { pr: 117, mergedAt: '2026-10-24T14:54:29Z', kind: 'fixed', summary: 'Tightened validation of Phoenix pairs and triples' },
  { pr: 116, mergedAt: '2026-10-24T14:52:44Z', kind: 'internal', summary: 'Polish for an upcoming theme' },
  { pr: 115, mergedAt: '2026-10-24T14:48:27Z', kind: 'internal', summary: 'Upgraded the build tools' },
  { pr: 114, mergedAt: '2026-10-24T14:46:21Z', kind: 'improved', summary: 'Redesigned the create-game screen and waiting room for desktop' },
  { pr: 113, mergedAt: '2026-10-24T14:21:56Z', kind: 'internal', summary: 'Patched vulnerable dependencies' },
  { pr: 112, mergedAt: '2026-10-24T14:12:03Z', kind: 'improved', summary: 'The theme picker shows a Dragon card in each theme’s art' },
  { pr: 111, mergedAt: '2026-10-19T15:49:35Z', kind: 'improved', summary: 'New Dog and Dragon animations for one of the themes' },
  { pr: 110, mergedAt: '2026-10-19T15:37:34Z', kind: 'new', themes: 1 },
  { pr: 109, mergedAt: '2026-10-18T17:55:26Z', kind: 'new', achievements: 2 },
  { pr: 108, mergedAt: '2026-10-18T14:32:42Z', kind: 'new', summary: 'Choose which end of a straight the Phoenix takes' },
  { pr: 107, mergedAt: '2026-10-17T15:10:06Z', kind: 'new', achievements: 3, summary: 'Cards you were passed say who passed them; fixed stats for late sign-ins' },
  { pr: 106, mergedAt: '2026-10-12T22:28:49Z', kind: 'internal', summary: 'Groundwork for a seasonal theme' },
  { pr: 105, mergedAt: '2026-10-12T21:11:36Z', kind: 'new', summary: 'Leave game and End game for everyone, in the in-game menu' },
  { pr: 104, mergedAt: '2026-10-12T20:56:44Z', kind: 'new', themes: 1, summary: 'The room creator picks the table’s theme' },
  { pr: 103, mergedAt: '2026-10-12T20:35:21Z', kind: 'improved', summary: 'Games in progress survive server restarts more safely' },
  { pr: 102, mergedAt: '2026-10-12T19:13:49Z', kind: 'improved', summary: 'Wider pip columns on the card faces' },
  { pr: 101, mergedAt: '2026-10-12T19:05:05Z', kind: 'improved', summary: 'New rank font and tonal outlines on the suit pips' },
  { pr: 100, mergedAt: '2026-10-12T18:57:02Z', kind: 'improved', summary: 'Playtest fixes: passing layout, pip legibility, smoother play animation' },
  { pr: 99, mergedAt: '2026-10-12T17:25:08Z', kind: 'new', summary: 'Papercraft cards and table redesign; fixed concede timing' },
  { pr: 98, mergedAt: '2026-10-11T18:16:10Z', kind: 'new', achievements: 13, summary: 'Achievements are here, each with its own badge' },
  { pr: 97, mergedAt: '2026-10-10T15:54:28Z', kind: 'improved', summary: 'Opponents accept a concession; clearer in-game announcements' },
  { pr: 96, mergedAt: '2026-09-07T03:38:26Z', kind: 'internal', summary: 'Removed broken legacy stat counters' },
  { pr: 95, mergedAt: '2026-09-07T03:35:35Z', kind: 'fixed', summary: 'Closed rules loopholes around the trick countdown, Dragon giveaway and concede' },
  { pr: 94, mergedAt: '2026-09-06T16:52:38Z', kind: 'improved', summary: 'Player and partner stats come from your full game history' },
  { pr: 93, mergedAt: '2026-08-30T19:52:43Z', kind: 'internal', summary: 'Startup diagnostics and a deploy script' },
  { pr: 92, mergedAt: '2026-08-30T18:22:58Z', kind: 'internal', summary: 'Server settings load reliably after a deploy' },
  { pr: 91, mergedAt: '2026-08-30T14:42:38Z', kind: 'internal', summary: 'Deployment runbook' },
  { pr: 90, mergedAt: '2026-07-26T20:17:08Z', kind: 'internal', summary: 'Moved to Node 22' },
  { pr: 89, mergedAt: '2026-07-26T20:14:35Z', kind: 'internal', summary: 'Activity counts on the health check' },
  { pr: 88, mergedAt: '2026-07-26T20:00:33Z', kind: 'improved', summary: 'Lobby redesign, bigger pass cards, richer game-over screen' },
  { pr: 87, mergedAt: '2026-07-19T18:13:46Z', kind: 'improved', summary: 'Smoother play: steady action bar, combo preview, trick sweep' },
  { pr: 86, mergedAt: '2026-07-19T18:08:38Z', kind: 'improved', summary: 'Back to Lobby after a game, invites shown in the waiting room, and more' },
  { pr: 85, mergedAt: '2026-07-19T17:16:31Z', kind: 'fixed', summary: 'The game scales to fit short screens' },
  { pr: 84, mergedAt: '2026-07-19T15:39:37Z', kind: 'fixed', summary: 'The right opponent’s big plays no longer clip off screen' },
  { pr: 83, mergedAt: '2026-07-19T14:29:05Z', kind: 'fixed', summary: 'Received cards no longer overlap your hand' },
  { pr: 82, mergedAt: '2026-06-28T15:43:29Z', kind: 'fixed', summary: 'Game-end stats survive a last-second disconnect' },
  { pr: 81, mergedAt: '2026-06-28T15:29:53Z', kind: 'improved', summary: 'The trick countdown is shorter when no bomb is possible' },
  { pr: 80, mergedAt: '2026-06-07T21:11:02Z', kind: 'new', summary: 'Drag passed cards back to your hand; Grand Tichu asks to confirm' },
];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** An entry's merge time in ms. A date-only `mergedAt` counts as the end of that UTC day. */
export function changelogTime(entry: ChangelogEntry): number {
  if (DATE_ONLY.test(entry.mergedAt)) return Date.parse(`${entry.mergedAt}T23:59:59.999Z`);
  return Date.parse(entry.mergedAt);
}

/**
 * Split entries into those merged after `lastPlayedAt` (ms) and the rest.
 * With no last game (null), nothing counts as "since".
 */
export function splitChangelog(
  entries: readonly ChangelogEntry[],
  lastPlayedAt: number | null,
): { since: ChangelogEntry[]; earlier: ChangelogEntry[] } {
  const since: ChangelogEntry[] = [];
  const earlier: ChangelogEntry[] = [];
  for (const e of entries) {
    (lastPlayedAt != null && changelogTime(e) > lastPlayedAt ? since : earlier).push(e);
  }
  return { since, earlier };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Added 2 achievements", "Added 1 theme and 1 achievement", or null. */
export function addedLine(themes: number, achievements: number): string | null {
  const parts = [
    themes > 0 ? plural(themes, 'theme') : null,
    achievements > 0 ? plural(achievements, 'achievement') : null,
  ].filter(Boolean);
  return parts.length ? `Added ${parts.join(' and ')}` : null;
}

/** The single line shown for one entry. */
export function changelogLine(entry: ChangelogEntry): string {
  const added = addedLine(entry.themes ?? 0, entry.achievements ?? 0);
  return [added, entry.summary].filter(Boolean).join('. ');
}

/**
 * Totals for a set of entries: achievements and themes collapse into counts;
 * entries with their own summary stay listed (shown by summary alone).
 */
export function summarizeChangelog(entries: readonly ChangelogEntry[]): {
  achievements: number;
  themes: number;
  listed: ChangelogEntry[];
} {
  let achievements = 0;
  let themes = 0;
  for (const e of entries) {
    achievements += e.achievements ?? 0;
    themes += e.themes ?? 0;
  }
  return { achievements, themes, listed: entries.filter(e => e.summary) };
}
