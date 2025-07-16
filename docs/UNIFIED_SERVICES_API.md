# Unified Services API Documentation

## Overview

The unified services combine all functionality from the basic and enhanced versions into single, comprehensive service classes. This documentation covers the complete API for each unified service.

## Table of Contents

1. [GitHubService](#githubservice)
2. [StorageService](#storageservice)
3. [RepoAnalyzer](#repoanalyzer)
4. [GitHubAgent](#githubagent)

---

## GitHubService

The unified GitHub service provides comprehensive GitHub API integration with rate limiting and error handling.

### Constructor

```typescript
new GitHubService(env: Env)
```

### Methods

#### Repository Search and Discovery

##### `searchRepositories(query: string, options?: SearchOptions): Promise<Repository[]>`
Search for repositories using GitHub's search API.

**Parameters:**
- `query`: Search query string
- `options`: Optional search parameters (sort, order, per_page)

**Returns:** Array of Repository objects

##### `discoverRepositories(strategy: 'trending' | 'emerging' | 'topics', params?: any): Promise<Repository[]>`
Discover repositories using different strategies.

**Parameters:**
- `strategy`: Discovery strategy to use
- `params`: Strategy-specific parameters

**Returns:** Array of discovered repositories

##### `comprehensiveSearch(params: ComprehensiveSearchParams): Promise<Repository[]>`
Perform comprehensive repository search across multiple criteria.

**Parameters:**
- `params`: Object containing search criteria (languages, topics, star ranges, etc.)

**Returns:** Array of repositories matching criteria

#### Repository Details

##### `getRepository(owner: string, name: string): Promise<Repository | null>`
Get detailed information about a specific repository.

##### `getReadme(owner: string, name: string): Promise<string | null>`
Fetch repository README content.

##### `getContributors(owner: string, name: string, limit?: number): Promise<Contributor[]>`
Get repository contributors with optional limit.

#### Enhanced Metrics Collection

##### `getCommitActivity(owner: string, name: string, days?: number): Promise<CommitMetrics[]>`
Collect commit activity metrics for specified days.

**Parameters:**
- `days`: Number of days to analyze (default: 30)

**Returns:** Array of daily commit metrics

##### `getReleases(owner: string, name: string): Promise<ReleaseMetrics[]>`
Get all releases for a repository.

##### `getPullRequestMetrics(owner: string, name: string, days?: number): Promise<PullRequestMetrics>`
Analyze pull request activity.

##### `getIssueMetrics(owner: string, name: string, days?: number): Promise<IssueMetrics>`
Analyze issue activity and response times.

##### `getStarHistory(owner: string, name: string, days?: number): Promise<StarHistory[]>`
Track star growth over time.

##### `getForkAnalysis(owner: string, name: string): Promise<ForkAnalysis>`
Analyze fork activity and engagement.

##### `getComprehensiveMetrics(owner: string, name: string): Promise<ComprehensiveMetrics>`
Collect all available metrics in a single call.

---

## StorageService

The unified storage service handles all database operations for repositories, metrics, analyses, and alerts.

### Constructor

```typescript
new StorageService(env: Env)
```

### Methods

#### Repository Operations

##### `saveRepository(repo: Repository): Promise<void>`
Save or update a single repository.

##### `saveRepositoriesBatch(repos: Repository[]): Promise<void>`
Batch save multiple repositories for efficiency.

##### `getRepository(repoId: string): Promise<Repository | null>`
Retrieve a repository by ID.

##### `getRepositoryCount(): Promise<number>`
Get total count of repositories in database.

##### `getRepositoriesByIds(repoIds: string[]): Promise<Repository[]>`
Batch retrieve repositories by IDs.

#### Metrics Storage

##### `saveMetrics(metrics: RepoMetrics): Promise<void>`
Save basic repository metrics.

##### `saveMetricsBatch(metricsList: RepoMetrics[]): Promise<void>`
Batch save metrics.

##### `getLatestMetrics(repoId: string): Promise<RepoMetrics | null>`
Get most recent metrics for a repository.

#### Enhanced Metrics Storage

##### `saveCommitMetrics(metrics: CommitMetrics[]): Promise<void>`
Store commit activity data.

##### `getCommitMetrics(repoId: string, days?: number): Promise<CommitMetrics[]>`
Retrieve commit metrics for specified period.

##### `saveReleaseMetrics(metrics: ReleaseMetrics[]): Promise<void>`
Store release information.

##### `getReleaseMetrics(repoId: string): Promise<ReleaseMetrics[]>`
Get all releases for a repository.

##### `savePullRequestMetrics(metrics: PullRequestMetrics): Promise<void>`
Store PR analysis results.

##### `getLatestPullRequestMetrics(repoId: string): Promise<PullRequestMetrics | null>`
Get most recent PR metrics.

##### `saveIssueMetrics(metrics: IssueMetrics): Promise<void>`
Store issue analysis results.

##### `getLatestIssueMetrics(repoId: string): Promise<IssueMetrics | null>`
Get most recent issue metrics.

##### `saveStarHistory(history: StarHistory[]): Promise<void>`
Store star growth data.

##### `getStarHistory(repoId: string, days?: number): Promise<StarHistory[]>`
Retrieve star history for period.

##### `saveForkAnalysis(analysis: ForkAnalysis): Promise<void>`
Store fork analysis results.

##### `getLatestForkAnalysis(repoId: string): Promise<ForkAnalysis | null>`
Get most recent fork analysis.

#### Analysis Operations

##### `saveAnalysis(analysis: Analysis): Promise<void>`
Store AI analysis results with R2 archival.

##### `getLatestAnalysis(repoId: string): Promise<Analysis | null>`
Get most recent analysis for a repository.

##### `hasRecentAnalysis(repoId: string, hoursThreshold?: number): Promise<boolean>`
Check if repository has recent analysis.

#### Alert Management

##### `saveAlert(alert: Alert): Promise<void>`
Create a new alert.

##### `getRecentAlerts(limit?: number): Promise<Alert[]>`
Retrieve recent alerts.

#### Tier Management

##### `saveRepoTier(tier: RepoTier): Promise<void>`
Save or update repository tier assignment.

##### `getReposByTier(tier: 1 | 2 | 3, limit?: number): Promise<RepoTier[]>`
Get repositories by tier level.

##### `getRepoTier(repoId: string): Promise<RepoTier | null>`
Get tier information for a repository.

##### `updateRepoTier(repoId: string, metrics: TierMetrics): Promise<void>`
Update repository tier based on metrics.

##### `getReposNeedingScan(tier: 1 | 2 | 3, scanType: 'deep' | 'basic'): Promise<string[]>`
Get repositories due for scanning.

##### `markRepoScanned(repoId: string, scanType: 'deep' | 'basic'): Promise<void>`
Update scan timestamp.

#### Analytics

##### `getHighGrowthRepos(days?: number, minGrowthPercent?: number): Promise<Repository[]>`
Find rapidly growing repositories.

##### `getDailyStats(): Promise<DailyStats>`
Get daily activity statistics.

##### `getComprehensiveMetrics(repoId: string): Promise<ComprehensiveMetrics>`
Get all metrics for a repository.

#### Utility Operations

##### `saveContributors(repoId: string, contributors: Contributor[]): Promise<void>`
Store contributor information.

##### `saveTrend(trend: Trend): Promise<void>`
Save identified trend.

##### `getRecentTrends(type?: string, limit?: number): Promise<Trend[]>`
Retrieve recent trends.

##### `cleanupOldData(daysToKeep?: number): Promise<void>`
Remove old data for storage optimization.

---

## RepoAnalyzer

The unified repository analyzer combines basic scoring with enhanced metrics analysis.

### Constructor

```typescript
new RepoAnalyzer(env: Env)
```

### Methods

##### `analyzeRepository(repo: Repository, metrics: RepoMetrics, readme?: string): Promise<AnalysisInput>`
Perform comprehensive repository analysis.

**Returns:** Analysis input ready for AI processing, including:
- Growth metrics
- Activity scores
- Community engagement
- Code quality indicators
- Enhanced metrics (if available)

##### `calculateTier(repo: Repository, metrics: RepoMetrics, enhancedMetrics?: EnhancedMetrics): Promise<1 | 2 | 3>`
Calculate repository tier based on comprehensive metrics.

**Tier Criteria:**
- Tier 1: High-growth, high-engagement repositories
- Tier 2: Established repositories with moderate activity
- Tier 3: Lower priority or emerging repositories

##### `recommendModel(tier: 1 | 2 | 3, hasRecentAnalysis: boolean): ModelRecommendation`
Recommend appropriate AI model based on tier and analysis recency.

**Returns:** Model name and cost estimate

---

## GitHubAgent

The unified GitHub Agent Durable Object orchestrates all scanning and analysis operations.

### Constructor

```typescript
new GitHubAgent(state: DurableObjectState, env: Env)
```

### HTTP Endpoints

##### `POST /init`
Initialize the agent and start scheduled scanning.

##### `POST /scan/quick`
Trigger a quick scan of high-priority repositories.

##### `POST /scan/comprehensive`
Trigger a full comprehensive scan.

##### `POST /analyze/:repoId`
Analyze a specific repository.

##### `GET /status`
Get agent status and statistics.

### Internal Methods

##### `alarm()`
Handle scheduled scans based on tier priorities.

##### `performQuickScan()`
Scan tier 1 repositories and trending topics.

##### `performComprehensiveScan()`
Full scan including repository discovery and tier updates.

##### `analyzeRepository(repo: Repository)`
Complete analysis pipeline for a single repository.

---

## Migration Guide

### From Separate Services to Unified

1. **Update Imports**
   ```typescript
   // Old
   import { GitHubService } from './services/github';
   import { GitHubEnhancedService } from './services/github-enhanced';
   
   // New
   import { GitHubService } from './services/github-unified';
   ```

2. **Remove Duplicate Instantiation**
   ```typescript
   // Old
   const github = new GitHubService(env);
   const githubEnhanced = new GitHubEnhancedService(env);
   
   // New
   const github = new GitHubService(env);
   ```

3. **Update Method Calls**
   ```typescript
   // Old
   const commits = await githubEnhanced.getCommitActivity(owner, name);
   
   // New
   const commits = await github.getCommitActivity(owner, name);
   ```

---

## Error Handling

All services implement consistent error handling:

- **Rate Limiting**: Automatic retry with exponential backoff
- **API Errors**: Logged and gracefully handled
- **Database Errors**: Transaction rollback and error propagation
- **Network Errors**: Retry logic with timeout

---

## Performance Considerations

1. **Batch Operations**: Use batch methods when processing multiple items
2. **Caching**: Results are cached in D1 to reduce API calls
3. **Rate Limiting**: Built-in rate limiters prevent API quota exhaustion
4. **Streaming**: Large datasets use streaming for memory efficiency

---

## Best Practices

1. **Use Tier-Based Scanning**: Let the system prioritize based on repository importance
2. **Batch Operations**: Use batch save methods for multiple items
3. **Check Recent Analysis**: Avoid redundant AI analysis using `hasRecentAnalysis`
4. **Monitor Rate Limits**: Check rate limiter status before bulk operations
5. **Clean Old Data**: Regularly run cleanup to optimize storage
