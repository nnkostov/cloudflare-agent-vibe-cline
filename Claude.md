# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cloudflare Workers-based AI agent that monitors GitHub for high-potential AI/ML repositories and provides VC-grade investment analysis using Claude AI. It discovers trending repos, scores them, runs Claude analysis on high-scoring ones, and generates investment alerts/reports.

## Build & Development Commands

```bash
# Install dependencies (root + dashboard)
npm install && cd dashboard && npm install

# Run full dev environment (worker + dashboard)
npm run dev

# Run worker only (wrangler dev server)
npm run dev:worker

# Run dashboard only (Vite dev server on port 3003)
npm run dev:dashboard

# Tests (vitest 4 + @cloudflare/vitest-plugin, run inside workerd)
npm test              # Watch mode
npm run test:ci       # Single run (CI)
npx vitest run src/services/claude.test.ts  # Single test file

# Linting, formatting, type checking
npm run lint          # ESLint 10 + typescript-eslint on src/ (no-explicit-any is a warning)
npm run format        # Prettier on src/
npm run typecheck     # tsc --noEmit

# Deploy (auto-bumps version and commits + tags it, builds dashboard, deploys worker)
npm run deploy

# Tail worker (separate Worker; deploy it when src/tail-worker.ts changes)
npx wrangler deploy -c wrangler.tail.toml
```

## Architecture

### Request Flow

```
HTTP Request → src/index.ts (WorkerService)
  ├── /api/* routes → handleApiRequest()
  │   ├── Direct handlers (status, scan, trending, alerts, reports)
  │   └── Durable Object proxy → GitHubAgent.fetch()
  └── Non-API routes → served by Workers Static Assets before the Worker runs
```

### Core Components

- **`src/index.ts`** — Worker entry point for `/api/*` (the dashboard is served by Static Assets), CORS, and the cron `scheduled()` handler. Internal agent routes (`/scheduled`, `/init`) are never forwarded from the public API. Exports the `GitHubAgent` Durable Object class.
- **`src/agents/GitHubAgent.ts`** — Durable Object shell. Handles HTTP routing, cron-triggered runs (with run locks), and read-only query handlers. Delegates business logic to orchestrators.
- **`src/orchestrators/`** — Business logic extracted from GitHubAgent for testability:
  - `scanner.ts` — `ScanOrchestrator`: repo discovery, tier processing (Tier 1/2/3), metrics collection (no Claude calls). Each successful Tier 1/2 GitHub refresh records a real daily star snapshot (`star_history`) and a `repo_metrics` row; growth velocity for tiering comes from those (`starVelocity` in `repoAnalyzer-enhanced.ts`). All tier methods return `BatchResult` with error tracking.
  - `analyzer.ts` — `AnalysisOrchestrator`: Claude analysis, batch processing, staleness-based repo selection. Takes service deps + a `saveBatchState` callback for DO state.
- **`src/services/`** — Service classes that all extend `BaseService` (which provides `handleError()`, `jsonResponse()`, and D1 helper methods `dbRun`/`dbFirst`/`dbAll`/`dbBatch`):
  - `github.ts` / `github-enhanced.ts` — GitHub API client (search, metrics, contributors, rate limits)
  - `claude.ts` — Anthropic API integration. Builds prompts, selects model by score tier, parses structured analysis responses
  - `storage.ts` / `storage-enhanced.ts` — D1 database + R2 storage operations (including `getReposNeedingAnalysis` for tier-based staleness queries)
  - `diagnostics.ts` / `logs.ts` — System monitoring
- **`src/analyzers/repoAnalyzer.ts`** — Scoring algorithm: `Total = 0.4×Growth + 0.3×Engagement + 0.3×Quality`. Determines which Claude model to use based on score.
- **`src/types/index.ts`** — All TypeScript interfaces (`Env`, `BatchResult`, etc.), and the `CONFIG`/`SCORING` constants.
- **`src/utils/`** — Rate limiting, `isStale()` timestamp utility, batch processing, structured logging, performance monitoring.
- **`src/tail-worker.ts`** — Tail consumer for observability (processes worker logs/exceptions).

### Dashboard (`dashboard/`)

React + TypeScript + Vite app using TanStack Query, Tailwind CSS, React Router, and Recharts. Built output goes to `dashboard/dist/`, served by Workers Static Assets (`[assets]` in `wrangler.toml`, SPA fallback to `index.html`). `dashboard/public/_headers` marks hashed `/assets/*` bundles immutable.

### Cloudflare Bindings (from `wrangler.toml`)

- `DB` — D1 database (`github-intelligence`)
- `STORAGE` — R2 bucket (`github-analyses`)
- `GITHUB_AGENT` — Durable Object namespace
- Secrets: `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`
- `CF_VERSION_METADATA` — deployed version id and upload time (used by `/api/version`)
- Cron triggers: hourly scan (skipping 02:00/14:00), analysis batch at :15/:45, full sweep at 02:00/14:00

### Test Setup

Tests use `@cloudflare/vitest-plugin` (the successor to the deprecated `@cloudflare/vitest-pool-workers`), which runs them inside workerd with miniflare. Config is in `vitest.config.mjs` (ESM-only plugin). Test files live alongside source files (`*.test.ts`).

D1-backed tests import `env` from `cloudflare:test` and call `resetDatabase(env.DB)` from `src/test/d1.ts`, which recreates `database/schemas/schema-canonical.sql`. Local D1 enforces foreign keys like production, but it does NOT reproduce every D1 limit (see D1 gotchas below), so SQL that only runs in mocked tests can still fail in production. `src/test/anthropicMock.ts` fakes the Messages API over `fetch`.

### Claude Model Selection

Score-based tiering in `src/analyzers/repoAnalyzer.ts` (`getRecommendedModel`); models, effort, pricing and fallback settings live in `CONFIG.claude` (`src/types/index.ts`):
- Score >= 50 (high tier: score >= 70 or growth >= 80; medium tier: 50-69): `claude-sonnet-5-5`, effort `medium`. Opus was taken out of rotation for cost in Oct 2026; set `CONFIG.claude.models.high` back to `claude-opus-5-5` to restore it.
- Score < 50: `claude-haiku-5-5`, effort `low`

`ClaudeService` (`src/services/claude.ts`) calls the API through `@anthropic-ai/sdk` with structured outputs (a JSON schema), so responses are always schema-valid. Opus and Sonnet requests opt into server-side refusal fallback (`fallbacks: "default"`); a refused Haiku analysis is retried once on Sonnet. Do not send `temperature`: the 5.5 models reject it.

### Re-analysis policy

`StorageEnhancedService.getReposNeedingAnalysis` selects repos for the scheduled batch: never analyzed; past the tier's max age (7/14/30 days); or past the tier's min age (72h/120h/168h) and changed since the snapshot stored with the last analysis (stars or forks up >=10% by a minimum amount, or a newer push). Repos with a persistent failure (refusal, truncation, bad request) in the last 24h are skipped. `AnalysisOrchestrator.runBatch` (cron `15,45 * * * *`) is the only automated caller of Claude.

### Database Schema

The current schema is `database/schemas/schema-canonical.sql`; keep it in sync with production. Incremental migrations live in `database/migrations/` and run with `wrangler d1 execute github-intelligence --remote --file=<migration>` before deploying code that depends on them.

## D1 gotchas

- D1 rejects compound SELECTs with many terms ("too many terms in compound SELECT"); a 6-term `UNION ALL` failed in production while passing locally. Use one row of scalar subqueries instead.
- Foreign keys are enforced. Don't use `INSERT OR REPLACE` on parent tables: it deletes and re-inserts the row, resetting columns it doesn't list. Use `INSERT ... ON CONFLICT DO UPDATE`.
- System alerts use `repo_id = NULL` (alerts.repo_id references repositories).
- Timestamps come in two formats: SQLite `CURRENT_TIMESTAMP` ('YYYY-MM-DD HH:MM:SS') in most tables, ISO strings in `tail_logs.timestamp` and GitHub fields. Don't string-compare across the two.

## Key Patterns

- All services extend `BaseService` which wraps D1 operations (`dbRun`, `dbFirst`, `dbAll`, `dbBatch`) with error handling.
- The worker entry point (`src/index.ts`) handles many `/api/*` routes directly and forwards the rest to the Durable Object.
- **Orchestrator pattern**: `GitHubAgent` is a thin Durable Object shell that delegates to `ScanOrchestrator` and `AnalysisOrchestrator`. Orchestrators take service dependencies in their constructor plus callbacks for DO-specific operations (`saveBatchState`). This keeps business logic testable without the DO runtime.
- **BatchResult error tracking**: All scan/analysis operations return `BatchResult { total, succeeded, failed, errors[] }` instead of silently swallowing errors. Callers log warnings when `failed > 0`.
- A failed analysis (refusal, truncation, API error) throws and is never saved; the repo keeps its previous analysis. `classifyAnalysisError()` in `claude.ts` decides whether the failure is persistent (sets a 24h cooldown on the repo) or transient.
- Scheduled scans and batches hold heartbeat run locks in Durable Object storage (`src/utils/runLock.ts`), so a run that outlasts its cron interval is never started twice. Scheduling is cron-only.
- Rate limiting for both GitHub and Claude APIs is handled via utilities in `src/utils/rateLimiter.ts`.

## Deployment

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```
