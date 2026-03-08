import type { Card as CardType, Seat, ClientGameState } from '@tichu/shared';
import { cardId } from '@tichu/shared';
import ScoreBoard from './ScoreBoard.js';
import PassCards from './PassCards.js';
import CardComponent from './Card.js';
import Hand from './Hand.js';
import GameAnnouncements from './GameAnnouncement.js';
import type { GameEvent } from './GameAnnouncement.js';

export type PassRecord = {
  left: { card: CardType; playerName: string };
  partner: { card: CardType; playerName: string };
  right: { card: CardType; playerName: string };
};

type Props = {
  gameState: ClientGameState;
  myHand: CardType[];
  mySeat: Seat;
  playerNames: string[];
  hasPassed: boolean;
  playerName: string;
  passRecord: PassRecord | null;
  onPass: (left: CardType, partner: CardType, right: CardType) => void;
  gameEvents: GameEvent[];
};

export default function PassingPhase({
  gameState, myHand, mySeat, playerNames, hasPassed, playerName, passRecord, onPass, gameEvents,
}: Props) {
  if (!hasPassed) {
    return (
      <>
        <GameAnnouncements events={gameEvents} />
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-3xl w-full">
            <ScoreBoard gameState={gameState} />
            <div className="mt-6">
              <PassCards
                hand={myHand}
                mySeat={mySeat}
                playerNames={playerNames}
                onPass={onPass}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <GameAnnouncements events={gameEvents} />
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-3xl w-full text-center">
          <ScoreBoard gameState={gameState} />
          <p className="mt-6 mb-4 text-gray-300 text-lg">
            {(() => {
              const waiting = gameState.players
                .filter(p => p.seat !== gameState.mySeat && !p.passedCards)
                .map(p => p.name);
              return waiting.length > 0
                ? `Waiting for ${waiting.join(', ')}...`
                : 'Waiting for other players to pass cards...';
            })()}
          </p>
          {passRecord && (
            <div className="flex justify-center gap-6 mb-4">
              {[passRecord.left, passRecord.partner, passRecord.right].map((p) => (
                <div key={p.playerName} className="text-center">
                  <div className="text-sm text-gray-400 mb-1">To {p.playerName}</div>
                  <CardComponent card={p.card} small />
                </div>
              ))}
            </div>
          )}
          <Hand
            cards={passRecord
              ? myHand.filter(c => {
                  const id = cardId(c);
                  return id !== cardId(passRecord.left.card) &&
                    id !== cardId(passRecord.partner.card) &&
                    id !== cardId(passRecord.right.card);
                })
              : myHand}
            selectedCards={new Set()}
            onToggleCard={() => {}}
            disabled
          />
          <div className="text-center text-base text-gray-400 mt-1">{playerName}</div>
        </div>
      </div>
    </>
  );
}
