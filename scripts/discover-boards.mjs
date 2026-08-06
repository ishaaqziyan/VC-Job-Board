// Probes candidate VC job-board URLs for the Getro platform signature (same
// detection fetch-getro-jobs.mjs uses) and reports which ones aren't yet in
// src/data/boards.json, so a human can vet and add them.
//
// Candidates come from scripts/board-candidates.json, an array of
// { "title": "...", "url": "..." } you maintain by hand. This script does
// not discover firms on its own; it only tells you whether a URL you
// already suspect is a VC job board is Getro-powered and not already
// tracked. A detected board still needs a logo added to
// src/assets/logos/ and an entry added to src/data/boards.json by hand.
//
// Run manually: node scripts/discover-boards.mjs
import { readFile } from "node:fs/promises";

const USER_AGENT =
  "TheGreatCryptoVCJobBoard/1.0 (+https://github.com/ishaaqziyan/VC-Job-Board; job board aggregator)";
const TIMEOUT_MS = 20_000;
const CONCURRENCY = 4;

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT },
    });
    return { res, text: res.ok ? await res.text() : null };
  } finally {
    clearTimeout(timer);
  }
}

async function detectGetro(url) {
  let res, html;
  try {
    ({ res, text: html } = await fetchOnce(url));
  } catch (err) {
    return { detected: false, reason: err.message };
  }
  if (!html) return { detected: false, reason: `page fetch failed (${res.status})` };

  const poweredBy = res.headers.get("x-powered-by") ?? "";
  const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
  if (!poweredBy.toLowerCase().includes("getro") || !buildIdMatch) {
    return { detected: false, reason: "not Getro" };
  }
  return { detected: true };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

const [candidates, existingBoards] = await Promise.all([
  readFile("scripts/board-candidates.json", "utf8").then(JSON.parse),
  readFile("src/data/boards.json", "utf8").then(JSON.parse),
]);

const existingUrls = new Set(existingBoards.map((b) => b.url));
const newCandidates = candidates.filter((c) => !existingUrls.has(c.url));

if (newCandidates.length === 0) {
  console.log(
    "[discover-boards] No new candidates: every URL in board-candidates.json is already in boards.json.",
  );
  process.exit(0);
}

console.log(`[discover-boards] Checking ${newCandidates.length} candidate(s) not yet in boards.json...`);

const results = await mapWithConcurrency(newCandidates, CONCURRENCY, async (candidate) => ({
  candidate,
  ...(await detectGetro(candidate.url)),
}));

const detected = results.filter((r) => r.detected);
const notDetected = results.filter((r) => !r.detected);

for (const { candidate } of detected) {
  console.log(`  new: ${candidate.title}: ${candidate.url}`);
}
for (const { candidate, reason } of notDetected) {
  console.log(`  skip: ${candidate.title} (${reason}): ${candidate.url}`);
}

console.log(
  `[discover-boards] ${detected.length} new Getro board(s) found, ${notDetected.length} skipped.`,
);
if (detected.length > 0) {
  console.log(
    "[discover-boards] Add each to src/data/boards.json with a logo in src/assets/logos/ to include it.",
  );
}
