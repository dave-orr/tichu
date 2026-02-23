# Tichu Web App — Implementation Plan

## Overview

A real-time multiplayer web app for 4 players to play Tichu, the partnership climbing/trick-taking card game. Players form two teams of two (partners sit across from each other) and race to 1000 points.

---

## 1. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | React + TypeScript | Component model fits card games well; strong ecosystem |
| **Styling** | Tailwind CSS | Rapid UI development, responsive by default |
| **Backend** | Node.js + Express + TypeScript | Shared types with frontend, fast to build |
| **Real-time** | Socket.IO | Handles WebSocket connections with fallback; rooms built-in |
| **State** | In-memory on server (Map of game rooms) | Simple for v1; no DB needed |
| **Build** | Vite (frontend), tsx (backend) | Fast dev experience |
| **Monorepo** | Single repo, three packages: `shared/`, `server/`, `client/` | Shared game types and validation logic |

---

## 2. Game Rules Summary (for implementation reference)

### Deck (56 cards)
- Standard 52 cards: suits (Jade/Sword/Pagoda/Star), ranks 2–A
- 4 special cards: Mah Jong (1), Dog, Phoenix, Dragon

### Card Combinations
1. **Single card**
2. **Pair** (two of same rank)
3. **Consecutive pairs** (e.g. 5-5-6-6-7-7, minimum 2 pairs)
4. **Triple** (three of same rank)
5. **Full house** (triple + pair, ranked by triple)
6. **Straight** (5+ consecutive cards, any suits)
7. **Bomb: four of a kind** (beats everything except bigger bomb)
8. **Bomb: straight flush** (5+ consecutive, same suit; beats four-of-a-kind bombs of fewer cards, ties broken by rank)

### Special Cards
- **Mah Jong (1):** Lowest card. Leads first trick. Player names a rank — that "wish" must be fulfilled by the next player who can legally play it.
- **Dog:** Only played when you have the lead, as a single. Passes the lead to your partner. No trick value.
- **Phoenix:** Wild card in combinations (not bombs). As a single, its value = 0.5 above whatever was last played. Worth −25 points. Cannot beat Dragon.
- **Dragon:** Highest single card. Worth +25 points. Cannot be used in combinations. If Dragon wins a trick, the trick must be given to an opponent of your choice.

### Game Flow
1. **Deal:** 8 cards each → Grand Tichu window → 6 more cards each (14 total)
2. **Pass:** Each player passes 1 card to each other player (3 cards out, 3 cards in)
3. **Play:** Mah Jong holder leads. Players play higher combos of the same type or pass. Three consecutive passes → trick winner leads next.
4. **Bombs:** Can be played at any time (even out of turn) to beat any combination.
5. **Round end:** When 3 of 4 players are out. Last player's hand goes to opponents; their tricks go to the round winner.
6. **1-2 finish:** If both partners go out 1st and 2nd, their team scores 200, no card points counted.

### Scoring
- Card points: Kings = 10, Tens = 10, Fives = 5, Dragon = 25, Phoenix = −25. All others = 0. (Total always 100.)
- Grand Tichu: +200 if caller goes out first, −200 otherwise
- Small Tichu: +100 if caller goes out first, −100 otherwise
- Game ends when a team reaches 1000 points.

---

## 3. Architecture

```
┌──────────────┐         WebSocket          ┌──────────────────┐
│   Client A   │◄──────────────────────────►│                  │
├──────────────┤                            │   Game Server    │
│   Client B   │◄──────────────────────────►│                  │
├──────────────┤                            │  - Room mgmt     │
│   Client C   │◄──────────────────────────►│  - Game state    │
├──────────────┤                            │  - Rule engine   │
│   Client D   │◄──────────────────────────►│  - Turn logic    │
└──────────────┘                            └──────────────────┘
```

### Server responsibilities
- Authoritative game state (clients never trusted)
- Validate all plays against the rules engine
- Broadcast filtered state to each player (hide other players' hands)
- Manage room lifecycle (create/join/leave)

### Client responsibilities
- Render game UI based on server state
- Let player select card combinations and submit plays
- Show animations/transitions for card plays
- Handle Tichu calls, passing, Dragon give-away, Mah Jong wish

---

## 4. Package Structure

```
tichu/
├── shared/                  # Shared types & game logic
│   ├── src/
│   │   ├── types.ts         # Card, Combo, GameState, Player, etc.
│   │   ├── deck.ts          # Deck creation & shuffling
│   │   ├── combinations.ts  # Identify & validate card combos
│   │   ├── compare.ts       # Compare two combos (can B beat A?)
│   │   ├── engine.ts        # Core game state machine
│   │   └── scoring.ts       # Point counting, round/game scoring
│   └── package.json
│
├── server/                  # Node + Socket.IO server
│   ├── src/
│   │   ├── index.ts         # Express + Socket.IO setup
│   │   ├── rooms.ts         # Room creation/joining/management
│   │   ├── handler.ts       # Socket event handlers (play, pass, tichu, etc.)
│   │   └── state.ts         # Per-room game state management
│   └── package.json
│
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx          # Router, socket context
│   │   ├── pages/
│   │   │   ├── Lobby.tsx    # Create/join room
│   │   │   └── Game.tsx     # Main game view
│   │   ├── components/
│   │   │   ├── Hand.tsx             # Player's own hand
│   │   │   ├── Card.tsx             # Single card display
│   │   │   ├── PlayArea.tsx         # Current trick on table
│   │   │   ├── OpponentHand.tsx     # Card backs for opponents
│   │   │   ├── ScoreBoard.tsx       # Running score
│   │   │   ├── PassCards.tsx        # Card passing UI
│   │   │   ├── TichuCallButton.tsx  # Grand/Small Tichu buttons
│   │   │   ├── DragonGiveaway.tsx   # Choose opponent for Dragon trick
│   │   │   └── MahJongWish.tsx      # Pick a rank for the wish
│   │   ├── hooks/
│   │   │   ├── useSocket.ts         # Socket.IO connection
│   │   │   └── useGameState.ts      # React state from server events
│   │   └── utils/
│   │       └── cardHelpers.ts       # Sort hand, group cards, etc.
│   └── package.json
│
├── package.json             # Workspace root
└── PLAN.md
```

---

## 5. Implementation Phases

### Phase 1: Shared Game Logic
Build and unit-test the core engine with no networking.

- **Deck**: Create the 56-card deck, shuffle, deal 8 + 6
- **Combinations**: Detect what combo a set of cards forms (single, pair, consecutive pairs, triple, full house, straight, bomb)
- **Comparison**: Given the current trick's combo, can a new combo beat it?
- **Game state machine**: Model the phases — deal → grand tichu window → pass → play → round end → scoring
- **Scoring**: Count card points, apply Tichu bonuses, detect 1-2 finish, check for game end at 1000
- **Tests**: Comprehensive unit tests for all combination types, special card behaviors, bomb interrupts, edge cases

### Phase 2: Server + Networking
Wire up the game engine to Socket.IO.

- **Room management**: Create room (get code), join room (enter code), seat assignment (N/E/S/W, partners across)
- **Socket events**:
  - `create-room` / `join-room` / `start-game`
  - `call-grand-tichu` / `call-tichu`
  - `pass-cards`
  - `play-cards` / `pass-turn`
  - `give-dragon-trick` (choose opponent)
  - `mah-jong-wish` (name a rank)
  - `bomb` (out-of-turn bomb play)
- **State sync**: On every state change, broadcast filtered view to each player (only their own hand visible)
- **Reconnection**: Allow players to reconnect to an in-progress game via room code + player ID stored in localStorage

### Phase 3: Client UI
Build the React frontend.

- **Lobby**: Simple create/join with room codes, show connected players, start when 4 are in
- **Game board layout**: Player's hand at bottom, partner at top, opponents left/right. Central play area.
- **Card rendering**: Simple styled divs or SVG cards showing rank + suit + special card art
- **Hand interaction**: Click to select cards, "Play" button validates and submits, "Pass" button for passing
- **Card passing phase**: Select 3 cards to pass (1 to each other player), confirm
- **Tichu buttons**: Grand Tichu prompt after first 8 cards, Small Tichu button available until first play
- **Special card UIs**: Mah Jong wish picker (dropdown of ranks), Dragon trick giveaway (pick opponent), Dog (auto-passes lead)
- **Scoreboard**: Persistent sidebar/header showing team scores, Tichu calls, and trick points
- **Turn indicator**: Highlight whose turn it is, show pass count

### Phase 4: Polish & Edge Cases
- Bomb out-of-turn: Prompt all players briefly after each play for bomb opportunities
- Phoenix value display: Show effective value contextually
- Mah Jong wish enforcement: Highlight when a player must play the wished rank
- End-of-round summary: Show point breakdown, Tichu results
- Responsive design: Works on desktop and tablet
- Sound effects / simple animations for card plays

---

## 6. Key Technical Decisions

| Decision | Choice | Notes |
|----------|--------|-------|
| Game state authority | Server-only | Clients send intents, server validates and broadcasts |
| Card identification | `{ suit, rank }` for normal; `{ special: 'dragon' }` for specials | Simple, serializable |
| Combo detection | Shared function used by both server (validation) and client (UI hints) | DRY logic |
| Bomb timing | After each play, server opens a brief "bomb window" for all players | Keeps it real-time and fair |
| Turn order | Counter-clockwise (right of leader), with pass tracking | Standard Tichu direction |
| Persistence | None for v1 (in-memory) | Could add Redis/DB later for game history |

---

## 7. Data Models (key types)

```typescript
type Suit = 'jade' | 'sword' | 'pagoda' | 'star';
type NormalRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // J=11,Q=12,K=13,A=14
type SpecialCard = 'mahjong' | 'dog' | 'phoenix' | 'dragon';

type Card =
  | { type: 'normal'; suit: Suit; rank: NormalRank }
  | { type: 'special'; name: SpecialCard };

type ComboType = 'single' | 'pair' | 'consecutivePairs' | 'triple'
              | 'fullHouse' | 'straight' | 'fourOfAKindBomb' | 'straightFlushBomb';

type Combo = {
  type: ComboType;
  cards: Card[];
  rank: number;       // primary rank for comparison
  length?: number;    // for straights and consecutive pairs
};

type Phase = 'waiting' | 'dealing' | 'grandTichuWindow' | 'passing'
           | 'playing' | 'roundEnd' | 'gameEnd';

type GameState = {
  phase: Phase;
  players: Player[];          // always 4, indexed by seat
  teams: [Team, Team];
  currentTrick: Combo | null;
  passCount: number;
  turnIndex: number;
  mahJongWish: NormalRank | null;
  roundScores: number[][];
  deck: Card[];
};
```

---

## 8. Milestones & Deliverables

1. **M1 — Game Logic**: `shared/` package with full combo detection, comparison, state machine, scoring. 100% unit-tested.
2. **M2 — Playable Server**: Socket.IO server that runs a full game. Testable via multiple browser tabs on localhost.
3. **M3 — Basic UI**: Functional (not pretty) UI where 4 browser tabs can play a complete game.
4. **M4 — Polished UI**: Styled cards, animations, responsive layout, sound. A genuinely pleasant experience.
