import type { Card, Combo, NormalRank, RoundAction, RoundLog, Seat, TichuCall, TrickPlay } from './types.js';
import { RANK_NAMES, cardId, cardsEqual, getLeftSeat, getPartnerSeat, getRightSeat } from './types.js';
import { identifyCombo } from './combinations.js';
import { sortHand } from './deck.js';

/**
 * Everything needed to step through one finished hand face up ("review in
 * learning mode"). Built on the server from the round's log when the round
 * ends; the client turns it into frames with `buildReplayFrames`, so moving
 * through the hand only ever sends a step number.
 */
export type HandReplay = {
  roundNumber: number;
  /** Seat names, index = seat. */
  names: string[];
  /** The 14 cards each seat was dealt, before passing. */
  dealt: Card[][];
  /** What each seat passed (null if the log has no pass for it). */
  passes: ({ left: Card; partner: Card; right: Card } | null)[];
  /** Grand Tichu calls, index = seat. */
  grand: boolean[];
  /** Every accepted action of the play phase, in order (RoundLog.actions). */
  actions: RoundAction[];
  /** Final out order (last = the seat left holding cards). */
  outOrder: Seat[];
};

/** A card moving in the pass: who gave it to whom. */
export type ReplayPass = { card: Card; from: Seat; to: Seat };

/** The table at one moment of a hand. */
export type ReplayFrame = {
  kind: 'deal' | 'passed' | RoundAction['type'] | 'end';
  /** Who acted (null for the deal, the pass and the end). */
  seat: Seat | null;
  /** One line saying what happened, e.g. "Ann plays Pair, 7s". */
  text: string;
  /** Every seat's hand at this moment, sorted. */
  hands: Card[][];
  /** The plays on the table in the trick in progress, in order. */
  trick: TrickPlay[];
  /** Seat on top of the trick, or null if the table is empty. */
  topSeat: Seat | null;
  /** Seats whose latest action this trick was a pass. */
  passedSeats: Seat[];
  calls: TichuCall[];
  wish: NormalRank | null;
  /** Finishing place per seat (0 = still in). */
  out: number[];
  /** The deal and pass frames mark the cards that change hands. */
  passing: ReplayPass[];
};

/** Turn a finished round's log into the data a review needs. */
export function handReplayFromLog(log: RoundLog): HandReplay {
  const bySeat = [0, 1, 2, 3].map(s => log.players.find(p => p.seat === s));
  return {
    roundNumber: log.roundNumber,
    names: bySeat.map((p, s) => p?.name ?? `Seat ${s + 1}`),
    dealt: bySeat.map(p => [...(p?.initialHand ?? [])]),
    passes: bySeat.map(p => p?.passedLeft && p.passedPartner && p.passedRight
      ? { left: p.passedLeft, partner: p.passedPartner, right: p.passedRight }
      : null),
    grand: bySeat.map(p => p?.tichuCall === 'grand'),
    actions: [...(log.actions ?? [])],
    outOrder: [...log.outOrder],
  };
}

/** A short, player-facing name for a combination ("Pair, 7s"). */
export function comboLabel(combo: Combo): string {
  const r = combo.rank in RANK_NAMES
    ? RANK_NAMES[combo.rank as NormalRank]
    : combo.rank === 1
      ? '1'
      : combo.rank === 15
        ? 'Dragon'
        : String(combo.rank);
  switch (combo.type) {
    case 'single':
      if (combo.rank === 0) return 'Dog';
      // A lone Phoenix ranks half above whatever it beat (e.g. 14.5).
      if (combo.cards[0]?.type === 'special' && combo.cards[0].name === 'phoenix') return 'Single, Phoenix';
      return `Single, ${r}`;
    case 'pair': return `Pair, ${r}s`;
    case 'triple': return `Triple, ${r}s`;
    case 'fullHouse': return `Full House, ${r}s`;
    case 'straight': return `${combo.length}-Straight, high ${r}`;
    case 'consecutivePairs': return `${combo.length / 2} Pairs, high ${r}`;
    case 'fourOfAKindBomb': return `4-Bomb, ${r}s`;
    case 'straightFlushBomb': return `${combo.length}-SF Bomb, high ${r}`;
  }
}

function describeCards(cards: Card[], phoenixAs?: NormalRank): string {
  const combo = identifyCombo(cards, phoenixAs);
  if (combo) return comboLabel(combo);
  return cards.map(cardId).join(' ');
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];

function removeCards(hand: Card[], cards: Card[]): Card[] {
  return hand.filter(c => !cards.some(p => cardsEqual(p, c)));
}

/**
 * Every moment of the hand in order: the deal (with the cards about to be
 * passed marked), the hands after passing, one frame per action, and the end.
 * Pure: the same replay always gives the same frames.
 */
export function buildReplayFrames(replay: HandReplay): ReplayFrame[] {
  const name = (s: Seat) => replay.names[s] ?? `Seat ${s + 1}`;
  const frames: ReplayFrame[] = [];

  const passing: ReplayPass[] = [];
  for (const s of [0, 1, 2, 3] as Seat[]) {
    const p = replay.passes[s];
    if (!p) continue;
    passing.push(
      { card: p.left, from: s, to: getLeftSeat(s) },
      { card: p.partner, from: s, to: getPartnerSeat(s) },
      { card: p.right, from: s, to: getRightSeat(s) },
    );
  }

  let hands = replay.dealt.map(h => sortHand([...h]));
  const calls: TichuCall[] = replay.grand.map(g => (g ? 'grand' : 'none'));
  let trick: TrickPlay[] = [];
  let trickNumber = -1;
  let topSeat: Seat | null = null;
  let passedSeats: Seat[] = [];
  let wish: NormalRank | null = null;
  const out = [0, 0, 0, 0];
  let outCount = 0;

  const push = (kind: ReplayFrame['kind'], seat: Seat | null, text: string, framePassing: ReplayPass[] = []) => {
    frames.push({
      kind, seat, text,
      hands: hands.map(h => [...h]),
      trick: trick.map(t => ({ seat: t.seat, cards: [...t.cards] })),
      topSeat,
      passedSeats: [...passedSeats],
      calls: [...calls],
      wish,
      out: [...out],
      passing: framePassing,
    });
  };

  const grandCallers = ([0, 1, 2, 3] as Seat[]).filter(s => replay.grand[s]);
  push('deal', null, grandCallers.length
    ? `The deal. Grand Tichu: ${grandCallers.map(name).join(', ')}`
    : 'The deal', passing);

  if (passing.length > 0) {
    hands = hands.map((h, s) => {
      const gone = passing.filter(p => p.from === s).map(p => p.card);
      const got = passing.filter(p => p.to === s).map(p => p.card);
      return sortHand([...removeCards(h, gone), ...got]);
    });
    push('passed', null, 'After passing', passing);
  }

  for (const a of replay.actions) {
    switch (a.type) {
      case 'play':
      case 'bomb': {
        if (a.trick !== trickNumber) {
          trickNumber = a.trick;
          trick = [];
          passedSeats = [];
        }
        trick.push({ seat: a.seat, cards: [...a.cards] });
        topSeat = a.seat;
        passedSeats = passedSeats.filter(s => s !== a.seat);
        hands[a.seat] = removeCards(hands[a.seat], a.cards);
        if (wish != null && a.cards.some(c => c.type === 'normal' && c.rank === wish)) wish = null;
        let text = a.type === 'bomb'
          ? `${name(a.seat)} bombs: ${describeCards(a.cards)}`
          : `${name(a.seat)} ${trick.length === 1 ? 'leads' : 'plays'} ${describeCards(a.cards, a.type === 'play' ? a.phoenixAs : undefined)}`;
        if (hands[a.seat].length === 0 && out[a.seat] === 0) {
          out[a.seat] = ++outCount;
          text += ` and goes out ${ORDINAL[outCount]}`;
        }
        push(a.type, a.seat, text);
        break;
      }
      case 'pass':
        if (!passedSeats.includes(a.seat)) passedSeats.push(a.seat);
        push('pass', a.seat, a.auto ? `${name(a.seat)} can't play (skipped)` : `${name(a.seat)} passes`);
        break;
      case 'smallTichu':
        calls[a.seat] = 'small';
        push('smallTichu', a.seat, `${name(a.seat)} calls Tichu`);
        break;
      case 'wish':
        wish = a.rank;
        push('wish', a.seat, a.rank != null ? `${name(a.seat)} wishes for ${RANK_NAMES[a.rank]}` : `${name(a.seat)} makes no wish`);
        break;
      case 'dragon':
        push('dragon', a.seat, `${name(a.seat)} gives the Dragon trick to ${name(a.to)}`);
        break;
      case 'concede':
        push('concede', a.seat, `${name(a.seat)} concedes`);
        break;
    }
  }

  const places = ([0, 1, 2, 3] as Seat[]).filter(s => out[s] !== 0).sort((a, b) => out[a] - out[b]);
  push('end', null, places.length
    ? `Hand over: ${places.map(s => `${name(s)} ${ORDINAL[out[s]]}`).join(', ')}`
    : 'Hand over');
  return frames;
}
