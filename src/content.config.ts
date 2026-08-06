import { defineCollection, z } from "astro:content";
import { file } from "astro/loaders";

// Rejects javascript:/data: etc — z.string().url() only checks the value
// parses as a URL, not that its scheme is safe to render into an href.
const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "must be an http(s) URL");

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
    // instead (src/data/logos.ts), which emits only the optimized output,
    // and still fails the build on a missing file.
    image: z
      .string()
      .regex(/^[\w.-]+\.(png|jpe?g|webp|avif)$/i, "must be an image filename"),
    description: z.string().optional(),
  }),
});

// src/data/jobs.json is written by scripts/fetch-getro-jobs.mjs and wraps
// the array in { fetchedAt, boards, jobs }; unwrap it for the loader.
const jobs = defineCollection({
  loader: file("src/data/jobs.json", {
    parser: (text) => JSON.parse(text).jobs,
  }),
  schema: z.object({
    title: z.string().min(1),
    company: z.string().nullable(),
    companyLogo: httpUrl.nullable(),
    location: z.string().nullable(),
    remote: z.boolean(),
    url: httpUrl,
    postedAt: z.string().nullable(),
    board: z.object({ id: z.string(), title: z.string() }),
  }),
});

export const collections = { boards, jobs };
