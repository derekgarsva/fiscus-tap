import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#fbfbfd',
          canvas: '#f5f5f7',
          card: '#ffffff',
          border: 'rgba(0, 0, 0, 0.08)',
          'border-subtle': 'rgba(0, 0, 0, 0.04)',
          text: '#1d1d1f',
          secondary: '#86868b',
          tertiary: '#aeaeb2',
          blue: '#0071e3',
          'blue-hover': '#0077ed',
          green: '#34c759',
          red: '#ff3b30',
        },
      },
      letterSpacing: {
        'apple-tight': '-0.025em',
        'apple-title': '-0.022em',
        'apple-body': '-0.011em',
        'apple-caps': '0.08em',
      },
      boxShadow: {
        'apple-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'apple-card': '0 4px 24px -2px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'apple-elevated': '0 12px 36px -4px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.03)',
        'apple-button': '0 2px 10px rgba(0, 113, 227, 0.25)',
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
export default config;
