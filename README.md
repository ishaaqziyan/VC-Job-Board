# The Great Crypto VC Jobs Board

The Great Crypto VC Job Board aggregates dozens of crypto VC and Web3 job portals into a single page, so you don't have to hunt down each portfolio's job board one by one.

![image](https://github.com/user-attachments/assets/2dfd18d8-7457-435b-b593-fa0d08cdb289)

[![Build](https://github.com/ishaaqziyan/VC-Job-Board/actions/workflows/ci.yaml/badge.svg)](https://github.com/ishaaqziyan/VC-Job-Board/actions/workflows/ci.yaml)
[![Refresh live job postings](https://github.com/ishaaqziyan/VC-Job-Board/actions/workflows/refresh-jobs.yaml/badge.svg)](https://github.com/ishaaqziyan/VC-Job-Board/actions/workflows/refresh-jobs.yaml)
[![Deploy](https://github.com/ishaaqziyan/VC-Job-Board/actions/workflows/deploy.yaml/badge.svg)](https://github.com/ishaaqziyan/VC-Job-Board/actions/workflows/deploy.yaml)

Built on [![Internet Computer portal](https://img.shields.io/badge/Internet-Computer-grey?logo=internet%20computer)](https://internetcomputer.org) 🚀

There's no separate unit test suite yet — the Build badge reflects `astro check` (type-checking + content-collection schema validation) plus a full production build, which is the project's current correctness gate.

## Site structure

- `/` — landing page with two entry points
- `/jobs` — live role postings, pulled directly from portfolio job boards that expose a fetchable feed. Includes a manual **Refresh now** button that triggers a fresh fetch + redeploy on demand
- `/job-boards` — the full list of tracked portfolio job boards, including ones without a live feed

## How the data stays current

- `scripts/fetch-getro-jobs.mjs` fetches live postings from any tracked board running on [Getro](https://www.getro.com/), detected dynamically (not a hardcoded list). Runs daily via `.github/workflows/refresh-jobs.yaml` and commits `src/data/jobs.json` when it changes.
- The **Refresh now** button on `/jobs` triggers that same workflow on demand through a small Cloudflare Worker (`worker/`) that holds the GitHub token needed to call `workflow_dispatch` — see `worker/refresh-trigger.js`.
- `scripts/discover-boards.mjs` checks a hand-maintained candidate list (`scripts/board-candidates.json`) for new Getro-powered boards not yet tracked in `src/data/boards.json`. Run with `npm run discover-boards`.

GitHub only fires scheduled workflows as they exist on the repository's default branch, so `refresh-jobs.yaml` (and this CI workflow) need to be on `master` to actually run.

## Secrets

Deploy credentials are centralized in [Doppler](https://doppler.com) (project `vc-jobs`, config `prd`) rather than duplicated across GitHub Secrets and local machines:

- `DFX_IDENTITY_PEM` — the identity `deploy.yaml` imports into `icp-cli` to deploy to ICP. GitHub Actions only needs the single `DOPPLER_TOKEN` secret (a Doppler service token scoped to `vc-jobs`/`prd`) to pull it at deploy time.
- `GITHUB_TOKEN` (fine-grained PAT, `Actions: Read and write` on this repo only) — used by the Cloudflare Worker (`worker/`) that backs the **Refresh now** button. Set it on the Worker with:
  ```
  doppler secrets get GITHUB_TOKEN --plain --project vc-jobs --config prd | npx wrangler secret put GITHUB_TOKEN
  ```
  (piping it in avoids mistyping the secret name at Wrangler's interactive prompt)

## 🧞 Commands

| Command                 | Action                                                       |
| :----------------------- | :----------------------------------------------------------- |
| `npm install`             | Installs dependencies                                       |
| `npm run dev`              | Starts frontend dev server at `localhost:4321`             |
| `npm run build`            | Build your production site to `./dist/`                    |
| `npm run discover-boards`  | Check candidate URLs for new Getro-powered job boards       |
| `npm run format`           | Format the codebase with Prettier                           |

## Adding a new job board

1. Run `npm run discover-boards` (after adding a candidate to `scripts/board-candidates.json`) to confirm it's Getro-powered.
2. Add a logo to `src/assets/logos/`.
3. Add an entry to `src/data/boards.json` with `title`, `url`, and `image` (the logo filename).
