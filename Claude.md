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

# Tests (vitest with Cloudflare Workers pool)
npm test              # Watch mode
npm run test:ci       # Single run (CI)
npx vitest run src/services/claude.test.ts  # Single test file

# Linting, formatting, type checking
npm run lint          # ESLint on src/
npm run format        # Prettier on src/
npm run typecheck     # tsc --noEmit

# Deploy (auto-bumps version, builds dashboard, deploys worker)
npm run deploy
```

## Architecture

### Request Flow

```
HTTP Request → src/index.ts (WorkerService)
  ├── /api/* routes → handleApiRequest()
  │   ├── Direct handlers (status, scan, trending, alerts, reports)
  │   └── Durable Object proxy → GitHubAgent.fetch()
  └── Non-API routes → Static dashboard assets (KV)
```

### Core Components

- **`src/index.ts`** — Worker entry point. Routes requests, serves dashboard static assets from KV, handles CORS. Exports the `GitHubAgent` Durable Object class.
- **`src/agents/GitHubAgent.ts`** — Durable Object shell. Handles HTTP routing, alarm/cron scheduling, and read-only query handlers. Delegates business logic to orchestrators.
- **`src/orchestrators/`** — Business logic extracted from GitHubAgent for testability:
  - `scanner.ts` — `ScanOrchestrator`: repo discovery, tier processing (Tier 1/2/3), metrics collection. Takes service deps + an `analyzeRepo` callback. All tier methods return `BatchResult` with error tracking.
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

React + TypeScript + Vite app using TanStack Query, Tailwind CSS, React Router, and Recharts. Built output goes to `dashboard/dist/` which is served as static assets via `@cloudflare/kv-asset-handler`.

### Cloudflare Bindings (from `wrangler.toml`)

- `DB` — D1 database (`github-intelligence`)
- `STORAGE` — R2 bucket (`github-analyses`)
- `GITHUB_AGENT` — Durable Object namespace
- Secrets: `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`
- Cron triggers: hourly scan + twice-daily full sweep

### Test Setup

Tests use `@cloudflare/vitest-pool-workers` which runs tests inside the Workers runtime with miniflare. Config is in `vitest.config.js`. Tests can access D1, R2, and Durable Objects bindings. Test files live alongside source files (`*.test.ts`).

### Claude Model Selection

Score-based tiering in `src/analyzers/repoAnalyzer.ts` (`getRecommendedModel`); models, effort, pricing and fallback settings live in `CONFIG.claude` (`src/types/index.ts`):
- Score >= 70 (or growth >= 80): `claude-opus-5-5`, effort `medium`
- Score 50-69: `claude-sonnet-5-5`, effort `medium`
- Score < 50: `claude-haiku-5-5`, effort `low`

`ClaudeService` (`src/services/claude.ts`) calls the API through `@anthropic-ai/sdk` with structured outputs (a JSON schema), so responses are always schema-valid. Opus and Sonnet requests opt into server-side refusal fallback (`fallbacks: "default"`); a refused Haiku analysis is retried once on Sonnet. Do not send `temperature`: the 5.5 models reject it.

### Database Schema

The current schema is `database/schemas/schema-canonical.sql`; keep it in sync with production. Incremental migrations live in `database/migrations/` and run with `wrangler d1 execute github-intelligence --remote --file=<migration>` before deploying code that depends on them.

## Key Patterns

- All services extend `BaseService` which wraps D1 operations (`dbRun`, `dbFirst`, `dbAll`, `dbBatch`) with error handling.
- The worker entry point (`src/index.ts`) proxies most `/api/agent/*` routes to the Durable Object; some routes like `/api/status` and `/api/scan` are handled directly.
- **Orchestrator pattern**: `GitHubAgent` is a thin Durable Object shell that delegates to `ScanOrchestrator` and `AnalysisOrchestrator`. Orchestrators take service dependencies in their constructor plus callbacks for DO-specific operations (`analyzeRepo`, `saveBatchState`). This keeps business logic testable without the DO runtime.
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
