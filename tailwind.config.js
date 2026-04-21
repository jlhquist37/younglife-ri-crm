/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a5f',
          light: '#2d5282',
        },
        accent: {
          DEFAULT: '#a0001e',
        },
      },
    },
  },
  plugins: [],
}
