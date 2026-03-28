# Tichu AI Player API

HTTP + Server-Sent Events API for external AI players to join and play Tichu games.

**Base URL**: `http://localhost:3000/api` (or wherever the server runs)

## Overview

A human organizer creates a room via the web UI and marks one or more empty seats as "Open for AI." Your AI then:

1. **Joins** a room (direct or matchmaking)
2. **Opens an SSE stream** to receive real-time game state
3. **Posts actions** in response to state changes

Authentication is room code + seat number only. No API keys or tokens needed.

## Quick Start

```python
import requests, json, sseclient

BASE = "http://localhost:3000/api"

# 1. Join any room that wants a bot
resp = requests.post(f"{BASE}/join", json={"name": "MyBot"})
info = resp.json()  # {"seat": 2, "roomCode": "WXYZ"}
room, seat = info["roomCode"], info["seat"]

# 2. Open SSE stream
stream = sseclient.SSEClient(f"{BASE}/rooms/{room}/stream?seat={seat}")

# 3. React to game state
for event in stream.events():
    if event.event == "game-state":
        state = json.loads(event.data)
        action = decide(state, seat)
        if action:
            requests.post(f"{BASE}/rooms/{room}/action",
                          json={"seat": seat, "action": action})
```

---

## Endpoints

### POST /api/join

**Matchmaking**: find any room with an open AI seat and join it.

```
Request:  {"name": "MyBot"}
Response: {"seat": 2, "roomCode": "WXYZ"}
```

**Errors**:
- `404` `{"error": "No rooms with open AI seats"}` — no organizer has opened a seat
- `400` `{"error": "Invalid name"}` — name must be a non-empty string, max 20 chars

### POST /api/rooms/:code/join

Join a specific room by room code. Optionally request a specific seat.

```
Request:  {"name": "MyBot"}              — picks first available AI-open seat
Request:  {"name": "MyBot", "seat": 1}   — requests seat 1 specifically
Response: {"seat": 1, "roomCode": "ABCD"}
```

**Errors**:
- `404` `{"error": "Room not found"}`
- `400` `{"error": "No open AI seats"}` — room exists but no seats marked for AI
- `400` `{"error": "Game already in progress"}` — can only join during waiting phase

### POST /api/rooms/:code/leave

Leave the room. Only works during the waiting phase.

```
Request:  {"seat": 1}
Response: {"ok": true}
```

### GET /api/rooms/:code/stream?seat=N

Server-Sent Events stream. You **must** join first before opening the stream.

The stream sends events as they happen:

```
event: game-state
data: <ClientGameState JSON>

event: round-result
data: {"teamScores": [120, -20], "tichuBonuses": [0, 0], ...}

event: need-mah-jong-wish
data: {}

event: need-dragon-choice
data: {}
```

**Connection lifecycle**:
- First event is always a `game-state` with the current state
- Stream stays open until you close it or the game ends
- If the stream disconnects, reconnect by opening a new one
- The server replaces any previous stream for the same seat

### POST /api/rooms/:code/action

Submit a game action. See [Actions Reference](#actions-reference) below.

```
Request:  {"seat": 1, "action": {"type": "play-cards", "cards": [...]}}
Response: {"ok": true}
```

**Errors**:
- `403` `{"error": "Seat is not an API player"}` — you don't own this seat
- `400` `{"error": "..."}` — invalid action or bad data

---

## Game State (what you receive)

Every `game-state` SSE event contains a `ClientGameState` object. This is the same view human players see — you can see your own hand but not others'.

### Key Fields

```typescript
{
  phase: "waiting" | "grandTichuWindow" | "passing" | "playing" | "roundEnd" | "gameEnd",
  myHand: Card[],           // YOUR cards (only yours)
  mySeat: 0 | 1 | 2 | 3,   // your seat index
  turnIndex: 0 | 1 | 2 | 3, // whose turn it is right now
  currentTrick: Combo | null, // the current combo to beat (null = you're leading)
  currentTrickCards: Card[][], // all plays in the current trick (for display)
  passCount: number,         // consecutive passes in current trick
  lastPlayedBy: 0 | 1 | 2 | 3 | null, // who played the current combo
  mahJongWish: 2..14 | null, // active wish rank (null = no wish)
  mahJongWishPending: boolean, // true = mah jong was played, waiting for wish selection (game blocked)
  dragonGiveaway: boolean,   // true = someone must give dragon trick to opponent
  dragonGiveawayBy: 0 | 1 | 2 | 3 | null, // who must choose
  bombWindow: boolean,       // true = bomb window is open
  outCount: number,          // how many players have gone out
  roundNumber: number,
  myReceivedCards: [{card: Card, fromSeat: number}, ...], // cards received from passing

  players: [                 // all 4 players (indexed by seat 0-3)
    {
      name: string,
      seat: 0 | 1 | 2 | 3,
      cardCount: number,       // how many cards they hold (you can't see what they are)
      trickCount: number,      // how many tricks they've won
      capturedPoints: number,  // sum of card point values in their tricks
      tichuCall: "none" | "small" | "grand",
      hasPlayedFirstCard: boolean,
      isOut: boolean,
      outOrder: number,        // 0 = not out, 1 = first out, 2 = second, etc.
      grandTichuDecided: boolean,
      passedCards: boolean,    // has submitted pass selection
      isAi: boolean,
    },
    ...
  ],

  teams: [
    {players: [0, 2], score: number},  // Team 0: seats 0 & 2
    {players: [1, 3], score: number},  // Team 1: seats 1 & 3
  ],

  settings: {
    clockwise: boolean,       // play direction
    targetScore: number,      // score to win (default 1000)
    countPoints: boolean,
    cardsSeen: boolean,
    showPassedCards: boolean,
  },

  playedCards: Card[],        // all cards played/discarded this round
  roundHistory: [...],        // past round scores
  trickCountdown: {winner: Seat, expiresAt: number} | null,
  roundEndReady: Seat[],      // seats that acknowledged round end
}
```

### Teams and Seating

```
Seat 0 (North)  &  Seat 2 (South)  = Team 0
Seat 1 (East)   &  Seat 3 (West)   = Team 1
```

Your partner is always `(yourSeat + 2) % 4`.

### Play Direction

If `settings.clockwise` is `false` (default, counterclockwise): turn passes to the **right** neighbor.
- From seat 0: next is seat 1, then 2, then 3.
If `settings.clockwise` is `true`: turn passes to the **left** neighbor.
- From seat 0: next is seat 3, then 2, then 1.

---

## Card Format

There are two types of cards: normal and special.

### Normal Cards

```json
{"type": "normal", "suit": "jade", "rank": 7}
```

- **suit**: `"jade"` | `"sword"` | `"pagoda"` | `"star"`
- **rank**: `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9` | `10` | `11` (J) | `12` (Q) | `13` (K) | `14` (A)

### Special Cards

```json
{"type": "special", "name": "dragon"}
```

- **name**: `"mahjong"` | `"dog"` | `"phoenix"` | `"dragon"`

### The Deck

56 cards total:
- 52 normal cards: 4 suits x 13 ranks (2 through Ace)
- 4 special cards: Mah Jong, Dog, Phoenix, Dragon

### Card Point Values

| Card | Points |
|------|--------|
| 5s | 5 |
| 10s | 10 |
| Kings (13) | 10 |
| Dragon | 25 |
| Phoenix | -25 |
| Everything else | 0 |

Total points in the deck: 100.

---

## Valid Combinations

When playing cards, they must form a valid combination:

| Combo | Example | Rules |
|-------|---------|-------|
| **Single** | Any one card | Mah Jong (rank 1), Dragon (rank 15), Phoenix (0.5 above last played) |
| **Pair** | Two cards same rank | Phoenix can substitute for any rank |
| **Triple** | Three cards same rank | Phoenix can substitute |
| **Full House** | Triple + Pair | Phoenix can be in either part |
| **Straight** | 5+ consecutive ranks | Mah Jong counts as rank 1. Phoenix substitutes for one card. No 2-wrapping (A is high only). |
| **Consecutive Pairs** | 2+ adjacent pairs | e.g., 3-3-4-4 or 5-5-6-6-7-7. Phoenix can substitute. |
| **4-of-a-Kind Bomb** | Four cards same rank | Cannot include Phoenix. Beats any non-bomb. |
| **Straight Flush Bomb** | 5+ consecutive same suit | Cannot include Phoenix or special cards. Beats 4-of-a-kind bombs and shorter straight flushes. |

### Leading vs Following

- **Leading** (currentTrick is null): you may play any valid combination.
- **Following** (currentTrick is not null): you must play the **same combo type** with a **higher rank**, and the **same length** (for straights/consecutive pairs). Or you can play a bomb.
- **Passing**: always allowed unless the Mah Jong wish forces you to play (see below).

### Special Card Rules

- **Mah Jong**: When you play it (as a single or in a straight), you must declare a wish rank (2-14). The `need-mah-jong-wish` SSE event prompts you.
- **Dog**: Can only be played as a lead (not following). Passes the lead to your partner (or next active player if partner is out). Played alone.
- **Phoenix**: Acts as a wild card in combos. As a single, it beats the current single by 0.5 rank. Cannot form a bomb.
- **Dragon**: Can only be played as a single. Beats everything. If Dragon wins the trick, you must give the trick to an opponent (`give-dragon-trick` action).

### Mah Jong Wish

When the Mah Jong wish is active (`state.mahJongWish` is not null), the current player **must** play a card of the wished rank if they have one and can legally play it in the current trick type. If they can't legally play it, they may play anything or pass normally. The wish is fulfilled (cleared) when someone plays the wished rank.

---

## Actions Reference

All actions are submitted via `POST /api/rooms/:code/action` with body:
```json
{"seat": <your_seat>, "action": <action_object>}
```

### Phase: grandTichuWindow

You see your first 8 cards in `myHand`. Decide whether to call Grand Tichu (200 point bet that you'll go out first).

```json
{"type": "call-grand-tichu", "call": false}
```

- `call`: `true` to call Grand Tichu, `false` to pass.
- You **must** respond — the game waits for all 4 players to decide.
- After all 4 players decide, the remaining 6 cards are dealt (you'll get a new `game-state` with 14 cards).

### Phase: passing

Select 3 cards from your hand to pass: one to the left player, one to your partner, one to the right player.

```json
{
  "type": "pass-cards",
  "left": {"type": "normal", "suit": "jade", "rank": 3},
  "partner": {"type": "normal", "suit": "star", "rank": 5},
  "right": {"type": "special", "name": "phoenix"}
}
```

- All 3 cards must be in your hand and must be distinct.
- "Left" = seat `(yourSeat + 3) % 4`, "Partner" = seat `(yourSeat + 2) % 4`, "Right" = seat `(yourSeat + 1) % 4`. (These directions assume default counterclockwise play. If clockwise, left and right are swapped in the UI but the API fields stay the same: `left`/`partner`/`right` always map to +3/+2/+1.)
- After all 4 players pass, cards are exchanged and you get `myReceivedCards` showing what you received.

### Phase: playing

This is the main game loop. Check `state.turnIndex === mySeat` to know if it's your turn.

#### Play cards

```json
{"type": "play-cards", "cards": [{"type": "normal", "suit": "jade", "rank": 7}]}
```

- Cards must form a valid combination (see [Valid Combinations](#valid-combinations)).
- If following (currentTrick is not null), must beat it.
- If leading (currentTrick is null), can play anything.

#### Pass turn

```json
{"type": "pass-turn"}
```

- Can only pass when there's a current trick (can't pass when leading).
- Cannot pass if you hold the wished rank and can legally play it.

#### Call Small Tichu

```json
{"type": "call-small-tichu"}
```

- Can only be called **before your first card is played** (`players[mySeat].hasPlayedFirstCard === false`).
- 100 point bet that you'll go out first.
- Optional — you can skip this entirely.

#### Bomb (out of turn)

```json
{"type": "bomb", "cards": [
  {"type": "normal", "suit": "jade", "rank": 9},
  {"type": "normal", "suit": "sword", "rank": 9},
  {"type": "normal", "suit": "pagoda", "rank": 9},
  {"type": "normal", "suit": "star", "rank": 9}
]}
```

- Bombs can be played **at any time** during the playing phase, even when it's not your turn.
- Must be a valid bomb (4-of-a-kind or straight flush of 5+).
- Must beat the current trick (if there is one).
- After bombing, you become the trick leader.

#### Give Dragon Trick

When you win a trick that contains the Dragon, you must give the trick to an opponent.

```json
{"type": "give-dragon-trick", "to": 1}
```

- `to` must be an opponent seat (not your team).
- You'll know you need to do this when `state.dragonGiveaway === true` and `state.dragonGiveawayBy === mySeat`.
- You'll also receive a `need-dragon-choice` SSE event.

#### Mah Jong Wish

When you play the Mah Jong card, you may declare a wish rank (or decline).

```json
{"type": "mah-jong-wish", "rank": 8}
{"type": "mah-jong-wish", "rank": null}
```

- `rank`: integer 2-14 (2 through Ace), or `null` to decline (no wish).
- You'll know you need to do this when `state.mahJongWishPending === true` and `state.lastPlayedBy === mySeat`, or when you receive a `need-mah-jong-wish` SSE event.
- **The game is blocked until you respond** -- no other player can play or pass while `mahJongWishPending` is true.

#### Concede

If your partner has already gone out, you can concede (forfeit your remaining cards).

```json
{"type": "concede"}
```

- Only valid when your partner is out (`players[partnerSeat].isOut === true`).
- Your remaining hand cards go to the opposing team.

### Phase: roundEnd / gameEnd

After a round ends, all 4 players must acknowledge before the next round starts.

```json
{"type": "next-round"}
```

- You'll receive a `round-result` SSE event with the scoring details.
- Send `next-round` to acknowledge. The game waits for all 4 players.
- At `gameEnd`, send `next-round` as well (it acknowledges the final results).

---

## Decision Flowchart

When you receive a `game-state` event, determine what to do:

```
Is phase "grandTichuWindow"?
  → Is players[mySeat].grandTichuDecided false?
    → Send call-grand-tichu

Is phase "passing"?
  → Is players[mySeat].passedCards false?
    → Send pass-cards

Is phase "playing"?
  → Is mahJongWishPending true AND lastPlayedBy === mySeat?
    → Send mah-jong-wish (rank 2-14, or null to decline)
  → Is dragonGiveaway true AND dragonGiveawayBy === mySeat?
    → Send give-dragon-trick
  → Is turnIndex === mySeat?
    → (Optional) Send call-small-tichu if !hasPlayedFirstCard and you want to bet
    → Send play-cards or pass-turn

Is phase "roundEnd" or "gameEnd"?
  → Is mySeat NOT in roundEndReady?
    → Send next-round
```

### Timing

- You can respond to state changes immediately — no delay required.
- The server validates all actions against the current state. Invalid actions return an error but don't break anything.
- During trick countdown (`trickCountdown` is not null), there's a ~2 second window before the trick is awarded. You can bomb during this window.

---

## Scoring Rules

- **Normal round**: 100 points are distributed between teams based on tricks won. Last player's tricks go to the first-out player's team. Last player's remaining hand cards go to the opposing team.
- **Double victory (1-2 finish)**: If both players on the same team go out first and second, that team gets 200 points and the other gets 0.
- **Grand Tichu**: +200 if you go out first, -200 if you don't.
- **Small Tichu**: +100 if you go out first, -100 if you don't.
- **Game ends** when a team reaches `settings.targetScore` (default 1000) and the scores are not tied.

---

## Error Handling

- Invalid actions return `{"error": "..."}` with a 400 status. The game state is unchanged.
- If the server doesn't recognize the room, you get a 404.
- If you try to act on a seat you don't own, you get a 403.
- The SSE stream may close unexpectedly (server restart, network issue). Reconnect by opening a new stream. If the room is gone, the endpoint will return 404.

---

## Example: Minimal Working Bot

```python
import requests, json, sseclient

BASE = "http://localhost:3000/api"

def join():
    """Join any available room."""
    r = requests.post(f"{BASE}/join", json={"name": "SimpleBot"})
    r.raise_for_status()
    return r.json()  # {"seat": N, "roomCode": "XXXX"}

def act(room, seat, action):
    """Submit an action."""
    r = requests.post(f"{BASE}/rooms/{room}/action",
                      json={"seat": seat, "action": action})
    if not r.ok:
        print(f"Action failed: {r.json()}")

def pick_lowest_cards(hand, n):
    """Pick n lowest-ranked cards from hand."""
    def rank(c):
        if c["type"] == "special":
            return {"mahjong": 1, "dog": 0, "phoenix": 16, "dragon": 17}[c["name"]]
        return c["rank"]
    return sorted(hand, key=rank)[:n]

def find_single(hand, current_trick):
    """Find a single card that beats the current trick."""
    if current_trick is None:
        # Leading: play lowest card
        return pick_lowest_cards(hand, 1)
    # Following: find lowest card that beats current rank
    target_rank = current_trick["rank"]
    for card in sorted(hand, key=lambda c: c.get("rank", 0)):
        if card["type"] == "normal" and card["rank"] > target_rank:
            return [card]
        if card["type"] == "special" and card["name"] == "dragon":
            return [card]
    return None  # can't beat, must pass

def run():
    info = join()
    room, seat = info["roomCode"], info["seat"]
    print(f"Joined room {room} at seat {seat}")

    stream = sseclient.SSEClient(f"{BASE}/rooms/{room}/stream?seat={seat}")

    for event in stream.events():
        if event.event == "game-state":
            state = json.loads(event.data)
            phase = state["phase"]
            me = state["players"][seat]
            hand = state["myHand"]

            if phase == "grandTichuWindow" and not me["grandTichuDecided"]:
                act(room, seat, {"type": "call-grand-tichu", "call": False})

            elif phase == "passing" and not me["passedCards"]:
                lowest = pick_lowest_cards(hand, 3)
                act(room, seat, {
                    "type": "pass-cards",
                    "left": lowest[0], "partner": lowest[1], "right": lowest[2]
                })

            elif phase == "playing":
                if state.get("dragonGiveaway") and state.get("dragonGiveawayBy") == seat:
                    # Give to opponent with fewer points
                    opp1 = (seat + 1) % 4
                    opp2 = (seat + 3) % 4
                    target = opp1 if state["players"][opp1]["capturedPoints"] <= state["players"][opp2]["capturedPoints"] else opp2
                    act(room, seat, {"type": "give-dragon-trick", "to": target})

                elif state["turnIndex"] == seat:
                    current = state["currentTrick"]
                    if current is None:
                        # Leading: play lowest single
                        cards = pick_lowest_cards(hand, 1)
                        act(room, seat, {"type": "play-cards", "cards": cards})
                    else:
                        playable = find_single(hand, current)
                        if playable:
                            act(room, seat, {"type": "play-cards", "cards": playable})
                        else:
                            act(room, seat, {"type": "pass-turn"})

            elif phase in ("roundEnd", "gameEnd"):
                if seat not in state.get("roundEndReady", []):
                    act(room, seat, {"type": "next-round"})

        elif event.event == "need-mah-jong-wish":
            act(room, seat, {"type": "mah-jong-wish", "rank": 8})

if __name__ == "__main__":
    run()
```

> **Note**: This minimal bot only plays singles. A real bot needs to handle pairs, straights, full houses, bombs, etc. The `currentTrick.type` and `currentTrick.length` fields tell you what combo type and size you need to match.
