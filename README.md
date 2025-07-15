# GitHub AI Intelligence Agent

An intelligent agent built on Cloudflare Workers that continuously monitors GitHub for high-potential AI/ML projects, providing venture capital-grade analysis using Claude AI models.

## Features

- **Automated GitHub Scanning**: Continuously monitors trending AI/ML repositories
- **AI-Powered Analysis**: Uses Claude-4 models (Opus & Sonnet) for deep investment analysis
- **Smart Scoring**: Multi-factor scoring system for growth, engagement, and quality
- **Alert System**: Real-time notifications for high-potential opportunities
- **Trend Detection**: Identifies emerging patterns and technologies
- **Contributor Analysis**: Profiles key developers and teams
- **Caching**: Efficient data storage to minimize API calls

## Claude Model Strategy

The system uses an aggressive Claude-4 deployment strategy:

- **Claude-Opus-4**: Used for high-potential repositories (score ≥ 70) to perform research-heavy analysis including:
  - Technical architecture deep-dive
  - Competitive landscape analysis
  - Growth trajectory predictions
  - Investment thesis generation
  - Enhanced scoring (technical moat, scalability, developer adoption)

- **Claude-Sonnet-4**: Used for medium-potential repositories (score 50-69) for solid standard analysis

- **Claude-3-Haiku-20240307**: Used for quick scans and low-priority repositories (score < 50) for cost optimization

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
wrangler d1 execute github-agent-db --file=./schema.sql
```

6. Deploy:
```bash
npm run deploy
```

## API Endpoints

### Initialize Agent
```bash
POST /agent/init
```
Initializes the agent and sets up scheduled scanning.

### Manual Scan
```bash
POST /agent/scan
{
  "topics": ["ai", "llm", "agents"],
  "minStars": 100
}
```

### Analyze Repository
```bash
POST /agent/analyze
{
  "repoOwner": "owner",
  "repoName": "repo",
  "force": false
}
```

### Get Status
```bash
GET /agent/status
```

### Generate Report
```bash
GET /agent/report
```

## Configuration

Key configuration options in `src/types/index.ts`:

```typescript
claude: {
  models: {
    high: 'claude-opus-4',              // Claude Opus 4
    medium: 'claude-sonnet-4',          // Claude Sonnet 4
    low: 'claude-3-haiku-20240307'     // Claude 3 Haiku
  },
  thresholds: { 
    high: 70,    // Lowered for aggressive Opus usage
    medium: 50   // Lowered to use Sonnet-4 more
  },
  maxTokens: { 
    opus: 16000,    // Doubled for deeper analysis
    sonnet: 8000,   // Doubled from 4000
    haiku: 1000     // Keep the same
  }
}
```

## Enhanced Analysis Features

With Claude-4 models, the system now provides:

1. **Extended Scoring Metrics**:
   - Technical moat assessment
   - Scalability evaluation
   - Developer adoption tracking

2. **Predictive Analytics**:
   - 6-12 month growth trajectory predictions
   - Market timing analysis

3. **Investment Intelligence**:
   - Detailed investment thesis generation
   - Competitive landscape analysis
   - Strategic due diligence questions

## Development

Run tests:
```bash
npm test
```

Run locally:
```bash
npm run dev
```

## Cost Considerations

The aggressive Claude-4 strategy prioritizes analysis quality over cost:
- Opus-4 is used for ~30-40% of analyzed repositories
- Sonnet-4 handles another ~30-40%
- Haiku manages the remaining low-priority scans

Monitor your Anthropic API usage to manage costs effectively.

## License

MIT
