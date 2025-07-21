# 🔧 Technical Architecture Documentation

This document contains the detailed technical architecture of the GitHub AI Intelligence Agent system.

## Table of Contents
- [Complete System Architecture](#complete-system-architecture)
- [Data Flow Sequences](#data-flow-sequences)
- [Database Schema](#database-schema)
- [Component Architecture](#component-architecture)
- [Security & Performance](#security--performance)
- [API Reference](#api-reference)

## Complete System Architecture

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

## Data Flow Sequences

### 🔍 Repository Discovery Flow

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

### 🧠 Analysis Pipeline Flow

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

### 📊 Dashboard Data Flow

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

## Database Schema

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

## Component Architecture

### Worker Request Flow
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

### Service Architecture

#### GitHub Service
- **Purpose**: Interface with GitHub API
- **Key Methods**:
  - `searchRepositories()`: Find AI/ML repos
  - `getRepository()`: Get detailed repo info
  - `getContributors()`: Fetch contributor data
  - `getMetrics()`: Collect commits, PRs, issues
- **Rate Limiting**: 5,000 requests/hour

#### Claude Service
- **Purpose**: AI analysis using Anthropic Claude
- **Key Methods**:
  - `analyzeRepository()`: Main analysis entry point
  - `buildPrompt()`: Construct analysis prompt
  - `parseResponse()`: Extract structured data
- **Model Selection**:
  - Tier 1 → Claude Opus-4
  - Tier 2 → Claude Sonnet-4
  - Tier 3 → Claude Haiku

#### Storage Service
- **Purpose**: Database operations
- **Key Methods**:
  - `saveRepository()`: Store repo data
  - `updateTier()`: Assign/update tiers
  - `saveAnalysis()`: Store AI analysis
  - `createAlert()`: Generate notifications
- **Optimizations**:
  - Batch operations
  - Connection pooling
  - Query optimization

#### Repo Analyzer
- **Purpose**: Score and tier calculation
- **Scoring Formula**:
  ```
  Total = (Growth × 0.4) + (Engagement × 0.3) + (Quality × 0.3)
  ```
- **Tier Assignment**:
  - Tier 1: Score ≥ 70 OR (stars ≥ 100 AND growth > 10%)
  - Tier 2: Score ≥ 50 OR stars ≥ 50
  - Tier 3: All others

## Security & Performance

### Rate Limiting Strategy
- **GitHub API**: 5,000 requests/hour (authenticated)
- **Claude API**: Based on Anthropic plan limits
- **Internal throttling**: 2-second delay between analyses
- **Batch processing**: 25-50 repos per operation

### Caching Architecture
- **D1 Cache**: 7-day analysis results
- **Worker Cache**: 5-minute API responses
- **Browser Cache**: Static assets with versioning
- **CDN Cache**: Cloudflare edge caching

### Error Handling Flow
```
Try Operation
  ├─ Success → Return result
  └─ Error → Log to console
       ├─ Retry with backoff (3 attempts)
       ├─ Fallback to cached data
       └─ Return error response
```

### Security Measures
- **API Keys**: Stored as Cloudflare secrets
- **CORS**: Configured for dashboard origin
- **Input Validation**: All user inputs sanitized
- **SQL Injection**: Prepared statements only
- **Rate Limiting**: Per-IP request throttling

### Performance Optimizations
- **Edge Computing**: Runs at 200+ Cloudflare locations
- **Streaming Responses**: For large datasets
- **Lazy Loading**: Dashboard components
- **Database Indexes**: On frequently queried columns
- **Connection Pooling**: Reuse database connections

## API Reference

### Authentication
All API requests require proper CORS headers. API keys are managed server-side.

### Endpoints

#### System Management
- `POST /api/agent/init` - Initialize the agent
- `GET /api/status` - System health check
- `POST /api/scan` - Manual repository scan
- `POST /api/analyze` - Analyze specific repo

#### Data Access
- `GET /api/repos/trending` - Trending repositories
- `GET /api/repos/tier?tier={1|2|3}` - Repos by tier
- `GET /api/repos/count` - Repository statistics
- `GET /api/metrics/comprehensive?repo_id={id}` - Detailed metrics

#### Reports & Alerts
- `GET /api/reports/daily` - Daily summary
- `GET /api/reports/enhanced` - Deep analysis
- `GET /api/alerts` - Recent notifications

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-01-21T12:00:00Z"
}
```

### Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Error

## Deployment Architecture

### Cloudflare Resources
- **Workers**: Edge compute runtime
- **Durable Objects**: Stateful coordination
- **D1**: SQL database
- **R2**: Object storage
- **KV**: Key-value cache (optional)

### Environment Variables
```bash
GITHUB_TOKEN=          # Required
ANTHROPIC_API_KEY=     # Required
WORKER_ENV=            # production/development
```

### Deployment Process
1. Build dashboard: `cd dashboard && npm run build`
2. Deploy worker: `wrangler deploy`
3. Initialize database: `wrangler d1 execute`
4. Start agent: `POST /api/agent/init`

## Monitoring & Debugging

### Logging
- Console logs visible in Cloudflare dashboard
- Structured logging with levels
- Request/response tracking
- Error stack traces

### Metrics
- Request count and latency
- API rate limit usage
- Database query performance
- Cache hit rates

### Debugging Tools
- Cloudflare Workers dashboard
- Wrangler tail for live logs
- D1 query console
- Browser DevTools for frontend

---

For more information, see the main [README](../README.md) or contact the development team.
