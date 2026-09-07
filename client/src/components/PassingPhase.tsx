import type { Card as CardType, Seat, ClientGameState } from '@tichu/shared';
import { cardId } from '@tichu/shared';
import ScoreBoard from './ScoreBoard.js';
import SeatingDiagram from './SeatingDiagram.js';
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
  onUndoPass: () => void;
  gameEvents: GameEvent[];
};

export default function PassingPhase({
  gameState, myHand, mySeat, playerNames, hasPassed, playerName, passRecord, onPass, onUndoPass, gameEvents,
}: Props) {
  if (!hasPassed) {
    return (
      <>
        <GameAnnouncements events={gameEvents} />
        {/* h-full (not min-h-screen): sized by the FitToViewport scaler. m-auto
            centers while still allowing scroll if content overflows the box. */}
        <div className="h-full overflow-y-auto flex p-4">
          <div className="m-auto max-w-5xl w-full">
            <div className="flex items-start justify-center gap-4">
              <ScoreBoard gameState={gameState} />
              <SeatingDiagram gameState={gameState} />
            </div>
            <div className="mt-6">
              <PassCards
                hand={myHand}
                mySeat={mySeat}
                playerNames={playerNames}
                initialSelections={passRecord ? {
                  left: passRecord.left.card,
                  partner: passRecord.partner.card,
                  right: passRecord.right.card,
                } : undefined}
                onPass={onPass}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Passes are applied the moment the last player locks in, so an undo is
  // only possible while at least one other player is still choosing.
  const waiting = gameState.players
    .filter(p => p.seat !== gameState.mySeat && !p.passedCards)
    .map(p => p.name);
  const canUndo = waiting.length > 0;

  return (
    <>
      <GameAnnouncements events={gameEvents} />
      <div className="h-full overflow-y-auto flex p-4">
        <div className="m-auto max-w-5xl w-full text-center">
          <div className="flex items-start justify-center gap-4">
            <ScoreBoard gameState={gameState} />
            <SeatingDiagram gameState={gameState} />
          </div>
          <p className="mt-6 mb-4 text-gray-300 text-3xl">
            {waiting.length > 0
              ? `Waiting for ${waiting.join(', ')}...`
              : 'Waiting for other players to pass cards...'}
          </p>
          {passRecord && (
            <div className="flex justify-center gap-6 mb-4">
              {[passRecord.left, passRecord.partner, passRecord.right].map((p, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl text-gray-400 mb-1">To {p.playerName}</div>
                  <CardComponent card={p.card} large />
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
            large
          />
          <div className="text-center text-3xl text-gray-400 mt-1">{playerName}</div>
          {canUndo && (
            <button
              onClick={onUndoPass}
              className="mt-4 py-2 px-8 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold transition-colors"
            >
              Undo Pass
            </button>
          )}
        </div>
      </div>
    </>
  );
}
