import type { Card as CardType, Combo, TichuCall } from '@tichu/shared';
import SeatPlay from './SeatPlay.js';
import TichuBadge, { type TichuStatus } from './TichuBadge.js';

type Props = {
  player: { name: string; cardCount: number; isOut: boolean; tichuCall: TichuCall; trickCount: number; capturedPoints: number };
  isCurrentTurn: boolean;
  isMe?: boolean;
  label?: string;
  showPoints?: boolean;
  disconnected?: boolean;
  play: CardType[];
  isTopOfTrick: boolean;
  combo: Combo | null;
  tichuStatus?: TichuStatus;
  passed?: boolean;
};

/**
 * Compact panel showing a player's identity + their most recent play in the
 * current trick, side by side. Used for all four seats so the whole table fits
 * on one screen without scrolling.
 */
export default function PlayerPanel({
  player, isCurrentTurn, isMe, label, showPoints, disconnected, play, isTopOfTrick, combo, tichuStatus, passed,
}: Props) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl px-4 py-3 min-h-[140px] min-w-[440px] transition-shadow ${
        isCurrentTurn
          ? 'bg-black/45 ring-2 ring-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.4)]'
          : `bg-black/35 ring-1 ${isMe ? 'ring-sky-400/50' : 'ring-white/15'}`
      }`}
    >
      {/* Identity */}
      <div className="shrink-0 w-52 text-left">
        {label && <div className="text-3xl uppercase tracking-wide text-gray-200 font-semibold">{label}</div>}
        <div className="flex items-center gap-1 min-w-0">
          <span className={`font-bold text-4xl leading-tight truncate ${isCurrentTurn ? 'text-yellow-200' : 'text-white'}`}>
            {player.name}
          </span>
          <TichuBadge call={player.tichuCall} status={tichuStatus} />
        </div>
        {disconnected && (
          <div className="mt-0.5 inline-flex items-center gap-1 text-2xl font-semibold text-amber-300" title="Disconnected — waiting to reconnect">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Disconnected
          </div>
        )}
        <div className="flex items-center gap-3 text-3xl mt-1 font-semibold">
          {player.isOut ? (
            <span className="text-gray-200 italic">Out</span>
          ) : (
            <span className="text-gray-100" title="cards in hand">✋ {player.cardCount}</span>
          )}
          <span className="text-yellow-300" title="tricks won">⭐ {player.trickCount}</span>
          {showPoints && player.capturedPoints !== 0 && (
            <span className="text-green-300" title="card points captured">{player.capturedPoints}p</span>
          )}
        </div>
      </div>

      {/* Their last play this trick (plus a "Passed" tag if they passed — shown
          alongside any cards, never overwriting them) */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 min-w-[180px]">
        {play.length > 0 && (
          <SeatPlay cards={play} isTopOfTrick={isTopOfTrick} combo={combo} />
        )}
        {passed && (
          <span className="text-2xl font-semibold text-gray-300 bg-gray-700/70 rounded px-2 py-0.5 uppercase tracking-wide">
            Passed
          </span>
        )}
        {play.length === 0 && !passed && (
          <span className="text-gray-500 text-4xl leading-none">·</span>
        )}
      </div>
    </div>
  );
}
