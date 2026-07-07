import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

// Sitio 100% estático: sin SSR, sin adapters de servidor, sin endpoints.
export default defineConfig({
  output: "static",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
