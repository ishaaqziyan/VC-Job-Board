import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import juno from "@junobuild/vite-plugin";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://hcf2z-5yaaa-aaaal-ajxja-cai.icp0.io",
  integrations: [mdx(), sitemap()],
  vite: {
    plugins: [juno(), tailwindcss()],
  },
  devToolbar: {
    enabled: false,
  },
});