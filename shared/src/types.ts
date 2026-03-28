// ===== Cards =====

export type Suit = 'jade' | 'sword' | 'pagoda' | 'star';

// 2-14 where J=11, Q=12, K=13, A=14
export type NormalRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type SpecialCardName = 'mahjong' | 'dog' | 'phoenix' | 'dragon';

export type NormalCard = {
  type: 'normal';
  suit: Suit;
  rank: NormalRank;
};

export type SpecialCard = {
  type: 'special';
  name: SpecialCardName;
};

export type Card = NormalCard | SpecialCard;

// ===== Combinations =====

export type ComboType =
  | 'single'
  | 'pair'
  | 'consecutivePairs'
  | 'triple'
  | 'fullHouse'
  | 'straight'
  | 'fourOfAKindBomb'
  | 'straightFlushBomb';

export type Combo = {
  type: ComboType;
  cards: Card[];
  rank: number;      // primary rank for comparison
  length: number;    // number of cards (for straights/consecutive pairs matching)
};

// ===== Invite System =====

export type InvitablePlayer = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  playedWith: boolean;
  isOnline: boolean;
  isAvailable: boolean;
};

// ===== Game Settings =====

export type GameSettings = {
  countPoints: boolean;   // show captured point totals by player names
  cardsSeen: boolean;     // show remaining card counts (cards not yet played)
  showPassedCards: boolean; // show cards you passed during play
  clockwise: boolean;     // play direction: true = clockwise, false = counterclockwise
  targetScore: number;    // score needed to win (default 1000)
};

export const DEFAULT_SETTINGS: GameSettings = {
  countPoints: false,
  cardsSeen: false,
  showPassedCards: false,
  clockwise: false,
  targetScore: 1000,
};

// ===== Game State =====

export type Phase =
  | 'waiting'          // waiting for players to join
  | 'dealing'          // cards being dealt
  | 'grandTichuWindow' // players deciding on Grand Tichu (first 8 cards)
  | 'passing'          // players selecting cards to pass
  | 'playing'          // main gameplay
  | 'roundEnd'         // showing round results
  | 'gameEnd';         // game over

export type Seat = 0 | 1 | 2 | 3; // N=0, E=1, S=2, W=3; 0&2 are partners, 1&3 are partners

export type TichuCall = 'none' | 'small' | 'grand';

export type Player = {
  id: string;
  name: string;
  photoURL: string | null;
  seat: Seat;
  hand: Card[];
  tricksWon: Card[][]; // cards collected from won tricks
  tichuCall: TichuCall;
  hasPlayedFirstCard: boolean;
  isOut: boolean;       // true when all cards played
  outOrder: number;     // 0 = not out, 1 = first out, 2 = second, etc.
  grandTichuDecided: boolean; // has decided whether to call grand tichu
  passedCards: boolean;  // has selected cards to pass
  isAi: boolean;         // true for API-connected AI players
};

export type Team = {
  players: [Seat, Seat]; // the two seat indices
  score: number;         // cumulative across rounds
};

export type PassSelection = {
  left: Card | null;
  partner: Card | null;
  right: Card | null;
};

export type ReceivedCard = {
  card: Card;
  fromSeat: Seat;
};

export type GameState = {
  phase: Phase;
  players: [Player, Player, Player, Player];
  teams: [Team, Team]; // team 0 = seats 0,2; team 1 = seats 1,3
  currentTrick: Combo | null;
  currentTrickCards: Card[][]; // all plays in current trick for display
  passCount: number;           // consecutive passes
  turnIndex: Seat;             // whose turn it is
  lastPlayedBy: Seat | null;   // who played the current top combo
  mahJongWish: NormalRank | null; // active wish (null = no wish)
  mahJongWishPending: boolean;    // true = mah jong was played, waiting for wish selection
  outCount: number;            // how many players are out
  roundNumber: number;
  deck: Card[];                // remaining deck (only during deal)
  bombWindow: boolean;         // true = waiting for bomb responses
  trickCountdown: { winner: Seat } | null; // countdown before awarding trick
  dragonGiveaway: boolean;     // true = dragon winner must choose opponent
  dragonGiveawayBy: Seat | null;
  settings: GameSettings;
  playedCards: Card[];         // all cards played/discarded this round (for cards-seen tracking)
  roundEndReady: Seat[];       // seats that have acknowledged round results
  roundHistory: RoundHistoryEntry[]; // score history for all completed rounds
  receivedCards: [ReceivedCard[], ReceivedCard[], ReceivedCard[], ReceivedCard[]]; // cards received from passing, per seat
};

// ===== Socket Events =====

export type ClientEvent =
  | { type: 'create-room'; playerName: string }
  | { type: 'join-room'; roomCode: string; playerName: string }
  | { type: 'start-game' }
  | { type: 'call-grand-tichu'; call: boolean }
  | { type: 'call-small-tichu' }
  | { type: 'pass-cards'; left: Card; partner: Card; right: Card }
  | { type: 'play-cards'; cards: Card[] }
  | { type: 'pass-turn' }
  | { type: 'bomb'; cards: Card[] }
  | { type: 'give-dragon-trick'; to: Seat }
  | { type: 'mah-jong-wish'; rank: NormalRank }
  | { type: 'decline-bomb' }; // during bomb window

export type ServerEvent =
  | { type: 'room-created'; roomCode: string }
  | { type: 'player-joined'; playerName: string; seat: Seat }
  | { type: 'game-state'; state: ClientGameState }
  | { type: 'error'; message: string }
  | { type: 'grand-tichu-prompt'; cards: Card[] } // first 8 cards
  | { type: 'round-result'; result: RoundResult }
  | { type: 'game-over'; winner: 0 | 1; finalScores: [number, number] };

// What the client sees (hands hidden for other players)
export type ClientGameState = Omit<GameState, 'players' | 'deck' | 'receivedCards'> & {
  players: [ClientPlayer, ClientPlayer, ClientPlayer, ClientPlayer];
  myHand: Card[];
  mySeat: Seat;
  myReceivedCards: ReceivedCard[];
};

export type ClientPlayer = Omit<Player, 'hand' | 'tricksWon'> & {
  cardCount: number;       // how many cards they hold
  trickCount: number;      // how many tricks they've won
  capturedPoints: number;  // total card points captured so far
  isAi: boolean;           // true for API-connected AI players
};

export type RoundHistoryEntry = {
  roundNumber: number;
  cardPoints: [number, number];
  tichuBonuses: [number, number];
  roundTotal: [number, number];
  cumulativeScores: [number, number];
};

export type RoundResult = {
  teamScores: [number, number]; // card points this round
  tichuBonuses: [number, number];
  isDoubleVictory: boolean;
  doubleVictoryTeam?: 0 | 1;
  totalScores: [number, number]; // cumulative
  outOrder: [Seat, Seat, Seat, Seat]; // order players went out (last = still had cards)
};

// ===== Round Log (for analytics) =====

export type RoundLogPlayerEntry = {
  seat: Seat;
  uid: string | null;
  name: string;
  team: 0 | 1;
  tichuCall: TichuCall;
  outOrder: number;
  initialHand: Card[];
  passedLeft: Card | null;
  passedPartner: Card | null;
  passedRight: Card | null;
};

export type RoundLog = {
  gameId: string;
  roundNumber: number;
  timestamp: number;
  scoresBeforeRound: [number, number];
  scoresAfterRound: [number, number];
  roundCardPoints: [number, number];
  tichuBonuses: [number, number];
  isDoubleVictory: boolean;
  outOrder: Seat[];
  players: RoundLogPlayerEntry[];
  bombs: Array<{ seat: Seat; cards: Card[] }>;
  dragonGiveaways: Array<{ fromSeat: Seat; toSeat: Seat }>;
  mahJongWishes: Array<{ seat: Seat; rank: NormalRank }>;
};

// ===== Type Helpers =====

/** Cast an array to a fixed-length 4-tuple. Avoids `as unknown as [T,T,T,T]` throughout. */
export function toPlayers<T>(arr: T[]): [T, T, T, T] {
  return arr as unknown as [T, T, T, T];
}

// ===== Helpers =====

export function cardId(card: Card): string {
  if (card.type === 'special') return card.name;
  return `${card.suit}-${card.rank}`;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return cardId(a) === cardId(b);
}

export function getPartnerSeat(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

export function getLeftSeat(seat: Seat): Seat {
  return ((seat + 3) % 4) as Seat;
}

export function getRightSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

export function getTeamForSeat(seat: Seat): 0 | 1 {
  return (seat % 2) as 0 | 1;
}

export const RANK_NAMES: Record<NormalRank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  jade: '🀅',
  sword: '⚔',
  pagoda: '🏯',
  star: '★',
};

export const SPECIAL_NAMES: Record<SpecialCardName, string> = {
  mahjong: 'Mah Jong',
  dog: 'Dog',
  phoenix: 'Phoenix',
  dragon: 'Dragon',
};
