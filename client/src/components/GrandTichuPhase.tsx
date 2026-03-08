import type { Card as CardType, ClientGameState } from '@tichu/shared';
import ScoreBoard from './ScoreBoard.js';
import GrandTichuPrompt from './GrandTichuPrompt.js';
import GameAnnouncements from './GameAnnouncement.js';
import type { GameEvent } from './GameAnnouncement.js';

type Props = {
  gameState: ClientGameState;
  cards: CardType[];
  decided: boolean;
  onDecide: (call: boolean) => void;
  gameEvents: GameEvent[];
};

export default function GrandTichuPhase({ gameState, cards, decided, onDecide, gameEvents }: Props) {
  return (
    <>
      <GameAnnouncements events={gameEvents} />
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <ScoreBoard gameState={gameState} />
          <div className="mt-6">
            <GrandTichuPrompt
              cards={cards}
              decided={decided}
              onDecide={onDecide}
              otherCallers={gameState.players
                .filter(p => p.seat !== gameState.mySeat && p.tichuCall === 'grand')
                .map(p => p.name)}
              waitingOn={gameState.players
                .filter(p => p.seat !== gameState.mySeat && !p.grandTichuDecided)
                .map(p => p.name)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
