import { useState, useMemo } from 'react';
import { Card as CardType, cardId, identifyCombo, canBeat, isBomb, Seat, getTeamForSeat } from '@tichu/shared';
import type { NormalCard } from '@tichu/shared';
import type { useSocket } from '../hooks/useSocket.js';
import type { useAuth } from '../hooks/useAuth.js';
import Hand from '../components/Hand.js';
import { CardBack } from '../components/Card.js';
import PlayArea from '../components/PlayArea.js';
import ScoreBoard from '../components/ScoreBoard.js';
import GrandTichuPrompt from '../components/GrandTichuPrompt.js';
import PassCards from '../components/PassCards.js';
import MahJongWish from '../components/MahJongWish.js';
import DragonGiveaway from '../components/DragonGiveaway.js';
import RoundResults from '../components/RoundResults.js';

type Props = {
  socket: ReturnType<typeof useSocket>;
  auth: ReturnType<typeof useAuth>;
};

export default function Game({ socket, auth }: Props) {
  const { gameState, needMahJongWish, roundResult } = socket;
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  if (!gameState) return null;

  const {
    phase, players, mySeat, myHand, currentTrick, currentTrickCards,
    turnIndex, lastPlayedBy, teams,
  } = gameState;

  const isMyTurn = turnIndex === mySeat && phase === 'playing';
  const myPlayer = players[mySeat];
  const playerNames = players.map(p => p.name);

  // Arrange seats relative to current player: me (bottom), right, top (partner), left
  const relativeSeats = [
    mySeat,
    ((mySeat + 1) % 4) as Seat, // right
    ((mySeat + 2) % 4) as Seat, // top (partner)
    ((mySeat + 3) % 4) as Seat, // left
  ];

  const toggleCard = (card: CardType) => {
    const id = cardId(card);
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedCardList = myHand.filter(c => selectedCards.has(cardId(c)));

  const canPlay = useMemo(() => {
    if (!isMyTurn || selectedCardList.length === 0) return false;
    const combo = identifyCombo(selectedCardList);
    if (!combo) return false;
    if (currentTrick === null) return true; // leading
    return canBeat(currentTrick, combo);
  }, [isMyTurn, selectedCardList, currentTrick]);

  const canBombNow = useMemo(() => {
    if (phase !== 'playing' || selectedCardList.length < 4) return false;
    const combo = identifyCombo(selectedCardList);
    if (!combo || !isBomb(combo)) return false;
    if (currentTrick && !canBeat(currentTrick, combo)) return false;
    return true;
  }, [phase, selectedCardList, currentTrick]);

  // Detect if player has any bomb available in hand
  const hasBombInHand = useMemo(() => {
    if (phase !== 'playing') return false;
    const normalCards = myHand.filter((c): c is NormalCard => c.type === 'normal');
    // Check four-of-a-kind
    const byRank: Record<number, number> = {};
    for (const c of normalCards) {
      byRank[c.rank] = (byRank[c.rank] || 0) + 1;
    }
    if (Object.values(byRank).some(count => count >= 4)) return true;
    // Check straight flush (5+ same suit consecutive)
    const bySuit: Record<string, number[]> = {};
    for (const c of normalCards) {
      if (!bySuit[c.suit]) bySuit[c.suit] = [];
      bySuit[c.suit].push(c.rank);
    }
    for (const ranks of Object.values(bySuit)) {
      ranks.sort((a, b) => a - b);
      let consecutive = 1;
      for (let i = 1; i < ranks.length; i++) {
        if (ranks[i] === ranks[i - 1] + 1) {
          consecutive++;
          if (consecutive >= 5) return true;
        } else {
          consecutive = 1;
        }
      }
    }
    return false;
  }, [phase, myHand]);

  const handlePlay = () => {
    if (!canPlay) return;
    socket.playCards(selectedCardList);
    setSelectedCards(new Set());
  };

  const handleBomb = () => {
    if (!canBombNow) return;
    socket.bomb(selectedCardList);
    setSelectedCards(new Set());
  };

  const handlePass = () => {
    socket.passTurn();
    setSelectedCards(new Set());
  };

  // Grand Tichu phase
  if (phase === 'grandTichuWindow') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <ScoreBoard gameState={gameState} />
          <div className="mt-6">
            <GrandTichuPrompt
              cards={myHand}
              decided={myPlayer.grandTichuDecided}
              onDecide={socket.callGrandTichu}
            />
          </div>
        </div>
      </div>
    );
  }

  // Card passing phase
  if (phase === 'passing' && !myPlayer.passedCards) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <ScoreBoard gameState={gameState} />
          <div className="mt-6">
            <PassCards
              hand={myHand}
              mySeat={mySeat}
              playerNames={playerNames}
              onPass={socket.passCards}
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'passing' && myPlayer.passedCards) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <ScoreBoard gameState={gameState} />
          <p className="mt-6 text-gray-300">Waiting for other players to pass cards...</p>
        </div>
      </div>
    );
  }

  // Main game phase
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Modals */}
      {needMahJongWish && <MahJongWish onWish={socket.mahJongWish} />}
      {gameState.dragonGiveaway && gameState.dragonGiveawayBy === mySeat && (
        <DragonGiveaway
          mySeat={mySeat}
          players={[...players]}
          onGive={socket.giveDragonTrick}
        />
      )}
      {roundResult && (
        <RoundResults
          result={roundResult}
          players={[...players]}
          onNextRound={socket.nextRound}
          isGameOver={phase === 'gameEnd'}
        />
      )}

      {/* Top area: partner */}
      <div className="flex justify-center items-center p-3 gap-4">
        <OpponentInfo
          player={players[relativeSeats[2]]}
          isCurrentTurn={turnIndex === relativeSeats[2]}
          label="Partner"
        />
      </div>

      {/* Middle area: left opponent, play area, right opponent */}
      <div className="flex-1 flex items-center">
        {/* Left opponent */}
        <div className="w-32 flex flex-col items-center p-2">
          <OpponentInfo
            player={players[relativeSeats[3]]}
            isCurrentTurn={turnIndex === relativeSeats[3]}
            label="Left"
          />
        </div>

        {/* Center play area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <ScoreBoard gameState={gameState} />
          <div className="bg-felt/50 rounded-xl p-6 min-w-[300px] min-h-[150px] flex items-center justify-center">
            <PlayArea
              currentTrick={currentTrick}
              currentTrickCards={currentTrickCards}
              lastPlayedBy={lastPlayedBy}
              playerNames={playerNames}
            />
          </div>
          {isMyTurn && (
            <div className="text-yellow-400 font-bold animate-pulse">
              Your turn!
            </div>
          )}
        </div>

        {/* Right opponent */}
        <div className="w-32 flex flex-col items-center p-2">
          <OpponentInfo
            player={players[relativeSeats[1]]}
            isCurrentTurn={turnIndex === relativeSeats[1]}
            label="Right"
          />
        </div>
      </div>

      {/* Bottom area: player's hand and controls */}
      <div className="p-4 bg-gray-900/50">
        {/* Tichu call button */}
        {!myPlayer.hasPlayedFirstCard && myPlayer.tichuCall === 'none' && phase === 'playing' && (
          <div className="text-center mb-2">
            <button
              onClick={socket.callSmallTichu}
              className="py-1 px-4 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors"
            >
              Call Tichu!
            </button>
          </div>
        )}

        <Hand
          cards={myHand}
          selectedCards={selectedCards}
          onToggleCard={toggleCard}
          disabled={phase !== 'playing'}
        />
        <div className="text-center text-sm text-gray-400 mt-1">{myPlayer.name}</div>

        {/* Action buttons */}
        {phase === 'playing' && (
          <div className="flex justify-center gap-3 mt-3">
            {isMyTurn && (
              <>
                <button
                  onClick={handlePlay}
                  disabled={!canPlay}
                  className="py-2 px-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                >
                  Play
                </button>
                {currentTrick && (
                  <button
                    onClick={handlePass}
                    disabled={selectedCards.size > 0}
                    title={selectedCards.size > 0 ? 'Unselect cards to pass' : undefined}
                    className="py-2 px-6 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                  >
                    Pass
                  </button>
                )}
              </>
            )}
            {hasBombInHand && (
              <button
                onClick={handleBomb}
                disabled={!canBombNow}
                className="py-2 px-6 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                title={canBombNow ? 'Play bomb!' : 'Select your bomb cards'}
              >
                💣 Bomb
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OpponentInfo({
  player,
  isCurrentTurn,
  label,
}: {
  player: { name: string; cardCount: number; isOut: boolean; tichuCall: string; trickCount: number };
  isCurrentTurn: boolean;
  label: string;
}) {
  return (
    <div className={`text-center ${isCurrentTurn ? 'pulse-glow rounded-lg p-2' : 'p-2'}`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${isCurrentTurn ? 'text-yellow-400' : ''}`}>
        {player.name}
      </div>
      {player.tichuCall !== 'none' && (
        <div className={`text-xs ${player.tichuCall === 'grand' ? 'text-red-400' : 'text-orange-400'}`}>
          {player.tichuCall === 'grand' ? 'GRAND' : 'Tichu'}
        </div>
      )}
      <div className="mt-1">
        <CardBack count={player.cardCount} />
      </div>
      {player.trickCount > 0 && (
        <div className="text-xs text-gray-400 mt-1">{player.trickCount} tricks</div>
      )}
    </div>
  );
}
