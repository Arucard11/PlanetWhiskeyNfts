/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-background': '#FAF7F0', // Light Cream
        'brand-surface': '#F0EBE3',    // Light Beige (for cards)
        'brand-primary': '#603813',    // Deep Brown (for primary actions, or text)
        'brand-secondary': '#8D6E63',  // Lighter Brown (for secondary elements/text)
        'brand-accent': '#B8860B',     // Dark Goldenrod/Amber (for highlights, CTAs)
        'brand-text-primary': '#3C2A21', // Dark Charcoal/Brown (for primary text)
        'brand-text-secondary': '#6D5F56', // Medium Brown/Gray (for less important text)
        'brand-border': '#D7CCC8',       // Subtle Light Brown/Gray border
        'gold-accent-light': '#FFD700', // Lighter Gold for highlights
      },
      fontFamily: {
        // Keeping system fonts for now, can be customized later
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'], // Added a serif option if needed
      },
      boxShadow: {
        'cool': '0 10px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.04)', // Softer shadow for light theme
        'card-hover': '0 12px 20px -3px rgba(60, 42, 33, 0.15), 0 5px 8px -2px rgba(60, 42, 33, 0.1)', // Brownish shadow for cards
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-cool-hero': 'linear-gradient(135deg, #FAF7F0 0%, #F0EBE3 70%, #E0D8CC 100%)', // Light creamy gradient
        'hero-texture': "url('/images/subtle-light-texture.png')", // Example: if you have a texture image in public/images
      }
    },
  },
  plugins: [],
}; 