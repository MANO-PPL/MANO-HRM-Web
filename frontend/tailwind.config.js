/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        'dark-bg': '#010409',
        'dark-card': '#0d1117',
        'github-dark-bg': '#010409',
        'github-dark-subtle': '#0d1117',
        'github-dark-border': '#30363d',
        'github-dark-text': '#f0f6fc',
        'github-dark-muted': '#8b949e',
        'github-dark-accent': '#58a6ff',
      }
    },
  },
  plugins: [],
}