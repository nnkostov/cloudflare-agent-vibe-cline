# GitHub AI Intelligence Agent - Codebase Overview

## Project Purpose
This is a Cloudflare Workers application that monitors GitHub repositories related to AI/ML/LLM technologies, analyzes them using Claude AI, and provides investment insights. It's designed to help identify high-potential open-source projects early.

## Architecture Overview

### Core Components

1. **Cloudflare Worker (src/index.ts)**
   - Main entry point that handles HTTP requests
   - Routes API calls to appropriate handlers
   - Manages CORS and error handling
   - Endpoints:
     - `/api/scan` - Scan GitHub for trending repos
     - `/api/scan/comprehensive` - Run tiered comprehensive scan
     - `/api/analyze` - Analyze a specific repository
     - `/api/repos/trending` - Get trending repositories
     - `/api/repos/tier` - Get repos by tier (1, 2, or 3)
     - `/api/metrics/comprehensive` - Get detailed metrics for a repo
     - `/api/alerts` - Get recent alerts
     - `/api/reports/daily` - Get daily report
     - `/api/reports/enhanced` - Get enhanced report with tier metrics
     - `/api/status` - Get system status
     - `/api/agent/init` - Initialize the agent

2. **Durable Object (src/agents/GitHubAgent.ts)**
   - Manages scheduled scans and long-running operations
   - Implements tiered scanning strategy:
     - **Tier 1 (Hot Prospects)**: Deep scan every 6 hours, all metrics
     - **Tier 2 (Rising Stars)**: Basic scan every 24 hours
     - **Tier 3 (Long Tail)**: Minimal scan weekly
   - Coordinates between GitHub API, Claude AI, and storage

### Services Layer

1. **GitHub Services**
   - `github.ts`: Basic GitHub API operations (search, repo details, README)
   - `github-enhanced.ts`: Advanced metrics collection (commits, PRs, issues, releases, star history, fork analysis)

2. **Claude AI Service (claude.ts)**
   - Integrates with Anthropic's Claude API
   - Uses different models based on repository potential:
     - Claude Opus 4: High-value repos (score > 70)
     - Claude Sonnet 4: Medium-value repos (score > 50)
     - Claude 3 Haiku: Low-value repos (efficiency)
   - Analyzes repositories for investment potential

3. **Storage Services**
   - `storage.ts`: Basic CRUD operations for repos, analyses, alerts
   - `storage-enhanced.ts`: Enhanced metrics storage (commits, PRs, issues, stars, forks)
   - Uses Cloudflare D1 (SQLite) database

4. **Base Service (base.ts)**
   - Common error handling and response formatting
   - Shared utilities for all services

### Analyzers

1. **RepoAnalyzer (repoAnalyzer.ts)**
   - Calculates basic scores (growth, engagement, quality)
   - Determines if a repo meets thresholds for AI analysis
   - Recommends appropriate Claude model based on score

2. **RepoAnalyzerEnhanced (repoAnalyzer-enhanced.ts)**
   - Advanced scoring using comprehensive metrics
   - Calculates growth velocity, engagement scores
   - Tier assignment logic

### Database Schema

The application uses multiple tables to track:
- **repositories**: Basic repo information
- **repo_metrics**: Historical metrics (stars, forks, issues)
- **analyses**: AI-generated investment analyses
- **alerts**: High-priority notifications
- **contributors**: Key developers
- **trends**: Emerging patterns
- **repository_tiers/repo_tiers**: Tier assignments for prioritized scanning
- **commit_metrics**: Daily commit activity
- **release_history**: Release tracking
- **pull_request_metrics**: PR activity
- **issue_metrics**: Issue tracking
- **star_history**: Star growth tracking
- **fork_analysis**: Fork network analysis

### Configuration (src/types/index.ts)

Key configuration includes:
- **GitHub Topics**: ai, llm, agents, machine-learning, gpt, langchain
- **Minimum Stars**: 100 for Tier 1, 50 for Tier 2, 10 for Tier 3
- **Scan Intervals**: 6 hours (Tier 1), 24 hours (Tier 2), 168 hours (Tier 3)
- **Search Strategies**: Multiple queries to find repos from different angles
- **Claude Models**: Opus 4, Sonnet 4, and Haiku with different thresholds
- **Rate Limits**: Respects GitHub API limits (5000/hour)

## Key Features

1. **Tiered Scanning System**
   - Automatically categorizes repos into 3 tiers based on potential
   - Allocates resources efficiently (deep scans for high-value repos)
   - Tracks scan history to avoid redundant API calls

2. **Comprehensive Metrics Collection**
   - Commit activity and author diversity
   - Release frequency and download counts
   - Pull request velocity and contributor engagement
   - Issue resolution times
   - Star growth trends
   - Fork network analysis

3. **AI-Powered Analysis**
   - Uses Claude to analyze README and repo context
   - Generates investment scores across multiple dimensions
   - Provides actionable recommendations
   - Identifies strengths, risks, and key questions

4. **Alert System**
   - Triggers alerts for high-growth repos
   - Investment opportunity notifications
   - Trend detection

5. **Reporting**
   - Daily reports with top opportunities
   - Enhanced reports with tier breakdowns
   - Comprehensive metrics for individual repos

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - Wrangler CLI (`npm install -g wrangler`)
   - GitHub Personal Access Token
   - Anthropic API Key

2. **Environment Variables**
   ```bash
   GITHUB_TOKEN=your_github_token
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

3. **Database Setup**
   ```bash
   npx wrangler d1 create github-intelligence
   npx wrangler d1 execute github-intelligence --local --file=schema-complete.sql
   ```

4. **Running Locally**
   ```bash
   npm run dev
   ```

5. **Testing**
   ```bash
   npm run test:enhanced:prod
   ```

## API Usage Examples

### Scan for Repositories
```bash
curl -X POST http://localhost:8787/api/scan \
  -H "Content-Type: application/json" \
  -d '{"topics": ["ai", "llm"], "minStars": 100}'
```

### Analyze a Specific Repository
```bash
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"repoOwner": "langchain-ai", "repoName": "langchain"}'
```

### Get Tier 1 Repositories
```bash
curl http://localhost:8787/api/repos/tier?tier=1
```

### Get Enhanced Report
```bash
curl http://localhost:8787/api/reports/enhanced
```

## Deployment

1. **Configure Wrangler**
   - Update `wrangler.toml` with your account details
   - Set up D1 database binding

2. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

3. **Set Secrets**
   ```bash
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

## Cost Optimization

- Uses tiered scanning to minimize API calls
- Caches analyses for 7 days
- Batches operations to stay within CPU limits
- Uses cheaper Claude models for lower-value repos
- Implements rate limiting and backoff strategies

## Future Enhancements

1. **Additional Data Sources**
   - NPM download statistics
   - Docker Hub pulls
   - Social media mentions
   - Hacker News discussions

2. **Advanced Analytics**
   - Dependency graph analysis
   - Security vulnerability tracking
   - License compatibility checks
   - Community health metrics

3. **Integration Options**
   - Slack/Discord notifications
   - Email alerts
   - Webhook support
   - REST API for external tools

## Troubleshooting

1. **Database Errors**
   - Ensure schema is up to date
   - Check table names (repo_tiers vs repository_tiers)
   - Verify column names match code

2. **API Rate Limits**
   - Monitor GitHub rate limit in status endpoint
   - Adjust scan intervals if needed
   - Use caching to reduce redundant calls

3. **Claude API Issues**
   - Verify API key is valid
   - Check model names are correct
   - Monitor token usage and costs

## Architecture Decisions

1. **Why Cloudflare Workers?**
   - Serverless, scales automatically
   - Built-in cron triggers for scheduled scans
   - D1 database for persistence
   - Global edge network

2. **Why Durable Objects?**
   - Manages long-running scans
   - Coordinates scheduled tasks
   - Maintains state between requests

3. **Why Tiered Scanning?**
   - Optimizes resource usage
   - Focuses on high-value targets
   - Scales to thousands of repos

4. **Why Multiple Claude Models?**
   - Balances cost vs quality
   - Opus 4 for deep research
   - Sonnet 4 for standard analysis
   - Haiku for efficiency
