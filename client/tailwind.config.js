/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Papercraft palette, shared with the card and badge art
      // (scripts/gen-card-art.py, scripts/gen-achievement-art.py).
      colors: {
        // Every gray and yellow in the app's chrome maps onto the paper/ink
        // and ochre ramps, so panels, text and highlights share one palette.
        gray: {
          50: '#FFF8EC', 100: '#F3EBDC', 200: '#E6DCCB', 300: '#D3C8B5', 400: '#A9AE9F',
          500: '#7D8579', 600: '#56625A', 700: '#35473D', 800: '#22342A', 900: '#17261E', 950: '#0E1913',
        },
        yellow: {
          50: '#FFF8E6', 100: '#FCEFD0', 200: '#F9DFA6', 300: '#F6CF7A', 400: '#EEBB52', 500: '#E8AA38',
          600: '#C98E24', 700: '#9E6E19', 800: '#7A5414', 900: '#5C3F10', 950: '#3A2709',
        },
        felt: '#2A6446',
        'felt-dark': '#1D4A34',
        ink: '#2B2233',
        paper: '#F3EBDC',
        cream: '#FFF8EC',
        clay: { DEFAULT: '#D97757', dark: '#B85C3E' },
        ochre: { DEFAULT: '#E8AA38', light: '#F6CF7A', dark: '#B97F1E' },
        sap: { DEFAULT: '#5E9150', dark: '#456E3A' },
        brick: { DEFAULT: '#C8443A', dark: '#9C2F28' },
      },
      fontFamily: {
        // Display: card ranks, names, scores, headings. Body: everything else.
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
        sans: ['"Nunito Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
