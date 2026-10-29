/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './apps/cuidador-web/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0b1120',
          card: '#131d31',
          border: '#1e293b',
          blue: '#2563eb',
          green: '#059669',
        },
      },
    },
  },
  plugins: [],
};
