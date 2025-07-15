# Refactoring Implementation Plan

## Overview
This plan will reduce the codebase by 20-25% while fixing database schema inconsistencies and improving maintainability.

## Phase 1: Fix Critical Schema Issues (Immediate)

### 1.1 Create Schema Migration File
```sql
-- Fix table name inconsistency
ALTER TABLE pull_request_metrics RENAME TO pr_metrics;

-- Drop duplicate table
DROP TABLE IF EXISTS repo_tiers;

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_repo_metrics_lookup ON repo_metrics(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_lookup ON analyses(repo_id, created_at DESC);
```

### 1.2 Update TypeScript Types
- Ensure all boolean fields are properly handled
- Standardize JSON parsing/stringifying

## Phase 2: Consolidate Storage Services

### 2.1 Create Unified StorageService
Combine `storage.ts` and `storage-enhanced.ts` into a single service:

```typescript
// src/services/storage.ts (consolidated)
export class StorageService extends BaseService {
  // Basic repository operations
  async saveRepository(repo: Repository): Promise<void>
  async getRepository(repoId: string): Promise<Repository | null>
  
  // Metrics operations (from both services)
  async saveMetrics(metrics: RepoMetrics): Promise<void>
  async saveCommitMetrics(metrics: CommitMetrics[]): Promise<void>
  async saveReleaseMetrics(metrics: ReleaseMetrics[]): Promise<void>
  // ... etc
  
  // Analysis operations
  async saveAnalysis(analysis: Analysis): Promise<void>
  async getLatestAnalysis(repoId: string): Promise<Analysis | null>
  
  // Tier operations (from enhanced)
  async saveRepoTier(tier: RepoTier): Promise<void>
  async getReposByTier(tier: 1 | 2 | 3, limit?: number): Promise<RepoTier[]>
  
  // Comprehensive metrics
  async getComprehensiveMetrics(repoId: string): Promise<ComprehensiveMetrics>
}
```

### 2.2 Move Database Helpers to BaseService
```typescript
// src/services/base.ts
export class BaseService {
  protected env: Env;
  
  // Add database helpers
  protected async dbRun(query: string, ...params: any[]): Promise<void>
  protected async dbFirst<T>(query: string, ...params: any[]): Promise<T | null>
  protected async dbAll<T>(query: string, ...params: any[]): Promise<T[]>
  protected async dbBatch(statements: D1PreparedStatement[]): Promise<void>
  
  // Existing error handling
  protected async handleError<T>(fn: () => Promise<T>, context: string): Promise<T>
}
```

## Phase 3: Consolidate GitHub Services

### 3.1 Create Unified GitHubService
Combine `github.ts` and `github-enhanced.ts`:

```typescript
// src/services/github.ts (consolidated)
export class GitHubService extends BaseService {
  private octokit: Octokit;
  
  // Basic operations
  async searchTrendingRepos(topics: string[], minStars?: number): Promise<Repository[]>
  async getRepoDetails(owner: string, name: string): Promise<Repository>
  async getReadmeContent(owner: string, name: string): Promise<string>
  
  // Enhanced metrics (from github-enhanced)
  async getCommitActivity(owner: string, repo: string, days?: number): Promise<CommitMetrics[]>
  async getReleaseMetrics(owner: string, repo: string): Promise<ReleaseMetrics[]>
  async getPullRequestMetrics(owner: string, repo: string, days?: number): Promise<PullRequestMetrics>
  async getIssueMetrics(owner: string, repo: string, days?: number): Promise<IssueMetrics>
  async getStarHistory(owner: string, repo: string, days?: number): Promise<StarHistory[]>
  async analyzeForkNetwork(owner: string, repo: string): Promise<ForkAnalysis>
  
  // Comprehensive search
  async searchComprehensive(strategies: SearchStrategy[], limit?: number): Promise<Repository[]>
  
  // Single mapping function
  private mapGitHubRepoToRepository(repo: any): Repository
}
```

## Phase 4: Consolidate Analyzers

### 4.1 Create Unified RepoAnalyzer
Combine `repoAnalyzer.ts` and `repoAnalyzer-enhanced.ts`:

```typescript
// src/analyzers/repoAnalyzer.ts (consolidated)
export class RepoAnalyzer extends BaseService {
  // Basic analysis (keep simple method for backward compatibility)
  async analyze(repo: Repository): Promise<Score>
  
  // Enhanced analysis with metrics
  async analyzeWithMetrics(repo: Repository, metrics: EnhancedMetrics): Promise<Score>
  
  // Scoring methods
  isHighPotential(score: Score): boolean
  getRecommendedModel(score: Score): ClaudeModel
  
  // Tier assignment helpers
  calculateGrowthVelocity(currentStars: number, history: StarHistory[]): number
  calculateEngagementScoreForTier(metrics: TierMetrics): number
}
```

## Phase 5: Update GitHubAgent

### 5.1 Simplify Service Instantiation
```typescript
export class GitHubAgent extends BaseService {
  private github: GitHubService;      // Single instance
  private storage: StorageService;    // Single instance
  private analyzer: RepoAnalyzer;     // Single instance
  private claude: ClaudeService;
  
  constructor(state: DurableObjectState, env: Env) {
    super(env);
    this.state = state;
    this.github = new GitHubService(env);
    this.storage = new StorageService(env);
    this.analyzer = new RepoAnalyzer(env);
    this.claude = new ClaudeService(env);
  }
}
```

### 5.2 Update Method Calls
Replace all calls to enhanced services with unified service methods:
- `this.githubEnhanced.getCommitActivity()` → `this.github.getCommitActivity()`
- `this.storageEnhanced.saveRepoTier()` → `this.storage.saveRepoTier()`
- `this.analyzerEnhanced.analyzeWithMetrics()` → `this.analyzer.analyzeWithMetrics()`

## Phase 6: Cleanup

### 6.1 Delete Redundant Files
- `src/services/github-enhanced.ts`
- `src/services/storage-enhanced.ts`
- `src/analyzers/repoAnalyzer-enhanced.ts`

### 6.2 Update Imports
Update all files that import the deleted services to use the consolidated versions.

### 6.3 Update Tests
Ensure all tests reference the new consolidated services.

## Expected Outcomes

### Code Reduction
- **Before**: ~2,078 lines across service files
- **After**: ~1,600 lines (23% reduction)
- **Deleted Files**: 3 files (~1,390 lines)
- **Consolidated Files**: 3 files (~1,100 lines)
- **Net Savings**: ~478 lines

### Benefits
1. **Simpler Architecture**: One service per domain instead of two
2. **Easier Maintenance**: No duplicate code to keep in sync
3. **Better Performance**: Fewer service instantiations
4. **Cleaner Imports**: Single import per service type
5. **Fixed Schema**: No runtime errors from mismatched table names

### Risk Mitigation
1. **Backward Compatibility**: Keep method signatures the same
2. **Incremental Changes**: Test after each phase
3. **Database Backup**: Before schema changes
4. **Feature Flags**: Can add flags to toggle between old/new if needed

## Timeline
- Phase 1: 30 minutes (schema fixes)
- Phase 2: 2 hours (storage consolidation)
- Phase 3: 2 hours (GitHub consolidation)
- Phase 4: 1 hour (analyzer consolidation)
- Phase 5: 1 hour (GitHubAgent updates)
- Phase 6: 30 minutes (cleanup)
- Testing: 2 hours

**Total: ~9 hours of work**
