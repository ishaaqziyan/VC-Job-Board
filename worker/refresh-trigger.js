// Cloudflare Worker: proxies the "Refresh now" button on /jobs to GitHub's
// workflow_dispatch API. Exists only because the GitHub token needed to
// trigger a workflow run can't live in browser JS — this holds it as a
// Worker secret instead. See ../worker/README for deploy steps.
const ALLOWED_ORIGINS = new Set([
  "https://cryptovcjobs.ishaaq.org",
  "https://hcf2z-5yaaa-aaaal-ajxja-cai.icp0.io",
  "http://localhost:4321",
]);

const OWNER = "ishaaqziyan";
const REPO = "VC-Job-Board";
const WORKFLOW_FILE = "refresh-jobs.yaml";
const COOLDOWN_MS = 5 * 60 * 1000;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    const last = await env.RATE_LIMIT_KV.get("last-trigger");
    const now = Date.now();
    if (last && now - Number(last) < COOLDOWN_MS) {
      const retryAfter = Math.ceil((COOLDOWN_MS - (now - Number(last))) / 1000);
      return new Response(JSON.stringify({ error: "cooldown", retryAfter }), {
        status: 429,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "vc-job-board-refresh-worker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "master" }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      return new Response(JSON.stringify({ error: "github_error", detail }), {
        status: 502,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    await env.RATE_LIMIT_KV.put("last-trigger", String(now));

    return new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  },
};
