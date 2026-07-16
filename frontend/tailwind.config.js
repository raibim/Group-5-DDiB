/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Sora"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      colors: {
        // Electric violet — primary brand hue.
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Hot pink/fuchsia — secondary accent, paired with brand in gradients.
        accent: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        // Near-black neutrals for the dark surface.
        ink: {
          50: '#f4f4f8',
          100: '#dcdce6',
          200: '#b4b4c4',
          300: '#8f8fa3',
          400: '#6b6b80',
          500: '#4c4c5e',
          600: '#343444',
          700: '#26262f',
          800: '#191922',
          900: '#111117',
          950: '#08080c',
        },
      },
      boxShadow: {
        glow: '0 0 24px 0 rgba(139, 92, 246, 0.35)',
        'glow-accent': '0 0 24px 0 rgba(236, 72, 153, 0.35)',
      },
    },
  },
  plugins: [],
};
