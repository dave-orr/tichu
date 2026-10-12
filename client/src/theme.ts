import { createContext, useContext } from 'react';
import type { Theme } from '@tichu/shared';

/**
 * The room's theme (GameSettings.theme), provided by App. Colours, fonts and
 * card stock switch through CSS variables keyed off <html data-theme>; card
 * art switches folders via cardArt().
 */
export const ThemeContext = createContext<Theme>('papercraft');
export const useTheme = () => useContext(ThemeContext);

/** URL of a card-art file for the theme: papercraft art lives in cards/,
 *  every other theme's in cards/<theme>/ under the same file names. */
export function cardArt(theme: Theme, file: string): string {
  return `${import.meta.env.BASE_URL}cards/${theme === 'papercraft' ? '' : `${theme}/`}${file}`;
}
