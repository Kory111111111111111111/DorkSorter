<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learned User Preferences

- Prefers GitHub setup tasks (Pages, Actions, repo settings) to be done through the GitHub CLI (`gh`) rather than manual web UI steps.
- Wants changes left local unless they explicitly ask for a commit or push.

## Learned Workspace Facts

- DorkSorter is deployed as a static Next.js export on GitHub Pages; `.github/workflows/pages.yml` deploys on every push to the `main` branch and can also be run manually.
- There are no API routes at runtime: search, filters, sorting, and builder suggestions all run in the browser against a downloaded dork index.
- `scripts/ingest-dorks.ts` builds `src/data/dorks.json` from multiple public Google-dork list repos, dropping case-insensitive duplicates, preferring topic files over bulk dumps over `all-google-dorks.txt`, and skipping carding, fraud, shopping, and bulk-dump lists.
- `scripts/stage-public-data.mjs` converts `src/data/dorks.json` into the compact `public/dorks.json` served to browsers (a label dictionary plus short rows per dork, with `sourceFile` omitted and only its count kept in a manifest). `scripts/write-first-page.ts` then writes `public/dorks-first-page.json` by calling `queryDorks` with `DEFAULT_BROWSE_QUERY`, so the first paint and later pages stay the same result.
- Browse cards show a plain-language "what this query finds" line generated from the same operator parsing the builder uses.
- Query and compact-index behavior belongs in `src/lib/query-dorks.ts` and `src/lib/load-corpus.ts`, covered by `npm test`. Extend those tests when that behavior changes; it has shipped without tests before.
