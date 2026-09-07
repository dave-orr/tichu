import { describe, it, expect } from 'vitest';
import { applyPasses, callSmallTichu, canPlayWishedRankFromHand, concede, giveDragonTrick, passCards, passTurn, playBomb, playCards, setMahJongWish, undoPassCards } from './engine.js';
import {
  Card, Combo, DEFAULT_SETTINGS, GameState, NormalCard, Player, Seat,
} from './types.js';

function c(rank: number, suit: 'jade' | 'sword' | 'pagoda' | 'star' = 'jade'): NormalCard {
  return { type: 'normal', suit, rank: rank as any };
}

function makePlayer(seat: Seat, overrides: Partial<Player> = {}): Player {
  return {
    id: `p${seat}`,
    name: `Player ${seat}`,
    photoURL: null,
    seat,
    hand: [],
    tricksWon: [],
    tichuCall: 'none',
    hasPlayedFirstCard: true,
    isOut: false,
    outOrder: 0,
    grandTichuDecided: true,
    passedCards: true,
    isAi: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    players: [makePlayer(0), makePlayer(1), makePlayer(2), makePlayer(3)],
    teams: [
      { players: [0, 2], score: 0 },
      { players: [1, 3], score: 0 },
    ],
    currentTrick: null,
    currentTrickPlays: [],
    passCount: 0,
    passedSeats: [],
    turnIndex: 0,
    lastPlayedBy: null,
    mahJongWish: null,
    mahJongWishPending: false,
    outCount: 0,
    roundNumber: 1,
    deck: [],
    bombWindow: false,
    trickCountdown: null,
    dragonGiveaway: false,
    dragonGiveawayBy: null,
    settings: DEFAULT_SETTINGS,
    playedCards: [],
    roundEndReady: [],
    roundHistory: [],
    receivedCards: [[], [], [], []],
    ...overrides,
  };
}

const trickSeven: Combo = { type: 'single', cards: [c(7)], rank: 7, length: 1 };

describe('applyPasses — received card ordering', () => {
  it('puts a same-rank card from the left player to the left of the one from the right player', () => {
    // Recipient is seat 0: left neighbour = seat 3, partner = seat 2,
    // right neighbour = seat 1. Both opponents pass seat 0 a "2".
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(3), c(4), c(6)] }),               // seat 0's own passes
      makePlayer(1, { hand: [c(2, 'sword'), c(7), c(8)] }),      // right neighbour: passes 2♦ left → seat 0
      makePlayer(2, { hand: [c(9), c(5, 'star'), c(10)] }),      // partner: passes 5 → seat 0
      makePlayer(3, { hand: [c(11), c(12), c(2, 'jade')] }),     // left neighbour: passes 2♣ right → seat 0
    ];
    const passes = {
      0: { left: c(3), partner: c(4), right: c(6) },
      1: { left: c(2, 'sword'), partner: c(7), right: c(8) },
      2: { left: c(9), partner: c(5, 'star'), right: c(10) },
      3: { left: c(11), partner: c(12), right: c(2, 'jade') },
    } as const;

    const after = applyPasses(makeState({ players }), passes);
    const hand = after.players[0].hand;

    // The two 2s lead the hand; the left player's (jade) precedes the right's (sword).
    expect(hand[0]).toEqual(c(2, 'jade'));
    expect(hand[1]).toEqual(c(2, 'sword'));
  });
});

describe('undoPassCards', () => {
  const pass = { left: c(3), partner: c(4), right: c(6) };

  it('clears passedCards for a seat that has passed during the passing phase', () => {
    const state = makeState({
      phase: 'passing',
      players: [
        makePlayer(0, { hand: [c(3), c(4), c(6)], passedCards: false }),
        makePlayer(1, { passedCards: false }),
        makePlayer(2, { passedCards: false }),
        makePlayer(3, { passedCards: false }),
      ],
    });
    const passed = passCards(state, 0, pass);
    expect(passed.players[0].passedCards).toBe(true);

    const undone = undoPassCards(passed, 0);
    expect(undone.players[0].passedCards).toBe(false);
    // Hand is untouched: passes are only applied once everyone has passed.
    expect(undone.players[0].hand).toEqual([c(3), c(4), c(6)]);
    // Other seats are unaffected.
    expect(undone.players[1].passedCards).toBe(false);
  });

  it('is a no-op for a seat that has not passed', () => {
    const state = makeState({
      phase: 'passing',
      players: [
        makePlayer(0, { passedCards: false }),
        makePlayer(1), makePlayer(2), makePlayer(3),
      ],
    });
    expect(undoPassCards(state, 0)).toBe(state);
  });

  it('is a no-op once the passing phase is over', () => {
    const state = makeState({ phase: 'playing' });
    expect(undoPassCards(state, 0)).toBe(state);
  });
});

describe('callSmallTichu', () => {
  it('allows a call before playing a first card when nobody is out', () => {
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)], hasPlayedFirstCard: false }),
      makePlayer(1), makePlayer(2), makePlayer(3),
    ];
    const after = callSmallTichu(makeState({ players }), 0);
    expect(after.players[0].tichuCall).toBe('small');
  });

  it('rejects a call once any player has gone out', () => {
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)], hasPlayedFirstCard: false }),
      makePlayer(1),
      makePlayer(2, { isOut: true, outOrder: 1, hasPlayedFirstCard: true }),
      makePlayer(3),
    ];
    const after = callSmallTichu(makeState({ players }), 0);
    expect(after.players[0].tichuCall).toBe('none');
  });
});

describe('passTurn — pass-count threshold when leader is out', () => {
  it('still requires remaining active players to act after the leader goes out on their last play', () => {
    // Seat 3 was already out earlier in the round. Seat 0 just played their
    // last cards (lastPlayedBy = 0, isOut = true). Two players (1 and 2)
    // remain. After seat 1 passes, seat 2 still needs a turn — the trick
    // must NOT be auto-awarded yet.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { isOut: true, outOrder: 2, hasPlayedFirstCard: true }),
      makePlayer(1, { hand: [c(8)], hasPlayedFirstCard: true }),
      makePlayer(2, { hand: [c(9)], hasPlayedFirstCard: true }),
      makePlayer(3, { isOut: true, outOrder: 1 }),
    ];
    const state = makeState({
      players,
      turnIndex: 1,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      outCount: 2,
    });

    const after1 = passTurn(state, 1);
    expect(after1.trickCountdownStarted).toBeFalsy();
    expect(after1.state.trickCountdown).toBeNull();
    expect(after1.state.passCount).toBe(1);
    expect(after1.state.turnIndex).toBe(2);

    const after2 = passTurn(after1.state, 2);
    expect(after2.trickCountdownStarted).toBe(true);
    // No remaining player can bomb (everyone holds < 4 cards), so the countdown
    // collapses to the fast duration.
    expect(after2.state.trickCountdown).toEqual({ winner: 0, durationMs: 500 });
  });

  it('a bomb fulfills an outstanding Mah Jong wish for the bomb rank', () => {
    // Wish is set for 5s. Seat 1 is on turn but seat 2 (out-of-turn) bombs
    // with four 5s. The wish should clear.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)], hasPlayedFirstCard: true }),
      makePlayer(1, { hand: [c(9)], hasPlayedFirstCard: true }),
      makePlayer(2, {
        hand: [c(5, 'jade'), c(5, 'sword'), c(5, 'pagoda'), c(5, 'star'), c(11)],
        hasPlayedFirstCard: true,
      }),
      makePlayer(3, { hand: [c(12)], hasPlayedFirstCard: true }),
    ];
    const state = makeState({
      players,
      turnIndex: 1,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      mahJongWish: 5,
    });

    const bomb: Card[] = [c(5, 'jade'), c(5, 'sword'), c(5, 'pagoda'), c(5, 'star')];
    const after = playBomb(state, 2, bomb);
    expect(after.state.lastPlayedBy).toBe(2);
    expect(after.state.mahJongWish).toBeNull();
  });

  it('enforces the Mah Jong wish when leading a new trick', () => {
    // No current trick (seat 0 leads) and a wish for 5s is active. Seat 0 holds
    // a 5, so a lead that omits it must be rejected, and a lead that includes it
    // must be accepted (and fulfill the wish).
    const state = makeState({
      players: [
        makePlayer(0, { hand: [c(5, 'jade'), c(9, 'sword')], hasPlayedFirstCard: true }),
        makePlayer(1), makePlayer(2), makePlayer(3),
      ],
      turnIndex: 0,
      currentTrick: null,
      mahJongWish: 5,
    });

    // Leading the 9 (omitting the wished 5) is illegal — state unchanged.
    const rejected = playCards(state, 0, [c(9, 'sword')]);
    expect(rejected.state).toBe(state);

    // Leading the 5 is legal and fulfills the wish.
    const accepted = playCards(state, 0, [c(5, 'jade')]);
    expect(accepted.state.mahJongWish).toBeNull();
    expect(accepted.state.lastPlayedBy).toBe(0);
  });

  it('holds the turn on the Mah Jong player until they pick a wish', () => {
    // Seat 0 has the Mah Jong and leads with it. The turn must stay on seat 0
    // (so seat 1 doesn't see "Your turn!" while the wish dialog is open) and
    // any play/pass attempt by seat 1 must be rejected.
    const mahjong: Card = { type: 'special', name: 'mahjong' };
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [mahjong, c(8), c(9)], hasPlayedFirstCard: false }),
      makePlayer(1, { hand: [c(10), c(11)], hasPlayedFirstCard: false }),
      makePlayer(2, { hand: [c(12), c(13)], hasPlayedFirstCard: false }),
      makePlayer(3, { hand: [c(14), c(2)], hasPlayedFirstCard: false }),
    ];
    const state = makeState({ players, turnIndex: 0 });

    const afterMahjong = playCards(state, 0, [mahjong]);
    expect(afterMahjong.needMahJongWish).toBe(true);
    expect(afterMahjong.state.mahJongWishPending).toBe(true);
    // Turn stays on seat 0 — does NOT advance to seat 1.
    expect(afterMahjong.state.turnIndex).toBe(0);
    expect(afterMahjong.state.lastPlayedBy).toBe(0);

    // Seat 1 cannot play while the wish is pending.
    const seat1Tries = playCards(afterMahjong.state, 1, [c(10)]);
    expect(seat1Tries.state).toBe(afterMahjong.state);

    // Seat 1 cannot pass either.
    const seat1Passes = passTurn(afterMahjong.state, 1);
    expect(seat1Passes.state).toBe(afterMahjong.state);

    // Once seat 0 sets the wish, the turn advances (clockwise default → seat 1)
    // and the pending flag clears.
    const afterWish = setMahJongWish(afterMahjong.state, 0, 5);
    expect(afterWish.mahJongWishPending).toBe(false);
    expect(afterWish.mahJongWish).toBe(5);
    expect(afterWish.turnIndex).toBe(1);

    // A different seat cannot set or override a pending wish.
    const intruder = setMahJongWish(afterMahjong.state, 1, 9);
    expect(intruder).toBe(afterMahjong.state);
  });

  it('declining the wish (null) also releases the turn', () => {
    const mahjong: Card = { type: 'special', name: 'mahjong' };
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [mahjong, c(8)], hasPlayedFirstCard: false }),
      makePlayer(1, { hand: [c(10), c(11)] }),
      makePlayer(2, { hand: [c(12), c(13)] }),
      makePlayer(3, { hand: [c(14), c(2)] }),
    ];
    const state = makeState({ players, turnIndex: 0 });

    const afterMahjong = playCards(state, 0, [mahjong]);
    expect(afterMahjong.state.turnIndex).toBe(0);

    const afterWish = setMahJongWish(afterMahjong.state, 0, null);
    expect(afterWish.mahJongWish).toBeNull();
    expect(afterWish.mahJongWishPending).toBe(false);
    expect(afterWish.turnIndex).toBe(1);
  });

  it('awards on the single remaining pass when the leader is still in', () => {
    // All four players still in. Seat 0 led, seats 1 and 2 already passed;
    // seat 3 passing should win the trick.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)] }),
      makePlayer(1, { hand: [c(9)] }),
      makePlayer(2, { hand: [c(10)] }),
      makePlayer(3, { hand: [c(11)] }),
    ];
    const state = makeState({
      players,
      turnIndex: 3,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      passCount: 2,
    });

    const after = passTurn(state, 3);
    expect(after.trickCountdownStarted).toBe(true);
    expect(after.state.trickCountdown).toEqual({ winner: 0, durationMs: 500 });
  });

  it('uses the full countdown when a non-winner could still bomb', () => {
    // Seat 1 holds 4 cards, so a bomb remains possible after seat 0 wins —
    // the countdown must stay at the full duration.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(8)] }),
      makePlayer(1, { hand: [c(9), c(9), c(9), c(9)] }),
      makePlayer(2, { hand: [c(10)] }),
      makePlayer(3, { hand: [c(11)] }),
    ];
    const state = makeState({
      players,
      turnIndex: 3,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      passCount: 2,
    });

    const after = passTurn(state, 3);
    expect(after.trickCountdownStarted).toBe(true);
    expect(after.state.trickCountdown).toEqual({ winner: 0, durationMs: 3000 });
  });

  it('uses the full countdown when the winner holds a bomb (e.g. to bomb their own Dragon)', () => {
    // Only the winner (seat 0) has >= 4 cards. They may still want to bomb their
    // own trick — the classic Dragon case — so the countdown stays full.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(9), c(9), c(9), c(9)] }),
      makePlayer(1, { hand: [c(8)] }),
      makePlayer(2, { hand: [c(10)] }),
      makePlayer(3, { hand: [c(11)] }),
    ];
    const state = makeState({
      players,
      turnIndex: 3,
      lastPlayedBy: 0,
      currentTrick: trickSeven,
      currentTrickPlays: [{ seat: 0, cards: [c(7)] }],
      passCount: 2,
    });

    const after = passTurn(state, 3);
    expect(after.trickCountdownStarted).toBe(true);
    expect(after.state.trickCountdown).toEqual({ winner: 0, durationMs: 3000 });
  });
});

describe('round history — tichu call records', () => {
  it('records each call with its outcome when the round ends', () => {
    // Seat 2 called Tichu and went out first (made); seat 1 called Grand and
    // did not (missed). Seat 0 concedes (partner 2 is out), ending the round.
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(5)] }),
      makePlayer(1, { hand: [c(6)], tichuCall: 'grand' }),
      makePlayer(2, { hand: [], isOut: true, outOrder: 1, tichuCall: 'small' }),
      makePlayer(3, { hand: [c(8)] }),
    ];
    const state = makeState({ players, outCount: 1 });

    const after = concede(state, 0);
    expect(after.roundEnded).toBe(true);
    expect(after.state.roundHistory).toHaveLength(1);
    expect(after.state.roundHistory[0].tichuCalls).toEqual([
      { seat: 1, call: 'grand', made: false },
      { seat: 2, call: 'small', made: true },
    ]);
  });

  it('records an empty list when nobody called', () => {
    const players: [Player, Player, Player, Player] = [
      makePlayer(0, { hand: [c(5)] }),
      makePlayer(1, { hand: [c(6)] }),
      makePlayer(2, { hand: [], isOut: true, outOrder: 1 }),
      makePlayer(3, { hand: [c(8)] }),
    ];
    const after = concede(makeState({ players, outCount: 1 }), 0);
    expect(after.state.roundHistory[0].tichuCalls).toEqual([]);
  });
});

const dragon: Card = { type: 'special', name: 'dragon' };
const phoenix: Card = { type: 'special', name: 'phoenix' };
const trickDragon: Combo = { type: 'single', cards: [dragon], rank: 15, length: 1 };

describe('trick countdown locks the trick', () => {
  const countdownState = () => makeState({
    players: [
      makePlayer(0, { hand: [c(9), c(3)] }),
      makePlayer(1, { hand: [c(5)] }),
      makePlayer(2, { hand: [c(6)] }),
      makePlayer(3, { hand: [c(4), c(2)] }),
    ],
    currentTrick: trickSeven,
    currentTrickPlays: [{ seat: 1, cards: [c(7)] }],
    lastPlayedBy: 1,
    passCount: 3,
    passedSeats: [2, 3, 0],
    turnIndex: 0,
    trickCountdown: { winner: 1, durationMs: 3000 },
  });

  it('rejects a normal play from the last passer once every other player has passed', () => {
    const state = countdownState();
    const result = playCards(state, 0, [c(9)]);
    expect(result.state).toBe(state);
  });

  it('rejects a further pass that would restart the countdown', () => {
    const state = countdownState();
    const result = passTurn(state, 0);
    expect(result.state).toBe(state);
  });

  it('still lets a bomb interrupt the countdown', () => {
    const state = countdownState();
    state.players[3] = makePlayer(3, { hand: [c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(8, 'star')] });
    const result = playBomb(state, 3, state.players[3].hand);
    expect(result.state).not.toBe(state);
    expect(result.state.trickCountdown).toBeNull();
    expect(result.state.lastPlayedBy).toBe(3);
  });
});

describe('Dragon giveaway locks the table', () => {
  const giveawayState = () => makeState({
    players: [
      makePlayer(0, { hand: [c(9), c(3)] }),
      makePlayer(1, { hand: [c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(8, 'star')] }),
      makePlayer(2, { hand: [c(6)] }),
      makePlayer(3, { hand: [c(4), c(2)] }),
    ],
    currentTrick: trickDragon,
    currentTrickPlays: [{ seat: 3, cards: [c(10)] }, { seat: 0, cards: [dragon] }],
    lastPlayedBy: 0,
    turnIndex: 1,
    dragonGiveaway: true,
    dragonGiveawayBy: 0,
  });

  it('rejects a bomb once the Dragon trick has been awarded and is awaiting the giveaway', () => {
    const state = giveawayState();
    const result = playBomb(state, 1, state.players[1].hand);
    expect(result.state).toBe(state);
  });

  it('rejects a pass while the giveaway is pending', () => {
    const state = giveawayState();
    expect(passTurn(state, 1).state).toBe(state);
  });
});

describe('endRound with a Dragon trick still on the table (E6)', () => {
  it('asks the Dragon player for the giveaway before scoring when they go out third on the Dragon', () => {
    const state = makeState({
      players: [
        makePlayer(0, { hand: [dragon] }),
        makePlayer(1, { hand: [], isOut: true, outOrder: 1 }),
        makePlayer(2, { hand: [], isOut: true, outOrder: 2 }),
        makePlayer(3, { hand: [c(3), c(4)] }),
      ],
      outCount: 2,
      currentTrick: { type: 'single', cards: [c(10)], rank: 10, length: 1 },
      currentTrickPlays: [{ seat: 3, cards: [c(10)] }],
      lastPlayedBy: 3,
      turnIndex: 0,
    });
    const played = playCards(state, 0, [dragon]);
    expect(played.roundEnded).toBeFalsy();
    expect(played.needDragonChoice).toBe(true);
    expect(played.state.dragonGiveaway).toBe(true);
    expect(played.state.dragonGiveawayBy).toBe(0);
    expect(played.state.players[0].isOut).toBe(true);

    // Giving to an opponent ends the round; the trick (10 + Dragon = 35) goes to team 1.
    const given = giveDragonTrick(played.state, 0, 1);
    expect(given.roundEnded).toBe(true);
    expect(given.roundResult!.teamScores[1]).toBe(35);
    expect(given.roundResult!.teamScores[0]).toBe(0); // seat 3's leftover 3,4 are worth 0
    expect(given.state.phase).toBe('roundEnd');
  });

  it('ends immediately on a 1-2 finish even if the Dragon is on the table', () => {
    const state = makeState({
      players: [
        makePlayer(0, { hand: [dragon] }),
        makePlayer(1, { hand: [c(3)] }),
        makePlayer(2, { hand: [], isOut: true, outOrder: 1 }),
        makePlayer(3, { hand: [c(4)] }),
      ],
      outCount: 1,
      currentTrick: { type: 'single', cards: [c(10)], rank: 10, length: 1 },
      currentTrickPlays: [{ seat: 1, cards: [c(10)] }],
      lastPlayedBy: 1,
      turnIndex: 0,
    });
    const played = playCards(state, 0, [dragon]);
    expect(played.roundEnded).toBe(true);
    expect(played.roundResult!.isDoubleVictory).toBe(true);
    expect(played.state.dragonGiveaway).toBe(false);
  });
});

describe('concede keeps the in-progress trick in the scoring', () => {
  it('awards the cards on the table to the last player to play so the round still totals 100', () => {
    const state = makeState({
      players: [
        makePlayer(0, { hand: [c(3)], tricksWon: [] }),
        makePlayer(1, { hand: [c(4), c(2)], tricksWon: [[c(5, 'jade'), c(5, 'sword')]] }),
        makePlayer(2, { hand: [], isOut: true, outOrder: 1, tricksWon: [[c(13, 'jade'), c(13, 'sword'), c(13, 'pagoda'), c(13, 'star')]] }),
        makePlayer(3, { hand: [c(6)], tricksWon: [[c(10, 'jade'), c(10, 'sword'), c(10, 'pagoda'), c(10, 'star'), c(5, 'pagoda'), c(5, 'star'), phoenix]] }),
      ],
      outCount: 1,
      currentTrick: trickDragon,
      currentTrickPlays: [{ seat: 3, cards: [c(9)] }, { seat: 1, cards: [dragon] }],
      lastPlayedBy: 1,
      turnIndex: 2,
    });
    // Seat 0 (partner of the first-out seat 2) concedes; the Dragon on the table
    // was played by seat 1 and must count for somebody.
    const result = concede(state, 0);
    expect(result.roundEnded).toBe(true);
    const total = result.roundResult!.teamScores[0] + result.roundResult!.teamScores[1];
    expect(total).toBe(100);
  });
});

const mahjong: Card = { type: 'special', name: 'mahjong' };
const dog: Card = { type: 'special', name: 'dog' };

describe('duplicate card objects in a play', () => {
  it('rejects the same card listed twice as a pair', () => {
    const state = makeState({ players: [makePlayer(0, { hand: [c(13, 'sword'), c(2)] }), makePlayer(1), makePlayer(2), makePlayer(3)] });
    expect(playCards(state, 0, [c(13, 'sword'), c(13, 'sword')]).state).toBe(state);
  });
  it('rejects one card repeated four times as a bomb', () => {
    const state = makeState({
      players: [makePlayer(0, { hand: [c(13, 'sword'), c(2)] }), makePlayer(1), makePlayer(2), makePlayer(3)],
      currentTrick: trickSeven, currentTrickPlays: [{ seat: 1, cards: [c(7)] }], lastPlayedBy: 1, turnIndex: 2,
    });
    expect(playBomb(state, 0, [c(13, 'sword'), c(13, 'sword'), c(13, 'sword'), c(13, 'sword')]).state).toBe(state);
  });
});

describe('bombs on an empty table', () => {
  const bomb = [c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(8, 'star')];
  it('may not be played out of turn when nobody has led', () => {
    const state = makeState({ players: [makePlayer(0, { hand: [c(2)] }), makePlayer(1, { hand: bomb }), makePlayer(2), makePlayer(3)], turnIndex: 0 });
    expect(playBomb(state, 1, bomb).state).toBe(state);
  });
  it('may be led by the player whose lead it is', () => {
    const state = makeState({ players: [makePlayer(0, { hand: [c(2)] }), makePlayer(1, { hand: bomb }), makePlayer(2), makePlayer(3)], turnIndex: 1 });
    expect(playBomb(state, 1, bomb).state.lastPlayedBy).toBe(1);
  });
});

describe('Dog under an open Mah Jong wish', () => {
  it('cannot be led to dodge a wish the leader could satisfy', () => {
    const state = makeState({ players: [makePlayer(0, { hand: [dog, c(5), c(9)] }), makePlayer(1), makePlayer(2), makePlayer(3)], mahJongWish: 5 });
    expect(playCards(state, 0, [dog]).state).toBe(state);
    expect(playCards(state, 0, [c(5)]).state.mahJongWish).toBeNull();
  });
  it('may be led when the leader does not hold the wished rank', () => {
    const state = makeState({ players: [makePlayer(0, { hand: [dog, c(9)] }), makePlayer(1), makePlayer(2), makePlayer(3)], mahJongWish: 5 });
    expect(playCards(state, 0, [dog]).state.turnIndex).toBe(2);
  });
});

describe('concede with the Dragon on the table', () => {
  it('gives the Dragon trick to the opponents of whoever played it', () => {
    const state = makeState({
      players: [
        makePlayer(0, { hand: [c(3)] }),
        makePlayer(1, { hand: [c(4), c(2)] }),
        makePlayer(2, { hand: [], isOut: true, outOrder: 1 }),
        makePlayer(3, { hand: [c(6)] }),
      ],
      outCount: 1,
      currentTrick: trickDragon,
      currentTrickPlays: [{ seat: 3, cards: [c(10)] }, { seat: 2, cards: [dragon] }],
      lastPlayedBy: 2,
      turnIndex: 3,
    });
    const result = concede(state, 0);
    // Seat 2 (team 0) played the Dragon; the 35 points must land with team 1.
    expect(result.roundResult!.teamScores[1]).toBe(35);
    expect(result.roundResult!.teamScores[0]).toBe(0);
  });
});

describe('wish enforcement with Phoenix gap-fill straights', () => {
  it('recognises a straight where the Phoenix fills a gap next to the wished rank', () => {
    const trick: Combo = { type: 'straight', cards: [c(3), c(4), c(5), c(6), c(7)], rank: 7, length: 5 };
    const hand = [c(5, 'star'), c(6, 'star'), c(8), c(9), phoenix, c(2)];
    expect(canPlayWishedRankFromHand(hand, 8, trick)).toBe(true);
    const state = makeState({ players: [makePlayer(0, { hand }), makePlayer(1), makePlayer(2), makePlayer(3)], currentTrick: trick, currentTrickPlays: [{ seat: 3, cards: trick.cards }], lastPlayedBy: 3, mahJongWish: 8 });
    expect(passTurn(state, 0).state).toBe(state);
  });
});

describe('a wish can force out a bomb', () => {
  const eights = [c(8, 'jade'), c(8, 'sword'), c(8, 'pagoda'), c(8, 'star')];
  const trickKing: Combo = { type: 'single', cards: [c(13)], rank: 13, length: 1 };
  const state = () => makeState({
    players: [makePlayer(0, { hand: [...eights, c(3)] }), makePlayer(1), makePlayer(2), makePlayer(3)],
    currentTrick: trickKing,
    currentTrickPlays: [{ seat: 3, cards: [c(13)] }],
    lastPlayedBy: 3,
    turnIndex: 0,
    mahJongWish: 8,
  });

  it('refuses to let the holder pass when the bomb is the only play containing the wished rank', () => {
    const s = state();
    expect(passTurn(s, 0).state).toBe(s);
  });

  it('accepts the bomb through either play path and clears the wish', () => {
    expect(playCards(state(), 0, eights).state.mahJongWish).toBeNull();
    expect(playBomb(state(), 0, eights).state.mahJongWish).toBeNull();
  });
});
