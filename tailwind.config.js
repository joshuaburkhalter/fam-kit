/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        background: '#080b12',
        card: '#121827',
        theme: {
          DEFAULT: 'rgb(var(--theme-rgb) / <alpha-value>)',
          hover: 'rgb(var(--theme-hover-rgb) / <alpha-value>)',
          text: 'var(--theme-text)',
        },
      },
    },
  },
  plugins: [],
};
