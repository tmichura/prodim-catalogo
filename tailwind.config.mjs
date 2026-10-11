/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Paleta oficial de marca (ver "Identidad visual - Prodim"):
        // azul #2F5DA8, crema #FEF4EA, teal #3EBDC4, menta #AAE9D6, amarillo #FBDC08.
        // La escala "ink" es el azul de marca con tintes/sombras alrededor
        // (ink-700 = #2F5DA8 exacto); "batch" es el teal de marca (batch-500 = #3EBDC4 exacto).
        ink: {
          50: "#f2f6fc",
          100: "#e2ebf8",
          200: "#c4d4ee",
          300: "#98b4e1",
          400: "#608cd2",
          500: "#386fc7",
          600: "#3466b7",
          700: "#2F5DA8",
          800: "#244b89",
          900: "#183562",
          950: "#0f213e",
        },
        batch: {
          400: "#70d1db",
          500: "#3EBDC4",
          600: "#2e939e",
          // Para texto chico sobre blanco (600 no llega al contraste mínimo 4.5:1)
          700: "#24707a",
        },
        mint: "#AAE9D6",
        sun: "#FBDC08",
        // Gris muy claro (no la crema de marca): el color de fondo real de
        // la página, igual al tono que ya se veía con el patrón de fondo
        // encima, ahora sin el patrón.
        paper: "#FCFCFC",
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
