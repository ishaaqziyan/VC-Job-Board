import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import juno from "@junobuild/vite-plugin";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",
  integrations: [mdx(), sitemap(), tailwind()],
  vite: {
    plugins: [juno()],
  },
  devToolbar: {
    enabled: false,
  },
});
