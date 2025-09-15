/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['var(--font-inter)', 'system-ui', 'sans-serif'],
        'display': ['var(--font-playfair-display)', 'serif'],
      },
      colors: {
        // Amber palette (extended)
        'amber': {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Orange colors for gradients
        'orange': {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Whiskey-inspired color palette
        'whiskey-brown': {
          light: '#D2B48C',
          DEFAULT: '#B8860B',
          dark: '#8B4513',
          darker: '#654321',
        },
        // Amber-gold palette
        'amber-gold': {
          light: '#FFD700',
          DEFAULT: '#DAA520',
          dark: '#B8860B',
        },
        // Stone-gray palette
        'stone-gray': {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
        },
        // Cream colors
        'cream': {
          light: '#FFF8DC',
          DEFAULT: '#F5F5DC',
          dark: '#F0E68C',
        },
        // Enhanced slate
        'slate': {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        // Brand colors
        'brand': {
          primary: '#D97706',
          secondary: '#B45309',
          accent: '#F59E0B',
          surface: '#0F172A',
          'text-primary': '#FFFFFF',
          'text-secondary': '#CBD5E1',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'whiskey-gradient': 'linear-gradient(135deg, #D97706 0%, #B45309 50%, #92400E 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'whiskey': '0 10px 25px -3px rgba(217, 119, 6, 0.1), 0 4px 6px -2px rgba(217, 119, 6, 0.05)',
        'whiskey-lg': '0 20px 40px -4px rgba(217, 119, 6, 0.15), 0 8px 16px -4px rgba(217, 119, 6, 0.1)',
        'glow': '0 0 20px rgba(251, 191, 36, 0.3)',
        'glow-lg': '0 0 40px rgba(251, 191, 36, 0.4)',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}; 