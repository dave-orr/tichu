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
// Halloween: a dark theme like papercraft (no inversion): moonlit violet
// greys and a pumpkin ramp in place of ochre.
const NIGHT_GRAY = ramp(['#F6EFFF', '#E9DFF5', '#D6C8E8', '#BBA9D3', '#9A88B4', '#776790', '#56496C', '#3B3050', '#2A2139', '#1D1628', '#120D1A']);
const PUMPKIN = ramp(['#FFF4E6', '#FFE4C2', '#FFCB8A', '#FFB15E', '#F99A3A', '#F2851F', '#D06E12', '#A8560E', '#80410C', '#5E300A', '#3A1D06']);
// Kawaii: plum-to-white greys and a rose ramp for highlights, already in
// light-theme order (50 = darkest text).
// Classic Baroque: jade-black lacquer greys warming to parchment, and a
// burnished gold ramp in place of ochre (sampled from the card art).
const LACQUER_GRAY = ramp(['#FAF4E6', '#F1E8D4', '#E2D6BC', '#CABDA0', '#A3A48F', '#7A826F', '#556052', '#37463B', '#26332B', '#18231D', '#0D1612']);
const GOLD = ramp(['#FFF9E8', '#FCF0CF', '#F6E0A2', '#EED07A', '#E5BF5A', '#D4A945', '#B88A2E', '#946C22', '#73521A', '#563D14', '#36260C']);
const KAWAII_GRAY = ramp(['#3E3146', '#4A3D52', '#5B4B63', '#6E5E78', '#8A7B93', '#A597AD', '#C9BED0', '#E6DCEC', '#F6F0F9', '#FCF9FD', '#FFFFFF']);
const ROSE = ramp(['#7A2843', '#8E3050', '#B03E64', '#D2507A', '#E06489', '#EC7C9C', '#F49AB3', '#F9BCCD', '#FCD9E3', '#FEEDF2', '#FFF7FA']);

// Dark-theme version of a Tailwind ramp for Halloween: the dark end (panel
// and tile shades) dimmed toward the night sky so it sits on the violet table.
// Dark-theme version of a Tailwind ramp for Classic Baroque: panel shades
// dimmed toward the jade lacquer so they sit on the table.
const lacquered = r => ramp(STEPS.map(s => (s >= 600 ? mix(r[s], '#14291F', 0.4) : r[s])));
const nightfall = r => ramp(STEPS.map(s => (s >= 600 ? mix(r[s], '#2C1E3E', 0.45) : r[s])));
// Each entry: [papercraft, kawaii, halloween, baroque].
const RAMPS = {
  gray: [PAPER_GRAY, KAWAII_GRAY, NIGHT_GRAY, LACQUER_GRAY],
  yellow: [OCHRE, ROSE, PUMPKIN, GOLD],
  ...Object.fromEntries(['green', 'blue', 'red', 'amber', 'purple', 'sky'].map(n => [n, [colors[n], inverted(colors[n]), nightfall(colors[n]), lacquered(colors[n])]])),
};
// Blue marks Grand Tichu (badges, bubbles, results). Halloween has no blue in
// its palette, so its Grand Tichu goes haunted-house violet instead.
RAMPS.blue[2] = nightfall(colors.violet);

// Named tokens: [papercraft, kawaii, halloween, baroque].
const TOKENS = {
  felt: ['#2A6446', '#D3EEE2', '#2C1E3E', '#1F4636'],
  'felt-dark': ['#1D4A34', '#C2E5D6', '#160F20', '#0F241A'],
  ink: ['#2B2233', '#5B4B63', '#1E1428', '#1E1A16'],          // dark text on light buttons
  paper: ['#F3EBDC', '#FFFFFF', '#F4EBDA', '#F3EAD6'],        // light button / surface
  cream: ['#FFF8EC', '#5B4B63', '#F6EFFF', '#F6EEDC'],        // foreground on the table
  'clay': ['#D97757', '#FF9AA9', '#8E5CD9', '#A8322A'],
  'clay-dark': ['#B85C3E', '#E8798B', '#5B3A9A', '#6E1512'],
  'clay-hover': ['#E2876A', '#FFAAB7', '#9D70E0', '#BD4034'],
  ochre: ['#E8AA38', '#FFB3C7', '#F2851F', '#D4A945'],        // highlight: turn ring, primary action
  'ochre-light': ['#F6CF7A', '#D2507A', '#FFB15E', '#EBCB7A'], // highlighted text (on the table)
  'ochre-dark': ['#B97F1E', '#F49AB0', '#B95A0E', '#8E6A20'],
  sap: ['#5E9150', '#86D9B4', '#5DAF3E', '#2F7D55'],
  'sap-dark': ['#456E3A', '#5DB893', '#3F8A2A', '#1B5035'],
  'sap-hover': ['#6CA25D', '#9BE3C2', '#6CC24A', '#3A9065'],
  brick: ['#C8443A', '#FF8A8A', '#C2352B', '#8E1B1B'],
  'brick-dark': ['#9C2F28', '#E06666', '#8A2018', '#560E0E'],
  'brick-hover': ['#D65247', '#FF9E9E', '#D2463B', '#A52626'],
  good: ['#A9CF8A', '#2E9A6A', '#A6E67F', '#A9D39A'],         // made / captured points text
  bad: ['#F08A7E', '#D9456A', '#FF8A7A', '#F08A7E'],          // failed text
  grand: ['#8FB0F0', '#5B74D6', '#C4A2F2', '#EBCB7A'],        // Grand Tichu label text
  dragon: ['#8FCB9B', '#2E9A6A', '#A6E67F', '#8FCB9B'],
  white: ['#FFFFFF', '#5B4B63', '#FFFFFF', '#FFFFFF'],
  black: ['#000000', '#FFFFFF', '#000000', '#000000'],
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
        '[data-theme="halloween"]': { ...vars(2), '--font-display': 'Creepster, "Nunito Variable", system-ui, sans-serif' },
        '[data-theme="baroque"]': { ...vars(3), '--font-display': '"Cormorant Garamond", Georgia, serif' },
      });
    }),
  ],
};
