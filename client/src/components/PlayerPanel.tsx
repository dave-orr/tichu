import type { Card as CardType, Combo, TichuCall } from '@tichu/shared';
import SeatPlay from './SeatPlay.js';
import TichuBadge from './TichuBadge.js';

type Props = {
  player: { name: string; cardCount: number; isOut: boolean; tichuCall: TichuCall; trickCount: number; capturedPoints: number };
  isCurrentTurn: boolean;
  isMe?: boolean;
  label?: string;
  showPoints?: boolean;
  play: CardType[];
  isTopOfTrick: boolean;
  combo: Combo | null;
};

/**
 * Compact panel showing a player's identity + their most recent play in the
 * current trick, side by side. Used for all four seats so the whole table fits
 * on one screen without scrolling.
 */
export default function PlayerPanel({
  player, isCurrentTurn, isMe, label, showPoints, play, isTopOfTrick, combo,
}: Props) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-3 py-2 min-h-[112px] min-w-[260px] transition-shadow ${
        isCurrentTurn
          ? 'bg-black/30 ring-2 ring-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.4)]'
          : `bg-black/20 ring-1 ${isMe ? 'ring-sky-400/40' : 'ring-white/10'}`
      }`}
    >
      {/* Identity */}
      <div className="shrink-0 w-24 text-left">
        {label && <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>}
        <div className={`font-bold leading-tight truncate ${isCurrentTurn ? 'text-yellow-300' : 'text-gray-100'}`}>
          {player.name}
          <TichuBadge call={player.tichuCall} />
        </div>
        <div className="flex items-center gap-2 text-sm mt-0.5">
          {player.isOut ? (
            <span className="text-gray-400 italic">Out</span>
          ) : (
            <span className="text-gray-300" title="cards in hand">✋ {player.cardCount}</span>
          )}
          <span className="text-yellow-400/90" title="tricks won">⭐ {player.trickCount}</span>
          {showPoints && player.capturedPoints !== 0 && (
            <span className="text-green-400" title="card points captured">{player.capturedPoints}p</span>
          )}
        </div>
      </div>

      {/* Their last play this trick */}
      <div className="flex-1 flex items-center justify-center">
        {play.length > 0 ? (
          <SeatPlay cards={play} isTopOfTrick={isTopOfTrick} combo={combo} />
        ) : (
          <span className="text-gray-600 text-2xl leading-none">·</span>
        )}
      </div>
    </div>
  );
}
