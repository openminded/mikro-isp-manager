/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc', // slate-50
        surface: '#ffffff',
        primary: '#3b82f6', // blue-500
        secondary: '#64748b', // slate-500
        success: '#10b981', // emerald-500
        danger: '#ef4444', // red-500
        warning: '#f59e0b', // amber-500
      }
    },
  },
  plugins: [],
}
