import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// Sitio 100% estático: sin SSR, sin adapters de servidor, sin endpoints.
export default defineConfig({
  site: "https://prodim.com.ar",
  output: "static",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap(),
  ],
});
