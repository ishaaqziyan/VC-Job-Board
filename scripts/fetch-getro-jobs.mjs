// Aggregates live job postings from board sites running on Getro (a shared
// VC/portfolio jobs platform). Detected dynamically per board (x-powered-by:
// Getro, or a Next.js __NEXT_DATA__ buildId) rather than a hardcoded list, so
// a board that migrates onto or off Getro is picked up automatically.
//
// For a Getro-powered board this reads the same JSON its own page renders
// from: Next.js's public data route (`/_next/data/{buildId}{path}.json`),
// rather than scraping rendered HTML. That route only returns the first page
// (~20 postings) of each board's listing; deeper pagination uses an
// undocumented internal API this script does not call.
//
// Run manually: node scripts/fetch-getro-jobs.mjs
// Writes: src/data/jobs.json
import { readFile, writeFile } from "node:fs/promises";

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

// A slow/contended board under concurrent load times out more often than a
// real outage does, so one retry meaningfully cuts false "skipped" results.
async function fetchText(url) {
  try {
    return await fetchOnce(url);
  } catch {
    return await fetchOnce(url);
  }
}

async function fetchBoard(board) {
  const { res: pageRes, text: html } = await fetchText(board.url);
  if (!html) return { board, skipped: `page fetch failed (${pageRes.status})` };

  const poweredBy = pageRes.headers.get("x-powered-by") ?? "";
  const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
  if (!poweredBy.toLowerCase().includes("getro") || !buildIdMatch) {
    return { board, skipped: "not Getro" };
  }
  const buildId = buildIdMatch[1];

  const finalUrl = new URL(pageRes.url);
  const pathname = finalUrl.pathname.replace(/\/$/, "") || "/index";
  const dataUrl = `${finalUrl.origin}/_next/data/${buildId}${pathname}.json`;

  const { res: dataRes, text: dataText } = await fetchText(dataUrl);
  if (!dataText) return { board, skipped: `data fetch failed (${dataRes.status})` };

  let payload;
  try {
    payload = JSON.parse(dataText);
  } catch {
    return { board, skipped: "data response was not JSON" };
  }

  const jobsState = payload?.pageProps?.initialState?.jobs;
  const found = jobsState?.found;
  if (!Array.isArray(found)) return { board, skipped: "unexpected data shape" };

  const isValidUrl = (u) => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const allJobs = found.map((job) => ({
    id: `${board.id}:${job.id}`,
    title: job.title,
    company: job.organization?.name ?? null,
    companyLogo: job.organization?.logoUrl ?? null,
    location: job.locations?.[0] ?? job.searchableLocations?.[0] ?? null,
    remote: job.workMode === "remote",
    url: job.url,
    postedAt: job.createdAt ? new Date(job.createdAt * 1000).toISOString() : null,
    board: { id: board.id, title: board.title },
  }));

  const jobs = allJobs.filter((job) => {
    if (!isValidUrl(job.url)) {
      console.warn(`  [skip] ${job.id}: invalid url ${JSON.stringify(job.url)}`);
      return false;
    }
    return true;
  });

  return { board, jobs, total: jobsState.total };
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

const boards = JSON.parse(await readFile("src/data/boards.json", "utf8"));
const results = await mapWithConcurrency(boards, CONCURRENCY, (board) =>
  fetchBoard(board).catch((err) => ({ board, skipped: err.message })),
);

const jobs = results.flatMap((r) => r.jobs ?? []);
const boardSummaries = results.map((r) => ({
  id: r.board.id,
  title: r.board.title,
  fetched: r.jobs?.length ?? 0,
  total: r.total ?? null,
  skipped: r.skipped ?? null,
}));

const ok = boardSummaries.filter((b) => !b.skipped);
const skipped = boardSummaries.filter((b) => b.skipped);

// A run where every board fails almost certainly means a network problem or
// an upstream schema change, not that all boards ran out of jobs at once.
// Leave the last-known-good src/data/jobs.json on disk and fail loudly
// instead of committing an empty result over it.
if (jobs.length === 0) {
  console.error(
    `[fetch-getro-jobs] 0 jobs from ${boards.length} boards, leaving existing src/data/jobs.json untouched.`,
  );
  for (const b of skipped) console.error(`  skip: ${b.title}: ${b.skipped}`);
  process.exit(1);
}

await writeFile(
  "src/data/jobs.json",
  JSON.stringify({ fetchedAt: new Date().toISOString(), boards: boardSummaries, jobs }, null, 2) +
    "\n",
);

console.log(
  `[fetch-getro-jobs] ${ok.length}/${boards.length} boards yielded ${jobs.length} jobs; ${skipped.length} skipped`,
);
for (const b of skipped) console.log(`  skip: ${b.title}: ${b.skipped}`);
