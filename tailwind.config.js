/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme tokens.
        ink: '#0f172a', // primary text on white
        panel: '#ffffff', // cards / modals
        brand: '#2563eb', // primary blue (boxes, buttons)
        brandDark: '#1d4ed8',
        accent: '#16a34a', // success / streak
      },
      fontFamily: {
        display: ['system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
