import { useState, useEffect, useRef, useMemo } from 'react';
import type { ClientGameState, RoundResult, Card, Combo } from '@tichu/shared';
import { RANK_NAMES, NormalRank, SUIT_SYMBOLS, SPECIAL_NAMES, cardId } from '@tichu/shared';

export type LogEntry = {
  id: number;
  text: string;
  timestamp: number;
};

function comboName(combo: Combo): string {
  switch (combo.type) {
    case 'single': return 'Single';
    case 'pair': return 'Pair';
    case 'triple': return 'Triple';
    case 'fullHouse': return 'Full House';
    case 'straight': return `${combo.length}-card Straight`;
    case 'consecutivePairs': return `${combo.length / 2} Cons. Pairs`;
    case 'fourOfAKindBomb': return 'Four-of-a-Kind Bomb';
    case 'straightFlushBomb': return `${combo.length}-card SF Bomb`;
    default: return combo.type;
  }
}

function describeCards(cards: Card[]): string {
  return cards.map(c => {
    if (c.type === 'special') return SPECIAL_NAMES[c.name];
    return `${RANK_NAMES[c.rank]}${SUIT_SYMBOLS[c.suit]}`;
  }).join(' ');
}

export function useEventLog(
  gameState: ClientGameState | null,
  roundResult: RoundResult | null,
  autoSkippedSeat?: number | null,
): LogEntry[] {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const prevRef = useRef<ClientGameState | null>(null);
  const prevRoundRef = useRef<RoundResult | null>(null);
  const prevAutoSkipRef = useRef<number | null>(null);
  const nextId = useRef(0);

  // Reset log on new round
  const roundNumber = gameState?.roundNumber;
  useEffect(() => {
    setEntries([]);
    nextId.current = 0;
  }, [roundNumber]);

  useEffect(() => {
    if (!gameState) return;
    const prev = prevRef.current;
    const newEntries: string[] = [];
    const names = gameState.players.map(p => p.name);

    if (prev && prev.phase === 'playing' && gameState.phase === 'playing') {
      // Tichu / Grand Tichu calls
      for (let i = 0; i < 4; i++) {
        if (prev.players[i].tichuCall === 'none' && gameState.players[i].tichuCall === 'small') {
          newEntries.push(`${names[i]} called Tichu!`);
        }
        if (prev.players[i].tichuCall === 'none' && gameState.players[i].tichuCall === 'grand') {
          newEntries.push(`${names[i]} called Grand Tichu!`);
        }
      }

      // Cards played
      if (gameState.currentTrickCards.length > prev.currentTrickCards.length) {
        const newPlay = gameState.currentTrickCards[gameState.currentTrickCards.length - 1];
        const isDog = newPlay.length === 1 && newPlay[0].type === 'special' && newPlay[0].name === 'dog';
        if (isDog) {
          const playerIdx = prev.turnIndex;
          newEntries.push(`${names[playerIdx]} played Dog → pass to partner`);
        } else if (gameState.lastPlayedBy !== null && gameState.currentTrick) {
          const playerName = names[gameState.lastPlayedBy];
          const combo = gameState.currentTrick;
          newEntries.push(`${playerName} played ${comboName(combo)}: ${describeCards(newPlay)}`);
        }
      }

      // Trick won (currentTrickCards went from non-empty to empty)
      if (prev.currentTrickCards.length > 0 && gameState.currentTrickCards.length === 0) {
        // Someone won the trick. The new leader is turnIndex.
        // But if dragon giveaway just happened, check for that
        if (prev.dragonGiveaway && !gameState.dragonGiveaway) {
          // Dragon was given away — we'll log that below
        } else {
          const winner = gameState.turnIndex;
          newEntries.push(`${names[winner]} won the trick`);
        }
      }

      // Pass count changes (someone passed their turn)
      if (gameState.passCount > prev.passCount && gameState.currentTrickCards.length === prev.currentTrickCards.length) {
        const passer = prev.turnIndex;
        newEntries.push(`${names[passer]} passed`);
      }

      // Dragon giveaway completed
      if (prev.dragonGiveaway && !gameState.dragonGiveaway && prev.dragonGiveawayBy !== null) {
        const giver = names[prev.dragonGiveawayBy];
        // Figure out who received: the new trick winner
        const receiver = gameState.turnIndex;
        newEntries.push(`${giver} gave the Dragon trick to ${names[receiver]}`);
      }

      // Mah Jong wish set
      if (prev.mahJongWish === null && gameState.mahJongWish !== null) {
        newEntries.push(`Wish set for ${RANK_NAMES[gameState.mahJongWish]}`);
      }

      // Wish fulfilled
      if (prev.mahJongWish !== null && gameState.mahJongWish === null) {
        newEntries.push(`Wish for ${RANK_NAMES[prev.mahJongWish]} fulfilled!`);
      }

      // Player going out
      for (let i = 0; i < 4; i++) {
        if (prev.players[i].outOrder === 0 && gameState.players[i].outOrder > 0) {
          newEntries.push(`${names[i]} is out (#${gameState.players[i].outOrder})`);
        }
      }
    }

    // Round result
    if (roundResult && roundResult !== prevRoundRef.current && gameState) {
      if (roundResult.isDoubleVictory) {
        newEntries.push(`Double victory! Team ${(roundResult.doubleVictoryTeam ?? 0) + 1} wins the round`);
      }
      newEntries.push(`Round score: ${roundResult.teamScores[0]}–${roundResult.teamScores[1]}`);
    }

    // Auto-skip
    if (autoSkippedSeat != null && autoSkippedSeat !== prevAutoSkipRef.current && gameState) {
      const skipName = gameState.players[autoSkippedSeat].name;
      newEntries.push(`${skipName}'s turn auto-skipped (not enough cards)`);
    }
    prevAutoSkipRef.current = autoSkippedSeat ?? null;

    prevRef.current = gameState;
    prevRoundRef.current = roundResult;

    if (newEntries.length > 0) {
      const now = Date.now();
      const withIds = newEntries.map(text => ({
        id: nextId.current++,
        text,
        timestamp: now,
      }));
      setEntries(prev => [...prev, ...withIds]);
    }
  }, [gameState, roundResult, autoSkippedSeat]);

  return entries;
}

export default function EventLog({ entries }: { entries: LogEntry[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 bg-gray-800/90 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 text-xs shadow-lg transition-colors"
      >
        Log {entries.length > 0 && <span className="ml-1 text-yellow-400">({entries.length})</span>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 max-h-64 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
        <span className="text-xs font-bold text-gray-300">Game Log</span>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-300 text-sm leading-none"
        >
          ✕
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {entries.length === 0 && (
          <div className="text-xs text-gray-500 italic">No events yet</div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="text-xs text-gray-300 leading-relaxed">
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
