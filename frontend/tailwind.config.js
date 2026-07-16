/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#b9d1ff',
          300: '#8bb2ff',
          400: '#5c8aff',
          500: '#3763f4',
          600: '#2748d8',
          700: '#2138ac',
          800: '#1f3187',
          900: '#1e2c6b',
        },
      },
    },
  },
  plugins: [],
};
