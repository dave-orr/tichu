import colors from 'tailwindcss/colors';
import plugin from 'tailwindcss/plugin';

// ===== Themes =====
// Every colour the app uses is a CSS variable, so a theme (GameSettings.theme,
// applied as <html data-theme>) restyles the whole UI without touching
// components. Papercraft is the default; Kawaii is a light pastel theme, so
// it inverts the ramps: shades used as text on dark panels (gray-200,
// green-300...) become dark text, and dark panel shades (gray-800...) become
// light surfaces. White and black swap for the same reason.

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');
const ramp = values => Object.fromEntries(STEPS.map((s, i) => [s, values[i]]));
const mix = (hex, toward, t) => '#' + [1, 3, 5].map(i => {
  const a = parseInt(hex.slice(i, i + 2), 16), b = parseInt(toward.slice(i, i + 2), 16);
  return Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
}).join('');
// Light-theme version of a Tailwind ramp: reversed, with the light end (the
// former dark panel and button shades) softened toward white into pastels.
const inverted = r => ramp([...STEPS].reverse().map((s, i) => (STEPS[i] >= 300 ? mix(r[s], '#ffffff', 0.3) : r[s])));

// Papercraft: warm paper/ink greys and ochre in place of gray and yellow.
const PAPER_GRAY = ramp(['#FFF8EC', '#F3EBDC', '#E6DCCB', '#D3C8B5', '#A9AE9F', '#7D8579', '#56625A', '#35473D', '#22342A', '#17261E', '#0E1913']);
const OCHRE = ramp(['#FFF8E6', '#FCEFD0', '#F9DFA6', '#F6CF7A', '#EEBB52', '#E8AA38', '#C98E24', '#9E6E19', '#7A5414', '#5C3F10', '#3A2709']);
// Kawaii: plum-to-white greys and a rose ramp for highlights, already in
// light-theme order (50 = darkest text).
const KAWAII_GRAY = ramp(['#3E3146', '#4A3D52', '#5B4B63', '#6E5E78', '#8A7B93', '#A597AD', '#C9BED0', '#E6DCEC', '#F6F0F9', '#FCF9FD', '#FFFFFF']);
const ROSE = ramp(['#7A2843', '#8E3050', '#B03E64', '#D2507A', '#E06489', '#EC7C9C', '#F49AB3', '#F9BCCD', '#FCD9E3', '#FEEDF2', '#FFF7FA']);

const RAMPS = {
  gray: [PAPER_GRAY, KAWAII_GRAY],
  yellow: [OCHRE, ROSE],
  ...Object.fromEntries(['green', 'blue', 'red', 'amber', 'purple', 'sky'].map(n => [n, [colors[n], inverted(colors[n])]])),
};

// Named tokens: [papercraft, kawaii].
const TOKENS = {
  felt: ['#2A6446', '#D3EEE2'],
  'felt-dark': ['#1D4A34', '#C2E5D6'],
  ink: ['#2B2233', '#5B4B63'],          // dark text on light buttons
  paper: ['#F3EBDC', '#FFFFFF'],        // light button / surface
  cream: ['#FFF8EC', '#5B4B63'],        // foreground on the table
  'clay': ['#D97757', '#FF9AA9'],
  'clay-dark': ['#B85C3E', '#E8798B'],
  'clay-hover': ['#E2876A', '#FFAAB7'],
  ochre: ['#E8AA38', '#FFB3C7'],        // highlight: turn ring, primary action
  'ochre-light': ['#F6CF7A', '#D2507A'], // highlighted text (on the table)
  'ochre-dark': ['#B97F1E', '#F49AB0'],
  sap: ['#5E9150', '#86D9B4'],
  'sap-dark': ['#456E3A', '#5DB893'],
  'sap-hover': ['#6CA25D', '#9BE3C2'],
  brick: ['#C8443A', '#FF8A8A'],
  'brick-dark': ['#9C2F28', '#E06666'],
  'brick-hover': ['#D65247', '#FF9E9E'],
  good: ['#A9CF8A', '#2E9A6A'],         // made / captured points text
  bad: ['#F08A7E', '#D9456A'],          // failed text
  grand: ['#8FB0F0', '#5B74D6'],        // Grand Tichu label text
  dragon: ['#8FCB9B', '#2E9A6A'],
  white: ['#FFFFFF', '#5B4B63'],
  black: ['#000000', '#FFFFFF'],
};

const v = name => `rgb(var(--c-${name}) / <alpha-value>)`;
const vars = i => ({
  ...Object.fromEntries(Object.entries(TOKENS).map(([k, pair]) => [`--c-${k}`, rgb(pair[i])])),
  ...Object.fromEntries(Object.entries(RAMPS).flatMap(([n, pair]) => STEPS.map(s => [`--c-${n}-${s}`, rgb(pair[i][s])]))),
});

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(Object.keys(RAMPS).map(n => [n, Object.fromEntries(STEPS.map(s => [s, v(`${n}-${s}`)]))])),
        felt: v('felt'),
        'felt-dark': v('felt-dark'),
        ink: v('ink'),
        paper: v('paper'),
        cream: v('cream'),
        clay: { DEFAULT: v('clay'), dark: v('clay-dark'), hover: v('clay-hover') },
        ochre: { DEFAULT: v('ochre'), light: v('ochre-light'), dark: v('ochre-dark') },
        sap: { DEFAULT: v('sap'), dark: v('sap-dark'), hover: v('sap-hover') },
        brick: { DEFAULT: v('brick'), dark: v('brick-dark'), hover: v('brick-hover') },
        good: v('good'),
        bad: v('bad'),
        grand: v('grand'),
        dragon: v('dragon'),
        white: v('white'),
        black: v('black'),
      },
      fontFamily: {
        // Display: names, scores, headings (Kawaii swaps in rounded Nunito
        // via --font-display). Body: everything else.
        display: ['var(--font-display)'],
        sans: ['"Nunito Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...vars(0), '--font-display': '"Fraunces Variable", Georgia, serif' },
        '[data-theme="kawaii"]': { ...vars(1), '--font-display': '"Nunito Variable", system-ui, sans-serif' },
      });
    }),
  ],
};
