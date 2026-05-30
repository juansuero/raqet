import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFBF9',
        surface: '#FFFFFF',
        foreground: '#1A1F1C',
        muted: '#5E6B62',
        border: '#E3E8E4',
        accent: {
          DEFAULT: '#00703C',
          light: '#E6F4ED',
          muted: '#4A9D73',
        },
        success: '#2A8C5E',
        warning: '#C9912E',
        danger: '#B5422B',
      },
      fontFamily: {
        display: ['Cabinet Grotesk', 'DM Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['DM Sans', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
        modal: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        hover: '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
      letterSpacing: {
        'label': '0.06em',
        'display': '0',
      },
      maxWidth: {
        'prose': '65ch',
      },
    },
  },
  plugins: [],
}
export default config
