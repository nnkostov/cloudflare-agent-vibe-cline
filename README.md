# GitHub AI Intelligence Agent

An intelligent agent built on Cloudflare Workers that continuously monitors GitHub for high-potential AI/ML projects, providing venture capital-grade analysis using Claude AI models.

## Features

- **Automated GitHub Scanning**: Continuously monitors trending AI/ML repositories
- **AI-Powered Analysis**: Uses Claude-4 models (Opus & Sonnet) for deep investment analysis
- **Smart Scoring**: Multi-factor scoring system for growth, engagement, and quality
- **Alert System**: Real-time notifications for high-potential opportunities
- **Trend Detection**: Identifies emerging patterns and technologies
- **Contributor Analysis**: Profiles key developers and teams
- **Comprehensive Metrics**: Tracks commits, releases, PRs, issues, stars, and forks
- **Tier-Based Scanning**: Prioritizes repositories based on importance
- **Dashboard**: React-based visualization for insights and analytics

## Claude Model Strategy

The system uses an intelligent Claude deployment strategy based on repository tiers:

- **Claude-Opus-4**: Used for high-potential repositories (Tier 1) to perform research-heavy analysis including:
  - Technical architecture deep-dive
  - Competitive landscape analysis
  - Growth trajectory predictions
  - Investment thesis generation
  - Enhanced scoring (technical moat, scalability, developer adoption)

- **Claude-Sonnet-4**: Used for medium-potential repositories (Tier 2) for solid standard analysis

- **Claude-3-Haiku-20240307**: Used for quick scans and low-priority repositories (Tier 3) for cost optimization

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub API     │────▶│  Cloudflare      │────▶│  Claude API     │
│                 │     │  Workers         │     │  (Opus/Sonnet)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  D1 Database     │
                        │  R2 Storage      │
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  React Dashboard │
                        └──────────────────┘
```

## Setup

1. Clone the repository:
```bash
git clone https://github.com/nnkostov/cloudflare-agent-vibe-cline.git
cd cloudflare-agent-vibe-cline
```

2. Install dependencies:
```bash
npm install
cd dashboard && npm install && cd ..
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Set up Cloudflare resources:
```bash
# Create D1 database
wrangler d1 create github-agent-db

# Create R2 bucket
wrangler r2 bucket create github-agent-storage

# Update wrangler.toml with the IDs
```

5. Initialize the database:
```bash
wrangler d1 execute github-agent-db --file=./schema-complete.sql
```

6. Deploy:
```bash
npm run deploy
```

## API Endpoints

### Core Endpoints

#### Initialize Agent
```bash
POST /api/agent/init
```
Initializes the agent and sets up scheduled scanning.

#### Get Status
```bash
GET /api/status
```
Returns system status including rate limits and performance metrics.

### Repository Endpoints

#### Get Repository Count
```bash
GET /api/repos/count
```

#### Get Trending Repositories
```bash
GET /api/repos/trending
```

#### Get Repositories by Tier
```bash
GET /api/repos/tier?tier=1
```

### Metrics Endpoints

#### Get Comprehensive Metrics
```bash
GET /api/metrics/comprehensive?repo_id=123456
```

### Reports

#### Daily Report
```bash
GET /api/reports/daily
```

#### Enhanced Report
```bash
GET /api/reports/enhanced
```

### Alerts

#### Get Recent Alerts
```bash
GET /api/alerts
```

## Tier System

The system uses a three-tier classification for repositories:

### Tier 1 (High Priority)
- Stars: ≥100 with >10% growth velocity
- Scan frequency: Every 3-6 hours
- Analysis: Claude Opus-4 for deep insights

### Tier 2 (Medium Priority)
- Stars: ≥50
- Scan frequency: Every 12-24 hours
- Analysis: Claude Sonnet-4 for standard analysis

### Tier 3 (Low Priority)
- Stars: <50
- Scan frequency: Every 48-168 hours
- Analysis: Claude Haiku for quick assessment

## Dashboard

The React dashboard provides:

- **Overview**: Key metrics and system health
- **Leaderboard**: Top repositories by various metrics
- **Analysis**: Detailed repository insights
- **Alerts**: Real-time notifications
- **Reports**: Daily and enhanced reports
- **Controls**: System management

Access the dashboard at your deployed URL after running:
```bash
cd dashboard
npm run build
cd ..
npm run deploy
```

## Development

### Run tests:
```bash
npm test
```

### Run locally:
```bash
# Terminal 1: Run the worker
npm run dev

# Terminal 2: Run the dashboard
cd dashboard
npm run dev
```

### Test enhanced metrics collection:
```bash
node test-enhanced-system.js
```

## Unified Services

The codebase uses unified services that combine basic and enhanced functionality:

- **GitHubService**: All GitHub API operations and metrics collection
- **StorageService**: All database operations including tier management
- **RepoAnalyzer**: Comprehensive analysis and tier calculation
- **GitHubAgent**: Orchestrates scanning and analysis operations

See [Unified Services API Documentation](docs/UNIFIED_SERVICES_API.md) for detailed API reference.

## Cost Considerations

The tier-based strategy optimizes costs while maintaining quality:
- Tier 1 repositories get premium analysis with Opus-4
- Tier 2 repositories receive solid analysis with Sonnet-4
- Tier 3 repositories are efficiently scanned with Haiku

Monitor your usage:
- GitHub API: 5,000 requests/hour (authenticated)
- Claude API: Based on your Anthropic plan
- Cloudflare: Workers and D1 usage

## Performance Optimizations

- **Batch Operations**: Process multiple items efficiently
- **Rate Limiting**: Built-in limiters prevent API exhaustion
- **Caching**: D1 stores results to minimize API calls
- **Streaming**: Large datasets use streaming for memory efficiency
- **Connection Pooling**: Reuses database connections

## License

MIT
