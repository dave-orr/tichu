import { identifyCombo, canBeat, isBomb, singleCardRank, findPlayableCombos } from './combinations.js';
import { createDeck, shuffle, sortHand } from './deck.js';
import { scoreRound, isGameOver, getWinner, sumPoints } from './scoring.js';
import {
  Card, ClientGameState, ClientPlayer, Combo, GameState, GameSettings, DEFAULT_SETTINGS, NormalRank, Phase, Player, ReceivedCard, RoundHistoryEntry, RoundResult, Seat,
  Team, cardsEqual, cardId, getPartnerSeat, getLeftSeat, getRightSeat, getTeamForSeat, toPlayers,
} from './types.js';

// ===== State Creation =====

export function createInitialState(settings?: GameSettings): GameState {
  return {
    phase: 'waiting',
    players: [
      createPlayer('', '', 0),
      createPlayer('', '', 1),
      createPlayer('', '', 2),
      createPlayer('', '', 3),
    ],
    teams: [
      { players: [0, 2], score: 0 },
      { players: [1, 3], score: 0 },
    ],
    currentTrick: null,
    currentTrickCards: [],
    passCount: 0,
    turnIndex: 0,
    lastPlayedBy: null,
    mahJongWish: null,
    outCount: 0,
    roundNumber: 0,
    deck: [],
    bombWindow: false,
    trickCountdown: null,
    dragonGiveaway: false,
    dragonGiveawayBy: null,
    settings: settings ?? DEFAULT_SETTINGS,
    playedCards: [],
    roundEndReady: [],
    roundHistory: [],
    receivedCards: [[], [], [], []],
  };
}

function createPlayer(id: string, name: string, seat: Seat): Player {
  return {
    id,
    name,
    photoURL: null,
    seat,
    hand: [],
    tricksWon: [],
    tichuCall: 'none',
    hasPlayedFirstCard: false,
    isOut: false,
    outOrder: 0,
    grandTichuDecided: false,
    passedCards: false,
  };
}

// ===== Round Setup =====

export function startNewRound(state: GameState): GameState {
  const deck = createDeck();
  shuffle(deck);

  const newState: GameState = {
    ...state,
    phase: 'grandTichuWindow',
    currentTrick: null,
    currentTrickCards: [],
    passCount: 0,
    turnIndex: 0,
    lastPlayedBy: null,
    mahJongWish: null,
    outCount: 0,
    roundNumber: state.roundNumber + 1,
    deck,
    bombWindow: false,
    trickCountdown: null,
    dragonGiveaway: false,
    dragonGiveawayBy: null,
    playedCards: [],
    roundEndReady: [],
    receivedCards: [[], [], [], []],
    players: toPlayers(state.players.map((p, i) => ({
      ...p,
      hand: sortHand(deck.slice(i * 14, i * 14 + 8)), // first 8 cards
      tricksWon: [],
      tichuCall: 'none',
      hasPlayedFirstCard: false,
      isOut: false,
      outOrder: 0,
      grandTichuDecided: false,
      passedCards: false,
    }))),
  };

  return newState;
}

/** Give remaining 6 cards to each player after Grand Tichu window */
export function dealRemainingCards(state: GameState): GameState {
  const newPlayers = toPlayers(state.players.map((p, i) => ({
    ...p,
    hand: sortHand([
      ...p.hand,
      ...state.deck.slice(i * 14 + 8, i * 14 + 14),
    ]),
  })));

  return {
    ...state,
    phase: 'passing',
    players: newPlayers,
    deck: [],
  };
}

// ===== Grand Tichu =====

export function callGrandTichu(state: GameState, seat: Seat, call: boolean): GameState {
  if (state.phase !== 'grandTichuWindow') return state;
  if (state.players[seat].grandTichuDecided) return state;

  const newPlayers = toPlayers([...state.players]);
  newPlayers[seat] = {
    ...newPlayers[seat],
    tichuCall: call ? 'grand' : 'none',
    grandTichuDecided: true,
  };

  // Check if all players have decided
  const allDecided = newPlayers.every(p => p.grandTichuDecided);

  let newState: GameState = { ...state, players: newPlayers };

  if (allDecided) {
    newState = dealRemainingCards(newState);
  }

  return newState;
}

// ===== Small Tichu =====

export function callSmallTichu(state: GameState, seat: Seat): GameState {
  if (state.phase !== 'playing') return state;
  const player = state.players[seat];
  if (player.hasPlayedFirstCard) return state;
  if (player.tichuCall !== 'none') return state;

  const newPlayers = toPlayers([...state.players]);
  newPlayers[seat] = { ...newPlayers[seat], tichuCall: 'small' };

  return { ...state, players: newPlayers };
}

// ===== Card Passing =====

export type PassInfo = {
  left: Card;
  partner: Card;
  right: Card;
};

export function passCards(
  state: GameState,
  seat: Seat,
  pass: PassInfo
): GameState {
  if (state.phase !== 'passing') return state;
  if (state.players[seat].passedCards) return state;

  // Store the pass selections (we'll apply them all at once when everyone has passed)
  const newPlayers = toPlayers([...state.players]);
  newPlayers[seat] = {
    ...newPlayers[seat],
    passedCards: true,
  };

  return { ...state, players: newPlayers };
}

/** Apply all card passes. Called when all 4 players have submitted passes. */
export function applyPasses(
  state: GameState,
  passes: Record<Seat, PassInfo>
): GameState {
  const newPlayers = toPlayers(state.players.map(p => ({
    ...p,
    hand: [...p.hand],
  })));

  // Remove passed cards and add received cards
  for (let seat = 0; seat < 4; seat++) {
    const s = seat as Seat;
    const pass = passes[s];
    const leftSeat = ((s + 3) % 4) as Seat;
    const partnerSeat = ((s + 2) % 4) as Seat;
    const rightSeat = ((s + 1) % 4) as Seat;

    // Remove cards from this player's hand
    removeCard(newPlayers[s].hand, pass.left);
    removeCard(newPlayers[s].hand, pass.partner);
    removeCard(newPlayers[s].hand, pass.right);

    // Add cards to recipients
    newPlayers[leftSeat].hand.push(pass.left);
    newPlayers[partnerSeat].hand.push(pass.partner);
    newPlayers[rightSeat].hand.push(pass.right);
  }

  // Compute received cards for each player
  const receivedCards: [ReceivedCard[], ReceivedCard[], ReceivedCard[], ReceivedCard[]] = [[], [], [], []];
  for (let seat = 0; seat < 4; seat++) {
    const s = seat as Seat;
    const pass = passes[s];
    const leftSeat = ((s + 3) % 4) as Seat;
    const partnerSeat = ((s + 2) % 4) as Seat;
    const rightSeat = ((s + 1) % 4) as Seat;

    // This player passed left to leftSeat, partner to partnerSeat, right to rightSeat
    receivedCards[leftSeat].push({ card: pass.left, fromSeat: s });
    receivedCards[partnerSeat].push({ card: pass.partner, fromSeat: s });
    receivedCards[rightSeat].push({ card: pass.right, fromSeat: s });
  }

  // Sort all hands
  for (const p of newPlayers) {
    p.hand = sortHand(p.hand);
  }

  // Find who has the Mah Jong — they start
  let startSeat: Seat = 0;
  for (const p of newPlayers) {
    if (p.hand.some(c => c.type === 'special' && c.name === 'mahjong')) {
      startSeat = p.seat;
      break;
    }
  }

  return {
    ...state,
    phase: 'playing',
    players: newPlayers,
    turnIndex: startSeat,
    receivedCards,
  };
}

// ===== Playing Cards =====

export type PlayResult = {
  state: GameState;
  trickWon?: boolean;
  trickCountdownStarted?: boolean;
  roundEnded?: boolean;
  roundResult?: RoundResult;
  needDragonChoice?: boolean;
  needMahJongWish?: boolean;
};

export function playCards(state: GameState, seat: Seat, cards: Card[]): PlayResult {
  if (state.phase !== 'playing') return { state };
  if (state.turnIndex !== seat) return { state };
  if (state.dragonGiveaway) return { state };

  const player = state.players[seat];
  if (player.isOut) return { state };

  // Validate cards are in player's hand
  if (!cards.every(c => player.hand.some(h => cardsEqual(h, c)))) {
    return { state };
  }

  // Check for Dog
  const isDogPlay = cards.length === 1 && cards[0].type === 'special' && cards[0].name === 'dog';
  if (isDogPlay) {
    return playDog(state, seat);
  }

  // Identify the combination
  const combo = identifyCombo(cards);
  if (!combo) return { state };

  // Phoenix as a single takes rank of current trick + 0.5
  if (combo.type === 'single' && cards[0].type === 'special' && cards[0].name === 'phoenix' && state.currentTrick) {
    combo.rank = state.currentTrick.rank + 0.5;
  }

  // Check if this beats the current trick
  if (state.currentTrick && !canBeat(state.currentTrick, combo)) {
    return { state };
  }

  // If there's no current trick, this is a lead — any valid combo works
  // Check Mah Jong wish enforcement
  if (state.mahJongWish != null && state.currentTrick) {
    if (!checkWishCompliance(state, seat, cards)) {
      return { state }; // Must play the wished rank if possible
    }
  }

  // Apply the play
  let newPlayers = toPlayers(state.players.map(p => ({ ...p, hand: [...p.hand] })));
  const newPlayer = newPlayers[seat];

  // Remove cards from hand
  for (const c of cards) {
    removeCard(newPlayer.hand, c);
  }
  newPlayer.hasPlayedFirstCard = true;

  // Check if Mah Jong wish is being fulfilled (wishes are for ranks 2-14 only)
  let newWish = state.mahJongWish;
  if (newWish != null) {
    const hasWishedRank = cards.some(c =>
      c.type === 'normal' && c.rank === newWish
    );
    if (hasWishedRank) {
      newWish = null; // Wish fulfilled
    }
  }

  // Check if player needs to make a Mah Jong wish
  const needMahJongWish = cards.some(c => c.type === 'special' && c.name === 'mahjong') && state.mahJongWish == null;

  // Check if player is out
  let newOutCount = state.outCount;
  if (newPlayer.hand.length === 0) {
    newPlayer.isOut = true;
    newOutCount++;
    newPlayer.outOrder = newOutCount;
  }

  const newState: GameState = {
    ...state,
    players: newPlayers,
    currentTrick: combo,
    currentTrickCards: [...state.currentTrickCards, cards],
    passCount: 0,
    lastPlayedBy: seat,
    mahJongWish: newWish,
    outCount: newOutCount,
    turnIndex: getNextActiveSeat(state, seat, newPlayers),
    playedCards: [...state.playedCards, ...cards],
  };

  // Check if round ended (3 players out, or 1-2 finish)
  if (shouldRoundEnd(newOutCount, newPlayers)) {
    return endRound(newState);
  }

  return {
    state: newState,
    needMahJongWish: needMahJongWish,
  };
}

function playDog(state: GameState, seat: Seat): PlayResult {
  // Dog can only be played on your lead (no current trick)
  if (state.currentTrick !== null) return { state };

  const newPlayers = toPlayers(state.players.map(p => ({ ...p, hand: [...p.hand] })));
  removeCard(newPlayers[seat].hand, { type: 'special', name: 'dog' });
  newPlayers[seat].hasPlayedFirstCard = true;

  // Check if player is out
  let newOutCount = state.outCount;
  if (newPlayers[seat].hand.length === 0) {
    newPlayers[seat].isOut = true;
    newOutCount++;
    newPlayers[seat].outOrder = newOutCount;
  }

  // Pass lead to partner
  let partnerSeat = getPartnerSeat(seat);
  // If partner is out, go to next active player after partner (clockwise from partner)
  if (newPlayers[partnerSeat].isOut) {
    partnerSeat = getNextActiveSeat(state, partnerSeat, newPlayers);
  }

  if (shouldRoundEnd(newOutCount, newPlayers)) {
    return endRound({ ...state, players: newPlayers, outCount: newOutCount, playedCards: [...state.playedCards, { type: 'special', name: 'dog' } as Card] });
  }

  return {
    state: {
      ...state,
      players: newPlayers,
      turnIndex: partnerSeat,
      currentTrick: null,
      currentTrickCards: [],
      passCount: 0,
      outCount: newOutCount,
      playedCards: [...state.playedCards, { type: 'special', name: 'dog' } as Card],
    },
  };
}

// ===== Passing Turn =====

export function passTurn(state: GameState, seat: Seat): PlayResult {
  if (state.phase !== 'playing') return { state };
  if (state.turnIndex !== seat) return { state };
  if (state.currentTrick === null) return { state }; // Can't pass on lead

  // Cannot pass if you have the wished card and can legally play it
  if (state.mahJongWish != null) {
    const player = state.players[seat];
    const hasWishedRank = player.hand.some(c =>
      c.type === 'normal' && c.rank === state.mahJongWish
    );
    if (hasWishedRank && canPlayWishedRank(state, seat)) {
      return { state }; // Must play the wished card (or bomb)
    }
  }

  const newPassCount = state.passCount + 1;
  const activePlayers = state.players.filter(p => !p.isOut).length;

  // Trick is won when all other active players have passed
  if (newPassCount >= activePlayers - 1) {
    const winner = state.lastPlayedBy!;
    // Start countdown to give time for bombs
    return {
      state: {
        ...state,
        passCount: newPassCount,
        trickCountdown: { winner },
      },
      trickCountdownStarted: true,
    };
  }

  return {
    state: {
      ...state,
      passCount: newPassCount,
      turnIndex: getNextActiveSeat(state, seat, state.players),
    },
  };
}

// ===== Award Trick (called after countdown expires) =====

export function awardTrick(state: GameState): PlayResult {
  if (!state.trickCountdown) return { state };
  return winTrick({ ...state, trickCountdown: null });
}

// ===== Trick Won =====

function winTrick(state: GameState): PlayResult {
  const winner = state.lastPlayedBy!;
  const trickCards = state.currentTrickCards.flat();

  // Check if Dragon won the trick
  const dragonInTrick = state.currentTrick?.cards.some(
    c => c.type === 'special' && c.name === 'dragon'
  );

  if (dragonInTrick && state.lastPlayedBy != null) {
    // Dragon winner must give trick to an opponent
    return {
      state: {
        ...state,
        dragonGiveaway: true,
        dragonGiveawayBy: winner,
        passCount: 0,
      },
      trickWon: true,
      needDragonChoice: true,
    };
  }

  // Give trick to winner
  const newPlayers = toPlayers(state.players.map(p => ({
    ...p,
    tricksWon: [...p.tricksWon],
  })));
  newPlayers[winner].tricksWon.push(trickCards);

  // Determine next leader
  let nextLeader = winner;
  if (newPlayers[winner].isOut) {
    nextLeader = getNextActiveSeat(state, winner, newPlayers);
  }

  return {
    state: {
      ...state,
      players: newPlayers,
      currentTrick: null,
      currentTrickCards: [],
      passCount: 0,
      turnIndex: nextLeader,
      lastPlayedBy: null,
    },
    trickWon: true,
  };
}

// ===== Dragon Giveaway =====

export function giveDragonTrick(state: GameState, seat: Seat, toOpponent: Seat): PlayResult {
  if (!state.dragonGiveaway) return { state };
  if (state.dragonGiveawayBy !== seat) return { state };

  // Must give to an opponent
  const myTeam = getTeamForSeat(seat);
  const theirTeam = getTeamForSeat(toOpponent);
  if (myTeam === theirTeam) return { state };

  const trickCards = state.currentTrickCards.flat();
  const newPlayers = toPlayers(state.players.map(p => ({
    ...p,
    tricksWon: [...p.tricksWon],
  })));
  newPlayers[toOpponent].tricksWon.push(trickCards);

  let nextLeader: Seat = seat;
  if (newPlayers[seat].isOut) {
    nextLeader = getNextActiveSeat(state, seat, newPlayers);
  }

  const newState: GameState = {
    ...state,
    players: newPlayers,
    currentTrick: null,
    currentTrickCards: [],
    passCount: 0,
    turnIndex: nextLeader,
    lastPlayedBy: null,
    dragonGiveaway: false,
    dragonGiveawayBy: null,
  };

  if (shouldRoundEnd(newState.outCount, newPlayers)) {
    return endRound(newState);
  }

  return { state: newState };
}

// ===== Mah Jong Wish =====

export function setMahJongWish(state: GameState, rank: NormalRank): GameState {
  return { ...state, mahJongWish: rank };
}

/** Check if a player can make any legal play that includes the wished rank */
export function canPlayWishedRank(state: GameState, seat: Seat): boolean {
  return canPlayWishedRankFromHand(
    state.players[seat].hand,
    state.mahJongWish,
    state.currentTrick,
  );
}

/** Check if a hand can make any legal play that includes the wished rank */
export function canPlayWishedRankFromHand(
  hand: Card[], wish: NormalRank | null, trick: Combo | null
): boolean {
  if (wish == null) return false;

  const hasWishedRank = hand.some(c => c.type === 'normal' && c.rank === wish);
  if (!hasWishedRank) return false;

  if (!trick) return true; // Leading — can always play the wished rank as a single

  // Use findPlayableCombos to find all legal plays, then check if any contain the wished rank
  const combos = findPlayableCombos(hand, trick);
  return combos.some(combo => comboContainsRank(combo, wish));
}

/** Check if a combo contains a normal card of the given rank */
function comboContainsRank(combo: Combo, rank: NormalRank): boolean {
  return combo.cards.some(c => c.type === 'normal' && c.rank === rank);
}

/** Check if a player must play the wished rank and isn't doing so */
function checkWishCompliance(state: GameState, seat: Seat, cards: Card[]): boolean {
  const wish = state.mahJongWish;
  if (wish == null) return true;

  const player = state.players[seat];

  // Check if player has the wished rank
  const hasWishedRank = player.hand.some(c =>
    c.type === 'normal' && c.rank === wish
  );
  if (!hasWishedRank) return true; // Don't have it, no constraint

  // Player has the wished rank. They must include it IF they can make a legal play with it.
  const playIncludesWish = cards.some(c =>
    c.type === 'normal' && c.rank === wish
  );
  if (playIncludesWish) return true; // They're playing it, good

  // They're not playing it. Check if they COULD make a legal play that includes it.
  if (!canPlayWishedRankFromHand(player.hand, wish, state.currentTrick)) {
    return true; // Can't make any legal play with the wished rank, so no constraint
  }

  return false; // Must play the wished rank but aren't
}

// ===== Bomb (out of turn) =====

export function playBomb(state: GameState, seat: Seat, cards: Card[]): PlayResult {
  if (state.phase !== 'playing') return { state };

  const player = state.players[seat];
  if (player.isOut) return { state };

  // Validate cards are in hand
  if (!cards.every(c => player.hand.some(h => cardsEqual(h, c)))) {
    return { state };
  }

  const combo = identifyCombo(cards);
  if (!combo || !isBomb(combo)) return { state };

  // Must beat current trick (if it exists)
  if (state.currentTrick && !canBeat(state.currentTrick, combo)) {
    return { state };
  }

  // Apply the bomb
  const newPlayers = toPlayers(state.players.map(p => ({
    ...p,
    hand: [...p.hand],
  })));

  for (const c of cards) {
    removeCard(newPlayers[seat].hand, c);
  }
  newPlayers[seat].hasPlayedFirstCard = true;

  let newOutCount = state.outCount;
  if (newPlayers[seat].hand.length === 0) {
    newPlayers[seat].isOut = true;
    newOutCount++;
    newPlayers[seat].outOrder = newOutCount;
  }

  const newState: GameState = {
    ...state,
    players: newPlayers,
    currentTrick: combo,
    currentTrickCards: [...state.currentTrickCards, cards],
    passCount: 0,
    lastPlayedBy: seat,
    outCount: newOutCount,
    turnIndex: getNextActiveSeat(state, seat, newPlayers),
    playedCards: [...state.playedCards, ...cards],
    trickCountdown: null, // bomb cancels any pending countdown
  };

  if (shouldRoundEnd(newOutCount, newPlayers)) {
    return endRound(newState);
  }

  return { state: newState };
}

// ===== Concede =====

export function concede(state: GameState, seat: Seat): PlayResult {
  if (state.phase !== 'playing') return { state };
  if (state.players[seat].isOut) return { state };
  if (state.dragonGiveaway) return { state };

  // Partner must be out
  const partnerSeat = getPartnerSeat(seat);
  if (!state.players[partnerSeat].isOut) return { state };

  const newPlayers = toPlayers(state.players.map(p => ({
    ...p,
    hand: [...p.hand],
  })));

  // Assign outOrders: remaining opponents get next orders, conceding player is last
  let nextOrder = state.outCount + 1;
  for (let i = 0; i < 4; i++) {
    const s = i as Seat;
    if (!newPlayers[s].isOut && s !== seat) {
      newPlayers[s].isOut = true;
      newPlayers[s].outOrder = nextOrder++;
    }
  }
  newPlayers[seat].isOut = true;
  newPlayers[seat].outOrder = nextOrder;

  return endRound({
    ...state,
    players: newPlayers,
    outCount: 4,
    currentTrick: null,
    currentTrickCards: [],
  });
}

// ===== Round End =====

function endRound(state: GameState): PlayResult {
  // Award any in-progress trick to lastPlayedBy so those points aren't lost
  let scoringState = state;
  if (state.currentTrickCards.length > 0 && state.lastPlayedBy != null) {
    const newPlayers = toPlayers(state.players.map(p => ({
      ...p,
      tricksWon: [...p.tricksWon],
    })));
    newPlayers[state.lastPlayedBy].tricksWon.push(state.currentTrickCards.flat());
    scoringState = { ...state, players: newPlayers, currentTrick: null, currentTrickCards: [] };
  }

  const result = scoreRound(scoringState);

  // Update team scores
  const newTeams: [Team, Team] = [
    { ...state.teams[0], score: result.totalScores[0] },
    { ...state.teams[1], score: result.totalScores[1] },
  ];

  const gameOver = isGameOver(result.totalScores, state.settings.targetScore);

  // Add round history entry
  const roundTotal: [number, number] = [
    result.teamScores[0] + result.tichuBonuses[0],
    result.teamScores[1] + result.tichuBonuses[1],
  ];
  const historyEntry: RoundHistoryEntry = {
    roundNumber: state.roundNumber,
    cardPoints: result.teamScores,
    tichuBonuses: result.tichuBonuses,
    roundTotal,
    cumulativeScores: result.totalScores,
  };

  return {
    state: {
      ...state,
      phase: gameOver ? 'gameEnd' : 'roundEnd',
      teams: newTeams,
      roundHistory: [...state.roundHistory, historyEntry],
    },
    roundEnded: true,
    roundResult: result,
  };
}

// ===== Helpers =====

function removeCard(hand: Card[], card: Card): void {
  const idx = hand.findIndex(c => cardsEqual(c, card));
  if (idx >= 0) hand.splice(idx, 1);
}

/** Check if round should end: 3+ out, or 1-2 finish (both partners out first) */
function shouldRoundEnd(outCount: number, players: Player[]): boolean {
  if (outCount >= 3) return true;
  if (outCount === 2) {
    const outPlayers = players.filter(p => p.isOut);
    return getTeamForSeat(outPlayers[0].seat) === getTeamForSeat(outPlayers[1].seat);
  }
  return false;
}

function getNextActiveSeat(
  state: GameState, currentSeat: Seat,
  players: Player[]
): Seat {
  const advance = state.settings.clockwise ? getLeftSeat : getRightSeat;
  let next = advance(currentSeat);
  let attempts = 0;
  while (players[next].isOut && attempts < 4) {
    next = advance(next);
    attempts++;
  }
  return next;
}

// ===== Client View =====

export function toClientState(state: GameState, forSeat: Seat): ClientGameState {
  const clientPlayers = state.players.map(p => ({
    id: p.id,
    name: p.name,
    photoURL: p.photoURL,
    seat: p.seat,
    tichuCall: p.tichuCall,
    hasPlayedFirstCard: p.hasPlayedFirstCard,
    isOut: p.isOut,
    outOrder: p.outOrder,
    grandTichuDecided: p.grandTichuDecided,
    passedCards: p.passedCards,
    cardCount: p.hand.length,
    trickCount: p.tricksWon.length,
    capturedPoints: sumPoints(p.tricksWon.flat()),
  }));

  return {
    phase: state.phase,
    players: toPlayers(clientPlayers),
    teams: state.teams,
    currentTrick: state.currentTrick,
    currentTrickCards: state.currentTrickCards,
    passCount: state.passCount,
    turnIndex: state.turnIndex,
    lastPlayedBy: state.lastPlayedBy,
    mahJongWish: state.mahJongWish,
    outCount: state.outCount,
    roundNumber: state.roundNumber,
    bombWindow: state.bombWindow,
    trickCountdown: state.trickCountdown,
    dragonGiveaway: state.dragonGiveaway,
    dragonGiveawayBy: state.dragonGiveawayBy,
    settings: state.settings,
    playedCards: state.playedCards,
    roundEndReady: state.roundEndReady,
    roundHistory: state.roundHistory,
    myHand: state.players[forSeat].hand,
    mySeat: forSeat,
    myReceivedCards: state.receivedCards[forSeat],
  };
}
