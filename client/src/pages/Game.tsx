import { useState, useEffect, useMemo } from 'react';
import { Card as CardType, cardId, identifyCombo, canBeat, isBomb, Seat, getTeamForSeat, canPlayWishedRankFromHand, RANK_NAMES } from '@tichu/shared';
import type { NormalCard } from '@tichu/shared';
import type { useSocket } from '../hooks/useSocket.js';
import type { useAuth } from '../hooks/useAuth.js';
import Hand from '../components/Hand.js';
import CardComponent from '../components/Card.js';
import PlayArea from '../components/PlayArea.js';
import ScoreBoard from '../components/ScoreBoard.js';
import MahJongWish from '../components/MahJongWish.js';
import DragonGiveaway from '../components/DragonGiveaway.js';
import RoundResults from '../components/RoundResults.js';
import CardsSeen from '../components/CardsSeen.js';
import GameAnnouncements, { useGameEvents } from '../components/GameAnnouncement.js';
import OpponentInfo from '../components/OpponentInfo.js';
import GrandTichuPhase from '../components/GrandTichuPhase.js';
import PassingPhase from '../components/PassingPhase.js';
import type { PassRecord } from '../components/PassingPhase.js';

type Props = {
  socket: ReturnType<typeof useSocket>;
  auth: ReturnType<typeof useAuth>;
};

export default function Game({ socket, auth }: Props) {
  const { gameState, needMahJongWish, roundResult } = socket;
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [passRecord, setPassRecord] = useState<PassRecord | null>(null);
  const [bombMode, setBombMode] = useState(false);
  const gameEvents = useGameEvents(gameState, roundResult);

  // Reset card selection when phase changes (e.g., round end -> new round)
  const phase = gameState?.phase;
  useEffect(() => {
    setSelectedCards(new Set());
    setBombMode(false);
  }, [phase]);

  if (!gameState) return null;

  const {
    phase: _, players, mySeat, myHand, currentTrick, currentTrickCards,
    turnIndex, lastPlayedBy, teams,
  } = gameState;

  const isMyTurn = turnIndex === mySeat && phase === 'playing';
  const myPlayer = players[mySeat];
  const playerNames = players.map(p => p.name);
  const mustPlayWish = canPlayWishedRankFromHand(myHand, gameState.mahJongWish, currentTrick);

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

  const enterBombMode = () => {
    setBombMode(true);
    setSelectedCards(new Set());
    socket.bombAnnounce();
  };

  const cancelBombMode = () => {
    setBombMode(false);
    setSelectedCards(new Set());
    socket.bombCancel();
  };

  const confirmBomb = () => {
    if (!canBombNow) return;
    socket.bomb(selectedCardList);
    setSelectedCards(new Set());
    setBombMode(false);
  };

  const handlePassTurn = () => {
    socket.passTurn();
    setSelectedCards(new Set());
  };

  // Grand Tichu phase
  if (phase === 'grandTichuWindow') {
    return (
      <GrandTichuPhase
        gameState={gameState}
        cards={myHand}
        decided={myPlayer.grandTichuDecided}
        onDecide={socket.callGrandTichu}
        gameEvents={gameEvents}
      />
    );
  }

  // Card passing phase
  if (phase === 'passing') {
    const handlePassCards = (left: CardType, partner: CardType, right: CardType) => {
      const leftSeat = ((mySeat + 3) % 4) as Seat;
      const partnerSeat = ((mySeat + 2) % 4) as Seat;
      const rightSeat = ((mySeat + 1) % 4) as Seat;
      setPassRecord({
        left: { card: left, playerName: playerNames[leftSeat] },
        partner: { card: partner, playerName: playerNames[partnerSeat] },
        right: { card: right, playerName: playerNames[rightSeat] },
      });
      socket.passCards(left, partner, right);
    };

    return (
      <PassingPhase
        gameState={gameState}
        myHand={myHand}
        mySeat={mySeat}
        playerNames={playerNames}
        hasPassed={!!myPlayer.passedCards}
        playerName={myPlayer.name}
        passRecord={passRecord}
        onPass={handlePassCards}
        gameEvents={gameEvents}
      />
    );
  }

  // Main playing phase
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Announcements overlay */}
      <GameAnnouncements events={gameEvents} />

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
          showPoints={gameState.settings.countPoints}
          horizontal
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
            showPoints={gameState.settings.countPoints}
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
            showPoints={gameState.settings.countPoints}
          />
        </div>
      </div>

      {/* Bottom area: player's hand and controls */}
      <div className="p-4 bg-gray-900/50">
        {/* Passed cards display */}
        {gameState.settings.showPassedCards && passRecord && phase === 'playing' && (
          <div className="mb-2 max-w-lg mx-auto">
            <div className="flex justify-center items-end gap-4">
              <span className="text-xs text-gray-400">You passed:</span>
              {[passRecord.left, passRecord.partner, passRecord.right].map((p) => {
                const played = gameState.playedCards.some(c => cardId(c) === cardId(p.card));
                return (
                  <div key={p.playerName} className="text-center">
                    <div className="relative inline-block">
                      <CardComponent card={p.card} small />
                      {played && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-red-400/60 text-3xl font-bold leading-none">✕</span>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">to {p.playerName}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Received cards display — visible until first play */}
        {!myPlayer.hasPlayedFirstCard && phase === 'playing' && gameState.myReceivedCards.length > 0 && (
          <div className="mb-2 max-w-lg mx-auto">
            <div className="flex justify-center items-end gap-4">
              <span className="text-xs text-gray-400">You received:</span>
              {gameState.myReceivedCards.map((rc) => (
                <div key={`${rc.fromSeat}`} className="text-center">
                  <CardComponent card={rc.card} small />
                  <div className="text-[10px] text-gray-500 mt-0.5">from {playerNames[rc.fromSeat]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cards seen tracker */}
        {gameState.settings.cardsSeen && phase === 'playing' && (
          <div className="mb-2 max-w-lg mx-auto">
            <CardsSeen myHand={myHand} playedCards={gameState.playedCards} />
          </div>
        )}

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
        <div className="text-center text-sm text-gray-400 mt-1">
          {myPlayer.name}
          {gameState.settings.countPoints && myPlayer.trickCount > 0 && (
            <span className="ml-1 text-green-400">({myPlayer.capturedPoints}pts)</span>
          )}
        </div>

        {/* Bomb mode banner */}
        {gameState.bombWindow && !bombMode && (
          <div className="text-center text-red-400 font-bold animate-pulse mb-2">
            A player is considering a bomb...
          </div>
        )}

        {/* Action buttons */}
        {phase === 'playing' && !bombMode && (
          <div className="flex justify-center gap-3 mt-3">
            {isMyTurn && !gameState.bombWindow && (
              <>
                <button
                  onClick={handlePlay}
                  disabled={!canPlay}
                  className="py-2 px-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                >
                  Play
                </button>
                {currentTrick && !mustPlayWish && (
                  <button
                    onClick={handlePassTurn}
                    disabled={selectedCards.size > 0}
                    title={selectedCards.size > 0 ? 'Unselect cards to pass' : undefined}
                    className="py-2 px-6 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
                  >
                    Pass
                  </button>
                )}
                {currentTrick && mustPlayWish && gameState.mahJongWish && (
                  <div className="text-sm text-yellow-400 flex items-center px-4">
                    You must play a {RANK_NAMES[gameState.mahJongWish]}!
                  </div>
                )}
              </>
            )}
            {!isMyTurn && !gameState.bombWindow && (
              <div className="text-sm text-gray-400">
                Waiting for {playerNames[turnIndex]} to play...
              </div>
            )}
            {hasBombInHand && !gameState.bombWindow && (
              <button
                onClick={enterBombMode}
                className="py-2 px-6 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
              >
                Bomb!
              </button>
            )}
          </div>
        )}

        {/* Bomb selection mode */}
        {bombMode && (
          <div className="flex justify-center gap-3 mt-3">
            <div className="text-sm text-red-400 flex items-center">Select your bomb cards</div>
            <button
              onClick={confirmBomb}
              disabled={!canBombNow}
              className="py-2 px-6 bg-red-600 hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
            >
              Confirm Bomb
            </button>
            <button
              onClick={cancelBombMode}
              className="py-2 px-6 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
