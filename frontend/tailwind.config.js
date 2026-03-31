/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#04040a',
          'bg-light': '#0a0a14',
          'bg-card': 'rgba(10, 10, 25, 0.8)',
          cyan: '#00c8ff',
          green: '#00ffb3',
          purple: '#a855f7',
          pink: '#ff6b9d',
          red: '#ff4757',
          orange: '#ff9f43',
          gold: '#FFD700',
          silver: '#C0C0C0',
          bronze: '#CD7F32',
          platinum: '#00CED1',
          diamond: '#B9F2FF',
        },
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(0, 200, 255, 0.3), 0 0 40px rgba(0, 200, 255, 0.1)',
        'neon-green': '0 0 20px rgba(0, 255, 179, 0.3), 0 0 40px rgba(0, 255, 179, 0.1)',
        'neon-purple': '0 0 20px rgba(168, 85, 247, 0.3), 0 0 40px rgba(168, 85, 247, 0.1)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(0, 200, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 200, 255, 0.03) 1px, transparent 1px)
        `,
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%': { boxShadow: '0 0 20px rgba(0, 200, 255, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(0, 200, 255, 0.5), 0 0 60px rgba(0, 200, 255, 0.2)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
