import { createContext, useContext } from 'react';
import type { Card, SpecialCardName, Suit, Theme } from '@tichu/shared';

/**
 * The room's theme (GameSettings.theme), provided by App. Colours, fonts and
 * card stock switch through CSS variables keyed off <html data-theme>; card
 * art switches folders via cardArt().
 */
export const ThemeContext = createContext<Theme>('papercraft');
export const useTheme = () => useContext(ThemeContext);

/**
 * Themes whose cards are complete painted faces (one image per card, see
 * faceArt) rather than built from pips and court portraits. Their folders
 * still carry the back, panel icons and animation frames under the usual
 * names, so cardArt() works for them unchanged.
 */
const FULL_FACE_THEMES: ReadonlySet<Theme> = new Set(['baroque']);
export const hasFullFaces = (theme: Theme) => FULL_FACE_THEMES.has(theme);

/** URL of a card-art file for the theme: papercraft art lives in cards/,
 *  every other theme's in cards/<theme>/ under the same file names. */
export function cardArt(theme: Theme, file: string): string {
  return `${import.meta.env.BASE_URL}cards/${theme === 'papercraft' ? '' : `${theme}/`}${file}`;
}

const FACE_SUITS: Record<Suit, string> = { jade: 'jade', sword: 'swords', pagoda: 'pagodas', star: 'stars' };
const FACE_RANKS: Record<number, string> = { 11: 'j', 12: 'q', 13: 'k', 14: 'a' };
const FACE_SPECIALS: Record<SpecialCardName, string> = { mahjong: 'mah_jong', dog: 'dog', phoenix: 'phoenix', dragon: 'dragon' };

/** URL of a full-face theme's painted image for one card (e.g. stars_q.webp). */
export function faceArt(theme: Theme, card: Card): string {
  const name = card.type === 'special'
    ? FACE_SPECIALS[card.name]
    : `${FACE_SUITS[card.suit]}_${FACE_RANKS[card.rank] ?? card.rank}`;
  return `${import.meta.env.BASE_URL}cards/${theme}/${name}.webp`;
}
