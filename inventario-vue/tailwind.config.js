/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Colores corporativos de Surexport Levante (tomados del logo).
      // Cambiando estos valores se actualiza toda la app a la vez.
      colors: {
        // Rojo (sur / fruta) — tomado del logo: #b81415
        brand: {
          50: '#fdf2f2',
          100: '#fbe0e0',
          200: '#f5c0c0',
          600: '#b81415',
          700: '#970f10',
          800: '#780d0e',
          900: '#560a0b',
          DEFAULT: '#b81415',
        },
        // Verde (la planta del logo) — tomado del logo: #0e4a25
        brandgreen: {
          50: '#eef5f0',
          100: '#d3e6da',
          600: '#0e4a25',
          700: '#0b3a1d',
          800: '#082c16',
          DEFAULT: '#0e4a25',
        },
      },
    },
  },
  plugins: [],
}