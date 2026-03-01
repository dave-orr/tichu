import { identifyCombo, canBeat, isBomb, singleCardRank } from './combinations.js';
import { createDeck, shuffle, sortHand } from './deck.js';
import { scoreRound, isGameOver, getWinner } from './scoring.js';
import {
  Card, Combo, GameState, GameSettings, DEFAULT_SETTINGS, NormalRank, Phase, Player, RoundResult, Seat,
  Team, cardsEqual, cardId, getPartnerSeat, getRightSeat, getTeamForSeat,
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
    dragonGiveaway: false,
    dragonGiveawayBy: null,
    settings: settings ?? DEFAULT_SETTINGS,
    playedCards: [],
  };
}

function createPlayer(id: string, name: string, seat: Seat): Player {
  return {
    id,
    name,
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
    dragonGiveaway: false,
    dragonGiveawayBy: null,
    playedCards: [],
    players: state.players.map((p, i) => ({
      ...p,
      hand: sortHand(deck.slice(i * 14, i * 14 + 8)), // first 8 cards
      tricksWon: [],
      tichuCall: p.tichuCall === 'grand' ? 'grand' : 'none' as const, // preserve grand calls... actually reset
      hasPlayedFirstCard: false,
      isOut: false,
      outOrder: 0,
      grandTichuDecided: false,
      passedCards: false,
    })) as unknown as [Player, Player, Player, Player],
  };

  // Reset tichu calls for new round
  for (const p of newState.players) {
    p.tichuCall = 'none';
  }

  return newState;
}

/** Give remaining 6 cards to each player after Grand Tichu window */
export function dealRemainingCards(state: GameState): GameState {
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    hand: sortHand([
      ...p.hand,
      ...state.deck.slice(i * 14 + 8, i * 14 + 14),
    ]),
  })) as [Player, Player, Player, Player];

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

  const newPlayers = [...state.players] as [Player, Player, Player, Player];
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

  const newPlayers = [...state.players] as [Player, Player, Player, Player];
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
  const newPlayers = [...state.players] as [Player, Player, Player, Player];
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
  const newPlayers = state.players.map(p => ({
    ...p,
    hand: [...p.hand],
  })) as [Player, Player, Player, Player];

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
  };
}

// ===== Playing Cards =====

export type PlayResult = {
  state: GameState;
  trickWon?: boolean;
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
  let newPlayers = state.players.map(p => ({ ...p, hand: [...p.hand] })) as [Player, Player, Player, Player];
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

  // Check if round ended (3 players out)
  if (newOutCount >= 3) {
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

  const newPlayers = state.players.map(p => ({ ...p, hand: [...p.hand] })) as [Player, Player, Player, Player];
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
  // If partner is out, go to next active player after partner
  if (newPlayers[partnerSeat].isOut) {
    partnerSeat = getNextActiveSeat(state, seat, newPlayers);
  }

  if (newOutCount >= 3) {
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
    return winTrick(state);
  }

  return {
    state: {
      ...state,
      passCount: newPassCount,
      turnIndex: getNextActiveSeat(state, seat, state.players),
    },
  };
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
  const newPlayers = state.players.map(p => ({
    ...p,
    tricksWon: [...p.tricksWon],
  })) as [Player, Player, Player, Player];
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
  const newPlayers = state.players.map(p => ({
    ...p,
    tricksWon: [...p.tricksWon],
  })) as [Player, Player, Player, Player];
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

  if (newState.outCount >= 3) {
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

  if (!trick) return true; // Leading — can always play the wished rank

  // For singles: can play if wished rank beats current
  if (trick.type === 'single') {
    return wish > trick.rank;
  }

  // For pairs: can play if player has a pair of the wished rank that beats current
  if (trick.type === 'pair') {
    const wishedCards = hand.filter(c => c.type === 'normal' && c.rank === wish);
    return wishedCards.length >= 2 && wish > trick.rank;
  }

  // For triples: can play if player has a triple of the wished rank
  if (trick.type === 'triple' || trick.type === 'fullHouse') {
    const wishedCards = hand.filter(c => c.type === 'normal' && c.rank === wish);
    return wishedCards.length >= 3 && wish > trick.rank;
  }

  // For other combo types (straights, consecutive pairs), checking is complex.
  // Conservatively return false (allow passing) for non-trivial combos.
  return false;
}

/** Check if a player must play the wished rank and isn't doing so */
function checkWishCompliance(state: GameState, seat: Seat, cards: Card[]): boolean {
  const wish = state.mahJongWish;
  if (wish == null) return true;

  const player = state.players[seat];

  // Check if player has the wished rank (wishes are for normal ranks 2-14 only)
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
  // Simplified: only enforce for singles and when leading.
  if (state.currentTrick == null) {
    return true;
  }

  if (state.currentTrick.type === 'single') {
    // Must play the wished rank as a single if it beats current
    const wishedCard = player.hand.find(c =>
      c.type === 'normal' && c.rank === wish
    );
    if (wishedCard) {
      if (wish > state.currentTrick.rank) {
        return false; // Must play the wished card
      }
    }
  }

  return true; // For non-single combos, wish enforcement is complex; allow for now
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
  const newPlayers = state.players.map(p => ({
    ...p,
    hand: [...p.hand],
  })) as [Player, Player, Player, Player];

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
  };

  if (newOutCount >= 3) {
    return endRound(newState);
  }

  return { state: newState };
}

// ===== Round End =====

function endRound(state: GameState): PlayResult {
  const result = scoreRound(state);

  // Update team scores
  const newTeams: [Team, Team] = [
    { ...state.teams[0], score: result.totalScores[0] },
    { ...state.teams[1], score: result.totalScores[1] },
  ];

  const gameOver = isGameOver(result.totalScores);

  return {
    state: {
      ...state,
      phase: gameOver ? 'gameEnd' : 'roundEnd',
      teams: newTeams,
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

function getNextActiveSeat(
  state: GameState, currentSeat: Seat,
  players: Player[]
): Seat {
  let next = getRightSeat(currentSeat);
  let attempts = 0;
  while (players[next].isOut && attempts < 4) {
    next = getRightSeat(next);
    attempts++;
  }
  return next;
}

// ===== Client View =====

import { ClientGameState, ClientPlayer } from './types.js';
import { sumPoints } from './scoring.js';

export function toClientState(state: GameState, forSeat: Seat): ClientGameState {
  const clientPlayers = state.players.map(p => ({
    id: p.id,
    name: p.name,
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
  })) as [ClientPlayer, ClientPlayer, ClientPlayer, ClientPlayer];

  return {
    phase: state.phase,
    players: clientPlayers,
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
    dragonGiveaway: state.dragonGiveaway,
    dragonGiveawayBy: state.dragonGiveawayBy,
    settings: state.settings,
    playedCards: state.playedCards,
    myHand: state.players[forSeat].hand,
    mySeat: forSeat,
  };
}
