# GitHub AI Intelligence Agent - Codebase Overview

## Project Purpose
This is a Cloudflare Workers application that monitors GitHub repositories related to AI/ML/LLM technologies, analyzes them using Claude AI, and provides investment insights. It's designed to help identify high-potential open-source projects early.

## Architecture Overview

### Core Components

1. **Cloudflare Worker (src/index.ts)**
   - Main entry point that handles HTTP requests
   - Routes API calls to appropriate handlers
   - Manages CORS and error handling
   - Serves React dashboard in production
   - Endpoints:
     - `/api/repos/count` - Get total repository count
     - `/api/repos/trending` - Get trending repositories
     - `/api/repos/tier` - Get repos by tier (1, 2, or 3)
     - `/api/metrics/comprehensive` - Get detailed metrics for a repo
     - `/api/alerts` - Get recent alerts
     - `/api/reports/daily` - Get daily report
     - `/api/reports/enhanced` - Get enhanced report with tier metrics
     - `/api/agent/init` - Initialize the agent
     - `/api/status` - Get system status

2. **Durable Object (src/agents/GitHubAgent.ts)**
   - Manages scheduled scans and long-running operations
   - Implements tiered scanning strategy:
     - **Tier 1 (Hot Prospects)**: Deep scan every 3-6 hours, all metrics
     - **Tier 2 (Rising Stars)**: Basic scan every 12-24 hours
     - **Tier 3 (Long Tail)**: Minimal scan every 48-168 hours
   - Coordinates between GitHub API, Claude AI, and storage

### Unified Services Layer

The codebase now uses unified services that combine all functionality:

1. **GitHub Service (github-unified.ts)**
   - Combines basic and enhanced GitHub operations
   - Repository search and discovery
   - Comprehensive metrics collection (commits, PRs, issues, releases, stars, forks)
   - Rate limiting and error handling
   - Multiple search strategies

2. **Storage Service (storage-unified.ts)**
   - Combines basic and enhanced storage operations
   - Repository CRUD operations
   - Metrics storage (basic and enhanced)
   - Analysis and alert management
   - Tier-based repository management
   - Analytics queries

3. **Claude AI Service (claude.ts)**
   - Integrates with Anthropic's Claude API
   - Uses different models based on repository tier:
     - Claude Opus 4: Tier 1 repos (deep analysis)
     - Claude Sonnet 4: Tier 2 repos (standard analysis)
     - Claude 3 Haiku: Tier 3 repos (quick assessment)
   - Analyzes repositories for investment potential

4. **Base Service (base.ts)**
   - Common error handling and response formatting
   - Shared utilities for all services

### Analyzers

**RepoAnalyzer (repoAnalyzer-unified.ts)**
- Combines basic and enhanced analysis
- Calculates comprehensive scores (growth, engagement, quality)
- Tier assignment based on metrics
- Model recommendation logic
- Prepares data for AI analysis

### Utility Modules

1. **Rate Limiter (rateLimiter.ts)**
   - Prevents API quota exhaustion
   - Separate limiters for GitHub, GitHub Search, and Claude APIs

2. **Performance Monitor (performanceMonitor.ts)**
   - Tracks execution time and memory usage
   - Identifies performance bottlenecks

3. **Stream Processor (streamProcessor.ts)**
   - Handles large datasets efficiently
   - JSON streaming for memory optimization

4. **Batch Processor (batchProcessor.ts)**
   - Processes items in configurable batches
   - Prevents timeout issues

5. **Connection Pool (connectionPool.ts)**
   - Reuses database connections
   - Improves query performance

### Database Schema

The application uses multiple tables to track:
- **repositories**: Basic repo information
- **repo_metrics**: Historical metrics (stars, forks, issues)
- **analyses**: AI-generated investment analyses
- **alerts**: High-priority notifications
- **contributors**: Key developers
- **trends**: Emerging patterns
- **repo_tiers**: Tier assignments for prioritized scanning
- **commit_metrics**: Daily commit activity
- **release_history**: Release tracking
- **pr_metrics**: Pull request activity
- **issue_metrics**: Issue tracking
- **star_history**: Star growth tracking
- **fork_analysis**: Fork network analysis

### React Dashboard

Located in `/dashboard`, provides:
- **Overview**: System health and key metrics
- **Leaderboard**: Top repositories by various metrics
- **Analysis**: Detailed repository insights
- **Alerts**: Real-time notifications
- **Reports**: Daily and enhanced reports
- **Controls**: System management interface

### Configuration (src/types/index.ts)

Key configuration includes:
- **GitHub Topics**: ai, llm, agents, machine-learning, gpt, langchain, rag, embeddings
- **Tier Thresholds**: 
  - Tier 1: ≥100 stars with >10% growth
  - Tier 2: ≥50 stars
  - Tier 3: <50 stars
- **Scan Intervals**: 
  - Tier 1: 3-6 hours
  - Tier 2: 12-24 hours
  - Tier 3: 48-168 hours
- **Claude Models**: Opus 4, Sonnet 4, and Haiku based on tiers
- **Rate Limits**: 
  - GitHub: 30 req/min
  - GitHub Search: 10 req/min
  - Claude: 5 req/min

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
   ENVIRONMENT=development
   ```

3. **Database Setup**
   ```bash
   npx wrangler d1 create github-intelligence
   npx wrangler d1 execute github-intelligence --local --file=schema-complete.sql
   ```

4. **Running Locally**
   ```bash
   # Terminal 1: Run the worker
   npm run dev
   
   # Terminal 2: Run the dashboard
   cd dashboard
   npm run dev
   ```

5. **Testing**
   ```bash
   npm test
   node test-enhanced-system.js
   ```

## API Usage Examples

### Get Repository Count
```bash
curl http://localhost:8787/api/repos/count
```

### Get Trending Repositories
```bash
curl http://localhost:8787/api/repos/trending
```

### Get Tier 1 Repositories
```bash
curl http://localhost:8787/api/repos/tier?tier=1
```

### Get Comprehensive Metrics
```bash
curl http://localhost:8787/api/metrics/comprehensive?repo_id=123456
```

### Get Enhanced Report
```bash
curl http://localhost:8787/api/reports/enhanced
```

### Initialize Agent
```bash
curl -X POST http://localhost:8787/api/agent/init
```

## Deployment

1. **Build Dashboard**
   ```bash
   cd dashboard
   npm run build
   cd ..
   ```

2. **Configure Wrangler**
   - Update `wrangler.toml` with your account details
   - Set up D1 database binding
   - Configure R2 bucket for storage

3. **Deploy to Cloudflare**
   ```bash
   npm run deploy
   ```

4. **Set Secrets**
   ```bash
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

## Cost Optimization

- Uses tiered scanning to minimize API calls
- Caches analyses for 7 days
- Batches operations to stay within CPU limits
- Uses cheaper Claude models for lower-tier repos
- Implements rate limiting and backoff strategies
- Connection pooling for database efficiency

## Performance Optimizations

1. **Batch Processing**
   - Groups multiple operations
   - Reduces API calls and database queries

2. **Streaming**
   - Handles large datasets without memory issues
   - JSON streaming for API responses

3. **Caching**
   - D1 stores results to minimize API calls
   - Recent analysis checks prevent redundant AI calls

4. **Rate Limiting**
   - Built-in limiters prevent quota exhaustion
   - Automatic backoff and retry logic

## Architecture Decisions

1. **Why Unified Services?**
   - Single source of truth for each service
   - Eliminates code duplication
   - Easier maintenance and debugging
   - Better performance (no duplicate instantiation)

2. **Why Cloudflare Workers?**
   - Serverless, scales automatically
   - Built-in cron triggers for scheduled scans
   - D1 database for persistence
   - Global edge network
   - R2 for object storage

3. **Why Durable Objects?**
   - Manages long-running scans
   - Coordinates scheduled tasks
   - Maintains state between requests
   - Handles alarms for periodic scanning

4. **Why Tiered Scanning?**
   - Optimizes resource usage
   - Focuses on high-value targets
   - Scales to thousands of repos
   - Balances cost and coverage

5. **Why Multiple Claude Models?**
   - Balances cost vs quality
   - Opus 4 for deep research on top repos
   - Sonnet 4 for solid standard analysis
   - Haiku for efficient quick scans

## Troubleshooting

1. **Database Errors**
   - Ensure schema is up to date with schema-complete.sql
   - Check unified service method names
   - Verify column names match types

2. **API Rate Limits**
   - Monitor rate limits in /api/status endpoint
   - Adjust scan intervals if needed
   - Check rate limiter configurations

3. **Claude API Issues**
   - Verify API key is valid
   - Check model names are correct
   - Monitor token usage and costs

4. **Dashboard Issues**
   - Ensure dashboard is built before deployment
   - Check CORS headers in worker
   - Verify API endpoints match frontend calls

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

4. **Dashboard Improvements**
   - Real-time updates via WebSockets
   - Advanced filtering and search
   - Custom alert configurations
   - Export functionality
