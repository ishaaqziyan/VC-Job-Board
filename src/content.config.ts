import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

const boards = defineCollection({
  loader: file("src/data/boards.json"),
  schema: z.object({
    title: z.string().min(1),
    // Validated at build time: a malformed URL fails the build instead of
    // shipping a broken card.
    url: z.string().url(),
    // Filename within src/assets/logos/. Deliberately a plain string rather
    // than the image() helper: image() makes Astro emit the unoptimized
    // original into dist/_astro alongside the webp (3.3MB of files nothing
    // references). The page resolves this through a static import map
    // instead (src/data/logos.ts), which emits only the optimized output —
    // and still fails the build on a missing file.
    image: z
      .string()
      .regex(/^[\w.-]+\.(png|jpe?g|webp|avif)$/i, "must be an image filename"),
    description: z.string().optional(),
  }),
});

export const collections = { boards };
