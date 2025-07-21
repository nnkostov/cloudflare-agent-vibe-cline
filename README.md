# 🚀 GitHub AI Intelligence Agent

<div align="center">
  
  [![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/nnkostov/cloudflare-agent-vibe-cline)
  [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
  [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
  [![Claude AI](https://img.shields.io/badge/Claude-AI%20Powered-purple)](https://anthropic.com)
  
  **🤖 Your AI-Powered Venture Capital Analyst for GitHub**
  
  *Discover the next unicorn in AI/ML before everyone else does*

</div>

---

## 🎯 What is This?

Imagine having a tireless AI analyst that:
- 🔍 **Scans GitHub 24/7** for emerging AI/ML projects
- 🧠 **Analyzes with Claude AI** using VC-grade investment criteria
- 📊 **Tracks growth patterns** across thousands of repositories
- 🚨 **Alerts you instantly** when it finds high-potential opportunities
- 🎨 **Visualizes insights** in a stunning cyberpunk dashboard

**This is that analyst.** Built on Cloudflare Workers, powered by Claude AI, and designed for serious investors.

## ✨ Features That Make Us Special

<table>
<tr>
<td width="50%">

### 🧠 **AI-Powered Analysis**
- **Claude Opus-4** for deep research on high-potential projects
- **Claude Sonnet-4** for comprehensive standard analysis
- **Claude Haiku** for efficient quick scans
- Multi-factor scoring algorithm

</td>
<td width="50%">

### ⚡ **Real-Time Intelligence**
- Continuous GitHub monitoring
- Hourly batch analysis
- Smart tier-based prioritization
- Complete database coverage

</td>
</tr>
<tr>
<td width="50%">

### 🎮 **Cyberpunk Dashboard**
- Neural Activity Command Center
- Investment opportunity scoring
- Community health metrics
- Real-time system monitoring

</td>
<td width="50%">

### 📈 **Investment Insights**
- Growth trajectory predictions
- Technical moat assessment
- Team strength evaluation
- Market opportunity analysis

</td>
</tr>
</table>

## 🏗️ Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        GH[GitHub API]
    end
    
    subgraph "Cloudflare Edge"
        W[Workers]
        DO[Durable Objects]
        D1[D1 Database]
        R2[R2 Storage]
    end
    
    subgraph "AI Analysis"
        CO[Claude Opus-4]
        CS[Claude Sonnet-4]
        CH[Claude Haiku]
    end
    
    subgraph "Frontend"
        DASH[React Dashboard]
    end
    
    GH -->|Discover| W
    W -->|Schedule| DO
    DO -->|Analyze| CO
    DO -->|Analyze| CS
    DO -->|Analyze| CH
    W -->|Store| D1
    W -->|Archive| R2
    W -->|Serve| DASH
    
    style GH fill:#f9f,stroke:#333,stroke-width:4px
    style W fill:#ff9,stroke:#333,stroke-width:4px
    style CO fill:#9ff,stroke:#333,stroke-width:4px
    style DASH fill:#9f9,stroke:#333,stroke-width:4px
```

## 🔧 Detailed System Architecture

### Complete Technical Architecture

```mermaid
graph TB
    subgraph "External APIs"
        GH_SEARCH[GitHub Search API]
        GH_REPO[GitHub Repo API]
        GH_CONTRIB[GitHub Contributors API]
        CLAUDE_API[Anthropic Claude API]
    end
    
    subgraph "Cloudflare Workers Runtime"
        subgraph "Main Worker"
            ROUTER[Request Router]
            CORS[CORS Handler]
            AUTH[Auth Middleware]
            
            subgraph "API Handlers"
                AGENT_HANDLER[Agent Handler]
                SCAN_HANDLER[Scan Handler]
                ANALYZE_HANDLER[Analyze Handler]
                REPO_HANDLER[Repo Handler]
                METRICS_HANDLER[Metrics Handler]
                REPORT_HANDLER[Report Handler]
                ALERT_HANDLER[Alert Handler]
            end
        end
        
        subgraph "Durable Objects"
            DO_AGENT[GitHubAgent DO]
            ALARM[Alarm Scheduler]
            STATE[State Management]
        end
        
        subgraph "Scheduled Jobs"
            CRON1[Hourly Scan]
            CRON2[Daily Sweep]
        end
    end
    
    subgraph "Services Layer"
        subgraph "Core Services"
            GITHUB_SVC[GitHub Service]
            CLAUDE_SVC[Claude Service]
            STORAGE_SVC[Storage Service]
            ANALYZER_SVC[Repo Analyzer]
        end
        
        subgraph "Analysis Pipeline"
            SCORE_CALC[Score Calculator]
            TIER_ASSIGN[Tier Assignment]
            MODEL_SELECT[Model Selection]
            PROMPT_BUILD[Prompt Builder]
            RESPONSE_PARSE[Response Parser]
        end
    end
    
    subgraph "Data Layer"
        subgraph "D1 Database"
            REPOS_TABLE[(repositories)]
            TIERS_TABLE[(repo_tiers)]
            ANALYSES_TABLE[(analyses)]
            ALERTS_TABLE[(alerts)]
            METRICS_TABLE[(metrics)]
            CONTRIBUTORS_TABLE[(contributors)]
        end
        
        subgraph "R2 Storage"
            ANALYSIS_ARCHIVE[Analysis Archives]
            REPORT_STORAGE[Report Storage]
        end
    end
    
    subgraph "Frontend Dashboard"
        subgraph "Pages"
            OVERVIEW[Overview Page]
            LEADERBOARD[Leaderboard]
            ANALYSIS[Analysis View]
            REPORTS[Reports]
            ALERTS[Alerts]
            CONTROLS[Controls]
        end
        
        subgraph "Components"
            NEURAL_CENTER[Neural Activity Center]
            STATS_GRID[Stats Grid]
            TIER_SUMMARY[Tier Summary]
            BATCH_PROGRESS[Batch Progress]
        end
        
        API_CLIENT[API Client]
    end
    
    %% External API Connections
    GH_SEARCH --> GITHUB_SVC
    GH_REPO --> GITHUB_SVC
    GH_CONTRIB --> GITHUB_SVC
    CLAUDE_API --> CLAUDE_SVC
    
    %% Worker Flow
    ROUTER --> AUTH
    AUTH --> AGENT_HANDLER
    AUTH --> SCAN_HANDLER
    AUTH --> ANALYZE_HANDLER
    AUTH --> REPO_HANDLER
    AUTH --> METRICS_HANDLER
    AUTH --> REPORT_HANDLER
    AUTH --> ALERT_HANDLER
    
    %% Durable Object Flow
    AGENT_HANDLER --> DO_AGENT
    CRON1 --> DO_AGENT
    CRON2 --> DO_AGENT
    DO_AGENT --> ALARM
    DO_AGENT --> STATE
    
    %% Service Connections
    SCAN_HANDLER --> GITHUB_SVC
    ANALYZE_HANDLER --> ANALYZER_SVC
    ANALYZER_SVC --> SCORE_CALC
    SCORE_CALC --> TIER_ASSIGN
    TIER_ASSIGN --> MODEL_SELECT
    MODEL_SELECT --> CLAUDE_SVC
    CLAUDE_SVC --> PROMPT_BUILD
    CLAUDE_SVC --> RESPONSE_PARSE
    
    %% Storage Flow
    GITHUB_SVC --> STORAGE_SVC
    CLAUDE_SVC --> STORAGE_SVC
    STORAGE_SVC --> REPOS_TABLE
    STORAGE_SVC --> TIERS_TABLE
    STORAGE_SVC --> ANALYSES_TABLE
    STORAGE_SVC --> ALERTS_TABLE
    STORAGE_SVC --> METRICS_TABLE
    STORAGE_SVC --> CONTRIBUTORS_TABLE
    STORAGE_SVC --> ANALYSIS_ARCHIVE
    STORAGE_SVC --> REPORT_STORAGE
    
    %% Frontend Connections
    API_CLIENT --> ROUTER
    OVERVIEW --> API_CLIENT
    LEADERBOARD --> API_CLIENT
    ANALYSIS --> API_CLIENT
    REPORTS --> API_CLIENT
    ALERTS --> API_CLIENT
    CONTROLS --> API_CLIENT
    
    %% Styling
    classDef external fill:#f9f,stroke:#333,stroke-width:2px
    classDef worker fill:#ff9,stroke:#333,stroke-width:2px
    classDef service fill:#9ff,stroke:#333,stroke-width:2px
    classDef storage fill:#9f9,stroke:#333,stroke-width:2px
    classDef frontend fill:#f99,stroke:#333,stroke-width:2px
    
    class GH_SEARCH,GH_REPO,GH_CONTRIB,CLAUDE_API external
    class ROUTER,CORS,AUTH,AGENT_HANDLER,SCAN_HANDLER,ANALYZE_HANDLER,REPO_HANDLER,METRICS_HANDLER,REPORT_HANDLER,ALERT_HANDLER,DO_AGENT,ALARM,STATE,CRON1,CRON2 worker
    class GITHUB_SVC,CLAUDE_SVC,STORAGE_SVC,ANALYZER_SVC,SCORE_CALC,TIER_ASSIGN,MODEL_SELECT,PROMPT_BUILD,RESPONSE_PARSE service
    class REPOS_TABLE,TIERS_TABLE,ANALYSES_TABLE,ALERTS_TABLE,METRICS_TABLE,CONTRIBUTORS_TABLE,ANALYSIS_ARCHIVE,REPORT_STORAGE storage
    class OVERVIEW,LEADERBOARD,ANALYSIS,REPORTS,ALERTS,CONTROLS,NEURAL_CENTER,STATS_GRID,TIER_SUMMARY,BATCH_PROGRESS,API_CLIENT frontend
```

### Data Flow Sequences

#### 🔍 Repository Discovery Flow

```mermaid
sequenceDiagram
    participant Cron as Cron Trigger
    participant DO as Durable Object
    participant GH as GitHub Service
    participant DB as D1 Database
    participant Analyzer as Repo Analyzer
    
    Cron->>DO: Trigger hourly scan
    DO->>DO: Check rate limits
    DO->>GH: Search AI/ML repos
    GH->>GH: Apply filters (stars, topics)
    GH-->>DO: Return repositories
    DO->>DB: Check existing repos
    DO->>DB: Save new repositories
    DO->>Analyzer: Calculate scores
    Analyzer->>Analyzer: Growth metrics
    Analyzer->>Analyzer: Engagement metrics
    Analyzer->>Analyzer: Quality metrics
    Analyzer-->>DO: Return scores
    DO->>DB: Update repo_tiers
    DO->>DO: Schedule next scan
```

#### 🧠 Analysis Pipeline Flow

```mermaid
sequenceDiagram
    participant DO as Durable Object
    participant Storage as Storage Service
    participant Analyzer as Repo Analyzer
    participant Claude as Claude Service
    participant DB as D1 Database
    
    DO->>Storage: Get unanalyzed repos
    Storage-->>DO: Repos needing analysis
    loop For each repository
        DO->>Analyzer: Get tier & score
        Analyzer-->>DO: Tier (1/2/3)
        DO->>DO: Select Claude model
        alt Tier 1: High Priority
            DO->>Claude: Analyze with Opus-4
        else Tier 2: Medium Priority
            DO->>Claude: Analyze with Sonnet-4
        else Tier 3: Low Priority
            DO->>Claude: Analyze with Haiku
        end
        Claude->>Claude: Build prompt
        Claude->>Claude: Get AI response
        Claude->>Claude: Parse results
        Claude-->>DO: Analysis results
        DO->>DB: Save analysis
        DO->>DB: Create alerts if needed
        DO->>DO: Wait 2 seconds
    end
```

#### 📊 Dashboard Data Flow

```mermaid
sequenceDiagram
    participant User as User Browser
    participant React as React Dashboard
    participant API as API Client
    participant Worker as Cloudflare Worker
    participant DB as D1 Database
    
    User->>React: Load dashboard
    React->>API: Request initial data
    API->>Worker: GET /api/status
    Worker->>DB: Query metrics
    DB-->>Worker: Return data
    Worker-->>API: JSON response
    API-->>React: Update state
    React-->>User: Render UI
    
    loop Every 30 seconds
        React->>API: Poll for updates
        API->>Worker: GET /api/metrics
        Worker->>DB: Get latest data
        DB-->>Worker: Updated metrics
        Worker-->>API: JSON response
        API-->>React: Update components
        React-->>User: Re-render changes
    end
```

### Database Schema

```mermaid
erDiagram
    repositories {
        int id PK
        string github_id UK
        string name
        string full_name
        string description
        int stars
        int forks
        string language
        datetime created_at
        datetime updated_at
        datetime pushed_at
    }
    
    repo_tiers {
        int id PK
        int repo_id FK
        int tier
        float total_score
        float growth_score
        float engagement_score
        float quality_score
        datetime assigned_at
    }
    
    analyses {
        int id PK
        int repo_id FK
        string model_used
        int investment_score
        string recommendation
        json analysis_data
        datetime created_at
    }
    
    alerts {
        int id PK
        int repo_id FK
        string type
        string title
        string message
        json metadata
        datetime created_at
    }
    
    metrics {
        int id PK
        int repo_id FK
        int commits
        int pull_requests
        int issues
        int contributors
        int releases
        datetime collected_at
    }
    
    contributors {
        int id PK
        int repo_id FK
        string username
        int contributions
        datetime first_seen
    }
    
    repositories ||--o{ repo_tiers : "has tier"
    repositories ||--o{ analyses : "has analyses"
    repositories ||--o{ alerts : "generates"
    repositories ||--o{ metrics : "tracks"
    repositories ||--o{ contributors : "has"
```

### Component Architecture

#### Worker Request Flow
```
┌─────────────────────────────────────────────────────────┐
│                   Incoming Request                       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   CORS Handler                           │
│  • Set Access-Control headers                           │
│  • Handle preflight requests                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Request Router                          │
│  • Parse URL path                                       │
│  • Match to handler                                     │
│  • Extract parameters                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  API Handlers                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │Agent Handler│  │Scan Handler │  │Repo Handler │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │Alert Handler│  │Report Handler│  │Metrics Handler│   │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                 Service Layer                            │
│  • Business logic                                       │
│  • Data validation                                      │
│  • External API calls                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Data Layer                              │
│  • D1 queries                                           │
│  • R2 operations                                        │
│  • Cache management                                     │
└─────────────────────────────────────────────────────────┘
```

### Security & Performance

#### Rate Limiting Strategy
- **GitHub API**: 5,000 requests/hour (authenticated)
- **Claude API**: Based on Anthropic plan limits
- **Internal throttling**: 2-second delay between analyses
- **Batch processing**: 25-50 repos per operation

#### Caching Architecture
- **D1 Cache**: 7-day analysis results
- **Worker Cache**: 5-minute API responses
- **Browser Cache**: Static assets with versioning
- **CDN Cache**: Cloudflare edge caching

#### Error Handling Flow
```
Try Operation
  ├─ Success → Return result
  └─ Error → Log to console
       ├─ Retry with backoff (3 attempts)
       ├─ Fallback to cached data
       └─ Return error response
```

## 🎯 How It Works

### 📊 Three-Tier Analysis System

```
┌─────────────────────────────────────────────────────────────┐
│ 🏆 TIER 1: PREMIUM ANALYSIS                                 │
├─────────────────────────────────────────────────────────────┤
│ ⭐ High-growth repositories with exceptional potential      │
│ 🤖 Analyzed by Claude Opus-4 for deep insights            │
│ ⏰ Scanned every few hours for latest updates              │
│ 📈 Includes technical moat & scalability assessment        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🥈 TIER 2: STANDARD ANALYSIS                                │
├─────────────────────────────────────────────────────────────┤
│ ⭐ Established projects with steady growth                  │
│ 🤖 Analyzed by Claude Sonnet-4 for comprehensive review   │
│ ⏰ Scanned multiple times daily                            │
│ 📊 Full investment scoring and recommendations             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🥉 TIER 3: DISCOVERY SCAN                                   │
├─────────────────────────────────────────────────────────────┤
│ ⭐ Emerging projects and hidden gems                       │
│ 🤖 Quickly assessed by Claude Haiku                       │
│ ⏰ Monitored regularly for breakout potential             │
│ 🔍 Efficient scanning to catch rising stars early         │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Cloudflare account
- GitHub token (for API access)
- Anthropic API key (for Claude AI)

### 1️⃣ Clone & Install

```bash
# Clone the repository
git clone https://github.com/nnkostov/cloudflare-agent-vibe-cline.git
cd cloudflare-agent-vibe-cline

# Install dependencies
npm install
cd dashboard && npm install && cd ..
```

### 2️⃣ Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials:
# - GITHUB_TOKEN
# - ANTHROPIC_API_KEY
```

### 3️⃣ Set Up Cloudflare Resources

```bash
# Create D1 database
wrangler d1 create github-agent-db

# Create R2 bucket  
wrangler r2 bucket create github-agent-storage

# Update wrangler.toml with the generated IDs
```

### 4️⃣ Initialize Database

```bash
# Run database migrations
wrangler d1 execute github-agent-db --file=./schema.sql
```

### 5️⃣ Deploy to Production

```bash
# Deploy the worker and dashboard
npm run deploy

# Your agent is now live! 🎉
```

### 6️⃣ Initialize the Agent

```bash
# Start automated scanning
curl -X POST https://your-worker.workers.dev/api/agent/init
```

## 🎮 Dashboard Preview

<div align="center">

### 🌟 Neural Activity Command Center
*Real-time system monitoring with cyberpunk aesthetics*

```
╔═══════════════════════════════════════════════════════════╗
║          🧠 NEURAL ACTIVITY COMMAND CENTER 🧠             ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      ║
║  │ API NEXUS   │  │ ANALYSIS    │  │ QUEUE       │      ║
║  │ ████████░░  │  │ CORE        │  │ MATRIX      │      ║
║  │ 87% Active  │  │ ██████████  │  │ ████░░░░░░  │      ║
║  │             │  │ Processing  │  │ 42 Pending  │      ║
║  └─────────────┘  └─────────────┘  └─────────────┘      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

</div>

## 📡 API Endpoints

### Core Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agent/init` | POST | Initialize automated scanning |
| `/api/status` | GET | System health and metrics |
| `/api/scan` | POST | Trigger manual repository scan |
| `/api/analyze` | POST | Analyze specific repository |

### Data Access

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/repos/trending` | GET | Get trending repositories |
| `/api/repos/tier` | GET | Get repositories by tier |
| `/api/repos/count` | GET | Get repository statistics |
| `/api/metrics/comprehensive` | GET | Detailed repository metrics |

### Intelligence Reports

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports/daily` | GET | Daily investment summary |
| `/api/reports/enhanced` | GET | Deep analysis reports |
| `/api/alerts` | GET | High-priority notifications |

## 🎯 Use Cases

### 🏦 For Venture Capitalists
> "Find the next AI unicorn before it hits mainstream"
- Automated deal flow for AI/ML investments
- Early detection of high-growth projects
- Comprehensive technical due diligence

### 👨‍💻 For Developers
> "Track the competition and emerging technologies"
- Monitor trending AI/ML libraries
- Discover new tools and frameworks
- Analyze successful project patterns

### 🔬 For Researchers
> "Stay ahead of AI/ML innovation curves"
- Track emerging research implementations
- Identify collaboration opportunities
- Monitor technology adoption trends

## 🛠️ Advanced Configuration

<details>
<summary><b>🔧 Environment Variables</b></summary>

```bash
# Required
GITHUB_TOKEN=            # GitHub personal access token
ANTHROPIC_API_KEY=       # Claude AI API key

# Optional
SCAN_INTERVAL=3600       # Scan frequency in seconds
ANALYSIS_BATCH_SIZE=25   # Repos per batch
TIER_1_THRESHOLD=100     # Minimum stars for Tier 1
```

</details>

<details>
<summary><b>📊 Scoring Algorithm</b></summary>

The system uses a weighted scoring algorithm:

```typescript
Total Score = (Growth × 0.4) + (Engagement × 0.3) + (Quality × 0.3)

Where:
- Growth: Stars, forks, contributor velocity
- Engagement: Issues, PRs, community activity  
- Quality: Documentation, tests, maintenance
```

</details>

<details>
<summary><b>🚀 Performance Tuning</b></summary>

- **Batch Processing**: Analyzes multiple repositories in parallel
- **Smart Caching**: 7-day cache for analyzed repositories
- **Rate Limiting**: Automatic throttling for API limits
- **Edge Computing**: Runs at Cloudflare edge locations globally

</details>

## 📈 Success Metrics

### 🏆 What Makes This Powerful

- **⚡ Speed**: From discovery to analysis in minutes, not days
- **🎯 Accuracy**: VC-grade analysis powered by Claude AI
- **📊 Coverage**: Comprehensive monitoring of the AI/ML ecosystem
- **🔄 Automation**: 24/7 operation without human intervention

### 💡 Real Impact

- **Time Saved**: Replaces hours of manual research
- **Opportunities Found**: Discovers projects before they trend
- **Insights Generated**: Deep technical and business analysis
- **Decisions Enabled**: Data-driven investment recommendations

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Run locally
npm run dev

# Run tests
npm test

# Build dashboard
cd dashboard && npm run build
```

## 📚 Documentation

- [API Reference](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🎉 Fun Facts

<div align="center">

### Did You Know? 🤔

- Our AI analyzes repositories faster than you can say "venture capital"
- The cyberpunk dashboard was inspired by Blade Runner and The Matrix
- We've discovered several projects that later became GitHub trending
- The system runs 24/7 and never needs coffee ☕

</div>

## 📜 License

MIT License - see [LICENSE](LICENSE) for details

---

<div align="center">

**Built with ❤️ by developers who believe AI should work for us**

[🌐 Live Demo](https://github-ai-intelligence.nkostov.workers.dev) | [📧 Contact](mailto:support@example.com) | [🐦 Twitter](https://twitter.com/example)

</div>
