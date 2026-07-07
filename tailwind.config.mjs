/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Paleta "planta industrial": teal profundo (tanques, seguridad)
        // + verde-lima concentrado (color real de detergentes/desengrasantes).
        ink: {
          50: "#f2f7f6",
          100: "#dfece9",
          200: "#b9d6d0",
          300: "#8cb9b0",
          400: "#5c948a",
          500: "#3c766c",
          600: "#2a5d55",
          700: "#204a44",
          800: "#173733",
          900: "#0e2422",
          950: "#081615",
        },
        batch: {
          // acento "lima concentrado"
          400: "#c7ec3f",
          500: "#b3db22",
          600: "#93b81a",
        },
        paper: "#f7f7f4",
      },
      fontFamily: {
        display: ["'Garet'", "system-ui", "sans-serif"],
        body: ["'Garet'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        garet: ["'Garet'", "system-ui", "sans-serif"],
        comfortaa: ["'Comfortaa'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,36,34,0.06), 0 1px 12px rgba(14,36,34,0.06)",
        drawer: "-8px 0 30px rgba(14,36,34,0.15)",
      },
    },
  },
  plugins: [],
};
