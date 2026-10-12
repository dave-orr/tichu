import type { CSSProperties } from 'react';
import type { Card as CardType, Combo, TichuCall } from '@tichu/shared';
import { cardId } from '@tichu/shared';
import SeatPlay from './SeatPlay.js';
import { cardArt, useTheme } from '../theme.js';
import TichuBadge, { type TichuStatus } from './TichuBadge.js';
import { SeatBubbles, seatGlow, type GameEvent } from './GameAnnouncement.js';

type Props = {
  player: { name: string; cardCount: number; isOut: boolean; tichuCall: TichuCall; trickCount: number; capturedPoints: number };
  isCurrentTurn: boolean;
  label?: string;
  showPoints?: boolean;
  disconnected?: boolean;
  play: CardType[];
  isTopOfTrick: boolean;
  combo: Combo | null;
  tichuStatus?: TichuStatus;
  passed?: boolean;
  /** Reverse the identity/play layout so the play grows toward the table
   *  center instead of the screen edge (used for the right-hand opponent, whose
   *  large plays would otherwise clip off the right side of the screen). */
  mirror?: boolean;
  /** When set, the play is a just-cleared trick sweeping toward the winner:
   *  animate it flying by this (x, y) offset while fading out. */
  sweepOffset?: { x: number; y: number } | null;
  /** Seat number, exposed as data-seat-panel so overlays can find the panel. */
  seat: number;
  /** Live announcements about this player, shown as bubbles on the panel. */
  announcements?: GameEvent[];
  bubbleSide?: 'above' | 'below' | 'left' | 'right';
};

/**
 * Compact panel showing a player's identity + their most recent play in the
 * current trick, side by side. Used for all four seats so the whole table fits
 * on one screen without scrolling.
 */
export default function PlayerPanel({
  player, isCurrentTurn, label, showPoints, disconnected, play, isTopOfTrick, combo, tichuStatus, passed, mirror, sweepOffset,
  seat, announcements = [], bubbleSide = 'above',
}: Props) {
  const glow = seatGlow(announcements);
  const theme = useTheme();
  // Attention: panels are deliberately quiet so the cards (hand, trick) carry
  // the table; whoever is to play gets the one strong signal, an ochre ring
  // plus a "to play" tab.
  return (
    <div
      data-seat-panel={seat}
      className={`relative flex items-center gap-4 rounded-2xl px-4 py-3 min-h-[140px] min-w-[440px] transition-[box-shadow,background-color] duration-300 ${
        mirror ? 'flex-row-reverse' : ''
      } ${
        glow
          ? `bg-black/25 ${glow}`
          : isCurrentTurn
          ? 'bg-ochre/10 ring-[3px] ring-ochre shadow-[0_0_0_8px_rgba(232,170,56,0.14),0_12px_28px_-10px_rgba(0,0,0,0.55)]'
          : 'bg-black/15 ring-1 ring-cream/10'
      }`}
    >
      {isCurrentTurn && (
        <div
          className={`absolute -top-3.5 ${mirror ? 'right-6' : 'left-6'} rounded-full bg-ochre px-3 py-0.5 text-lg font-extrabold uppercase tracking-[0.15em] text-ink shadow-[0_2px_0_rgb(var(--c-ochre-dark))]`}
        >
          To play
        </div>
      )}
      {/* Identity */}
      <div className={`shrink-0 w-52 ${mirror ? 'text-right' : 'text-left'}`}>
        {label && <div className="text-xl uppercase tracking-[0.2em] text-cream/55 font-bold">{label}</div>}
        <div className={`flex items-center gap-1 min-w-0 ${mirror ? 'justify-end' : ''}`}>
          <span className={`font-display font-semibold text-4xl leading-tight truncate ${isCurrentTurn ? 'text-ochre-light' : 'text-cream'}`}>
            {player.name}
          </span>
          <TichuBadge call={player.tichuCall} status={tichuStatus} />
        </div>
        {disconnected && (
          <div className="mt-0.5 inline-flex items-center gap-1 text-2xl font-semibold text-ochre-light" title="Disconnected — waiting to reconnect">
            <span className="inline-block h-2 w-2 rounded-full bg-ochre animate-pulse" />
            Disconnected
          </div>
        )}
        <div className={`flex items-center gap-4 text-2xl mt-1 font-bold text-cream/75 ${mirror ? 'justify-end' : ''}`}>
          {player.isOut ? (
            <span className="italic text-cream/60">Out</span>
          ) : (
            <span className="inline-flex items-center gap-1.5" title="cards in hand">
              <img src={cardArt(theme, 'icon-hand.svg')} alt="" className="w-8 h-8" />
              {player.cardCount}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5" title="tricks won">
            <img src={cardArt(theme, 'icon-tricks.svg')} alt="" className="w-8 h-8" />
            {player.trickCount}
          </span>
          {showPoints && player.capturedPoints !== 0 && (
            <span className="text-good" title="card points captured">{player.capturedPoints}p</span>
          )}
        </div>
      </div>

      {/* Their last play this trick (plus a "Passed" tag if they passed — shown
          alongside any cards, never overwriting them). The key on SeatPlay
          re-triggers its arrival animation per play without remounting the
          whole panel; the sweep wrapper flies a cleared trick to the winner. */}
      <SeatBubbles events={announcements} side={bubbleSide} alignEnd={mirror} />

      <div className="flex-1 flex flex-col items-center justify-center gap-1 min-w-[180px]">
        {play.length > 0 && (
          <div
            className={sweepOffset ? 'seat-play-sweep' : undefined}
            style={sweepOffset ? ({ '--sx': `${sweepOffset.x}px`, '--sy': `${sweepOffset.y}px` } as CSSProperties) : undefined}
          >
            <SeatPlay key={play.map(cardId).join('|')} cards={play} isTopOfTrick={isTopOfTrick} combo={combo} />
          </div>
        )}
        {passed && (
          <span className="text-xl font-bold text-cream/60 bg-black/25 rounded-full px-3 py-0.5 uppercase tracking-[0.15em]">
            Passed
          </span>
        )}
      </div>
    </div>
  );
}
