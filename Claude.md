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
- **`src/agents/GitHubAgent.ts`** — Durable Object that orchestrates all business logic. Handles scheduled scanning (cron alarms), repo analysis, batch operations. This is where most API endpoints are actually implemented.
- **`src/services/`** — Service classes that all extend `BaseService` (which provides `handleError()`, `jsonResponse()`, and D1 helper methods `dbRun`/`dbFirst`/`dbAll`/`dbBatch`):
  - `github.ts` / `github-enhanced.ts` — GitHub API client (search, metrics, contributors, rate limits)
  - `claude.ts` — Anthropic API integration. Builds prompts, selects model by score tier, parses structured analysis responses
  - `storage.ts` / `storage-enhanced.ts` — D1 database + R2 storage operations
  - `diagnostics.ts` / `logs.ts` — System monitoring
- **`src/analyzers/repoAnalyzer.ts`** — Scoring algorithm: `Total = 0.4×Growth + 0.3×Engagement + 0.3×Quality`. Determines which Claude model to use based on score.
- **`src/types/index.ts`** — All TypeScript interfaces, the `Env` type (D1, R2, Durable Object bindings), and the `CONFIG`/`SCORING` constants.
- **`src/utils/`** — Rate limiting, batch processing, stream processing, structured logging, performance monitoring.
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

Score-based tiering in `src/services/claude.ts` and `src/analyzers/repoAnalyzer.ts`:
- Score >= 70: `claude-opus-4-6` (deep analysis with enhanced prompt)
- Score 50-69: `claude-sonnet-4-6` (standard analysis)
- Score < 50: `claude-haiku-4-5-20251001` (quick scan)

### Database Schema

SQL schemas are in `database/schemas/`. Migrations run via `wrangler d1 execute github-intelligence --file=./database/schemas/schema.sql`.

## Key Patterns

- All services extend `BaseService` which wraps D1 operations (`dbRun`, `dbFirst`, `dbAll`, `dbBatch`) with error handling.
- The worker entry point (`src/index.ts`) proxies most `/api/agent/*` routes to the Durable Object; some routes like `/api/status` and `/api/scan` are handled directly.
- Claude API responses are parsed from structured text (investment scores, recommendations) — see `parseResponse()` and `parseEnhancedResponse()` in `claude.ts`.
- Rate limiting for both GitHub and Claude APIs is handled via utilities in `src/utils/simpleRateLimiter.ts`.

## Deployment

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```
