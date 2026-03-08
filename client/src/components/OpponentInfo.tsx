import { CardBack } from './Card.js';

type Props = {
  player: { name: string; cardCount: number; isOut: boolean; tichuCall: string; trickCount: number; capturedPoints: number };
  isCurrentTurn: boolean;
  label: string;
  showPoints?: boolean;
  horizontal?: boolean;
};

export default function OpponentInfo({ player, isCurrentTurn, label, showPoints, horizontal }: Props) {
  return (
    <div className={`text-center ${isCurrentTurn ? 'pulse-glow rounded-lg p-2' : 'p-2'}`}>
      <div className="text-sm text-gray-400">{label}</div>
      <div className={`font-bold text-base ${isCurrentTurn ? 'text-yellow-400' : ''}`}>
        {player.name}
        {showPoints && player.trickCount > 0 && (
          <span className="ml-1 text-green-400 font-normal">({player.capturedPoints}pts)</span>
        )}
      </div>
      {player.tichuCall !== 'none' && (
        <div className={`text-sm ${player.tichuCall === 'grand' ? 'text-red-400' : 'text-orange-400'}`}>
          {player.tichuCall === 'grand' ? 'GRAND' : 'Tichu'}
        </div>
      )}
      <div className="mt-1">
        <CardBack count={player.cardCount} horizontal={horizontal} />
      </div>
      {player.trickCount > 0 && (
        <div className="text-sm text-gray-400 mt-1">{player.trickCount} tricks</div>
      )}
    </div>
  );
}
