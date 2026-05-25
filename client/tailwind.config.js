/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#1a6b3c',
        'felt-dark': '#145530',
      },
      fontSize: {
        'xs': ['1.5rem', { lineHeight: '2rem' }],
        'sm': ['1.75rem', { lineHeight: '2.5rem' }],
        'base': ['2rem', { lineHeight: '2.75rem' }],
        'lg': ['2.25rem', { lineHeight: '3rem' }],
        'xl': ['2.5rem', { lineHeight: '3.25rem' }],
        '2xl': ['3rem', { lineHeight: '3.5rem' }],
        '3xl': ['3.75rem', { lineHeight: '1' }],
        '4xl': ['4.5rem', { lineHeight: '1' }],
        '5xl': ['6rem', { lineHeight: '1' }],
        '6xl': ['7.5rem', { lineHeight: '1' }],
        '7xl': ['9rem', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
};
