// Astro's image pipeline emits the optimized output (webp) AND the untouched
// source file into dist/_astro. It only elides the source when <Image> consumes
// the import in the same module; ours are passed as a prop into Article.astro,
// so all logo originals ship as dead weight otherwise (~3.3MB, referenced by
// nothing).
//
// This prunes any image in dist/_astro whose filename appears in no built
// text output. Anything still referenced is left alone, so it is a no-op if
// Astro's behaviour changes.
import { readdir, readFile, stat, unlink } from "node:fs/promises";
import { join, extname, basename } from "node:path";

const DIST = "dist";
const ASSETS = join(DIST, "_astro");
const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
]);
const TEXT_EXT = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".xml",
  ".txt",
]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

const files = await walk(DIST);

// Every filename mentioned anywhere in the built text output.
const referenced = new Set();
for (const file of files) {
  if (!TEXT_EXT.has(extname(file).toLowerCase())) continue;
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/[\w.-]+\.[a-z0-9]{2,5}/gi)) {
    referenced.add(match[0]);
  }
}

let removed = 0;
let bytes = 0;
for (const file of files) {
  if (!file.startsWith(ASSETS)) continue;
  if (!IMAGE_EXT.has(extname(file).toLowerCase())) continue;
  if (referenced.has(basename(file))) continue;
  bytes += (await stat(file)).size;
  await unlink(file);
  removed++;
}

console.log(
  removed === 0
    ? "[prune] no unreferenced assets"
    : `[prune] removed ${removed} unreferenced asset(s), ${(bytes / 1024 / 1024).toFixed(2)}MB`,
);
