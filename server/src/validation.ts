import type { Card, Seat, NormalRank, GameSettings } from '@tichu/shared';
import { cardId } from '@tichu/shared';

const VALID_SUITS = new Set(['jade', 'sword', 'pagoda', 'star']);
const VALID_SPECIAL_NAMES = new Set(['mahjong', 'dog', 'phoenix', 'dragon']);
const VALID_RANKS = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const VALID_SEATS = new Set([0, 1, 2, 3]);

// Max player name: 20 chars, alphanumeric plus basic punctuation/spaces
const PLAYER_NAME_MAX_LENGTH = 20;
const PLAYER_NAME_PATTERN = /^[\w\s\-'.!?]+$/u;

export function isValidCard(card: unknown): card is Card {
  if (card == null || typeof card !== 'object') return false;
  const c = card as Record<string, unknown>;
  if (c.type === 'normal') {
    return VALID_SUITS.has(c.suit as string) && VALID_RANKS.has(c.rank as number);
  }
  if (c.type === 'special') {
    return VALID_SPECIAL_NAMES.has(c.name as string);
  }
  return false;
}

export function isValidCardArray(cards: unknown): cards is Card[] {
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > 14) return false;
  if (!cards.every(isValidCard)) return false;
  // A play may not name the same card twice (the engine re-checks this too).
  return new Set(cards.map(cardId)).size === cards.length;
}

export function isValidSeat(seat: unknown): seat is Seat {
  return typeof seat === 'number' && VALID_SEATS.has(seat);
}

export function isValidNormalRank(rank: unknown): rank is NormalRank {
  return typeof rank === 'number' && VALID_RANKS.has(rank);
}

export function isValidPlayerName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length >= 1 &&
    name.length <= PLAYER_NAME_MAX_LENGTH &&
    PLAYER_NAME_PATTERN.test(name)
  );
}

export function isValidPassCards(pass: unknown): pass is { left: Card; partner: Card; right: Card } {
  if (pass == null || typeof pass !== 'object') return false;
  const p = pass as Record<string, unknown>;
  return isValidCard(p.left) && isValidCard(p.partner) && isValidCard(p.right);
}

const TARGET_SCORE_MIN = 100;
const TARGET_SCORE_MAX = 9999;
const BOOLEAN_SETTINGS = ['countPoints', 'cardsSeen', 'showPassedCards', 'clockwise'] as const;

/**
 * Reduce an untrusted settings object to the known keys with well-typed
 * values. Unknown keys are dropped, booleans must be real booleans, and the
 * target score must be a finite number (clamped to the allowed range) —
 * `Math.round("abc")` is NaN, which would otherwise make a game never end,
 * while 0 or a negative score ends it after the first round.
 */
export function sanitizeSettings(input: unknown): Partial<GameSettings> {
  const out: Partial<GameSettings> = {};
  if (input == null || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;
  for (const key of BOOLEAN_SETTINGS) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key] as boolean;
  }
  if (typeof raw.targetScore === 'number' && Number.isFinite(raw.targetScore)) {
    out.targetScore = Math.max(TARGET_SCORE_MIN, Math.min(TARGET_SCORE_MAX, Math.round(raw.targetScore)));
  }
  return out;
}
