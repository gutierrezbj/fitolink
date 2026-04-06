/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: deep olive (topographic map green, NOT generic eco-green)
        brand: {
          50:  '#f3f5ee',
          100: '#e2e8d0',
          200: '#c1ceaa',
          300: '#9bb37c',
          400: '#779757',
          500: '#587c3a',
          600: '#46632e',
          700: '#354b23',
          800: '#253518',
          900: '#18230f',
        },
        // Accent: terracotta (CTAs, warm actions)
        terra: {
          50:  '#fdf4f0',
          100: '#fbe4d5',
          200: '#f5c4a8',
          300: '#ed9e72',
          400: '#e27542',
          500: '#d45220',
          600: '#b3401a',
          700: '#8f3014',
          800: '#6b230e',
          900: '#471708',
        },
        // Secondary: warm ochre (accent, data, highlights)
        earth: {
          50:  '#fdf8f0',
          100: '#f5e6cc',
          200: '#e8cc99',
          300: '#d4a85a',
          400: '#c49032',
          500: '#a67c2e',
          600: '#8a6526',
          700: '#6e4f1e',
          800: '#523b16',
          900: '#36270f',
        },
      },
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
