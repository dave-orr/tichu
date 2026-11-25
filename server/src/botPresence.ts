/**
 * Whether a bot (`tichu live`, dave-orr/Tichu-ai) is ready to fill AI seats.
 *
 * While it has room for more seats the bot polls `POST /api/join` every few
 * seconds, so a recent poll means a seat marked for AI now will be filled.
 * The waiting room offers "Add bot" only then, so nobody marks a seat that no
 * bot will take. (A bot already playing its maximum number of seats stops
 * polling, and correctly counts as unavailable.)
 */

/** How long after its last poll a bot still counts as available. */
export const BOT_PRESENCE_TTL_MS = 15_000;

let lastPollAt = 0;

export function noteBotPoll(now = Date.now()): void {
  lastPollAt = now;
}

export function isBotAvailable(now = Date.now()): boolean {
  return lastPollAt > 0 && now - lastPollAt < BOT_PRESENCE_TTL_MS;
}

