import type { TichuCall } from '@tichu/shared';
import { CardBack } from './Card.js';
import TichuBadge from './TichuBadge.js';

type Props = {
  player: { name: string; cardCount: number; isOut: boolean; tichuCall: TichuCall; trickCount: number; capturedPoints: number };
  isCurrentTurn: boolean;
  label?: string;
  showPoints?: boolean;
  horizontal?: boolean;
  vertical?: boolean;
};

export default function OpponentInfo({ player, isCurrentTurn, label, showPoints, horizontal, vertical }: Props) {
  return (
    <div className={`text-center ${isCurrentTurn ? 'pulse-glow rounded-lg p-2' : 'p-2'}`}>
      {label && <div className="text-sm text-gray-400">{label}</div>}
      <div className={`font-bold text-base ${isCurrentTurn ? 'text-yellow-400' : ''}`}>
        {player.name}
        <TichuBadge call={player.tichuCall} />
        {player.cardCount > 0 && (
          <span className="ml-1 text-gray-300 font-normal">({player.cardCount})</span>
        )}
        {showPoints && player.trickCount > 0 && (
          <span className="ml-1 text-green-400 font-normal">({player.capturedPoints}pts)</span>
        )}
      </div>
      <div className="mt-1">
        <CardBack count={player.cardCount} horizontal={horizontal || vertical} rotated={vertical} />
      </div>
      {player.trickCount > 0 && (
        <div className="text-sm text-gray-400 mt-1">{player.trickCount} tricks</div>
      )}
    </div>
  );
}
