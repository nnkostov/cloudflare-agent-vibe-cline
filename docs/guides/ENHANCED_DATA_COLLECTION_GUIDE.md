# Enhanced Data Collection Implementation Guide

## Overview

This guide details the implementation of enhanced GitHub data collection features that enable comprehensive monitoring of 3,500-5,000 AI/ML repositories with tiered scanning strategies.

## New Features

### 1. **Comprehensive Metrics Collection**
- **Commit Activity**: Daily commit counts, unique authors, code churn
- **Release Metrics**: Release frequency, download counts, version tracking
- **Pull Request Analytics**: Merge rates, review times, contributor diversity
- **Issue Tracking**: Response times, close rates, bug/feature ratios
- **Star History**: Growth velocity, trend analysis
- **Fork Network Analysis**: Active forks, innovation tracking

### 2. **Tiered Repository Management**
- **Tier 1 (Hot Prospects)**: 200 repos, deep scanning every 6 hours
- **Tier 2 (Rising Stars)**: 1,000 repos, basic scanning daily
- **Tier 3 (Long Tail)**: 3,000 repos, minimal scanning weekly

### 3. **Multi-Strategy Search**
- Topic-based searches (AI, LLM, agents)
- Language-specific searches (Python AI, TypeScript AI)
- Time-based searches (recent repos, trending)
- Combined strategies for comprehensive coverage

## Implementation Steps

### Step 1: Database Migration

Apply the new schema updates to add tables for enhanced metrics:

```bash
wrangler d1 execute github-agent-db --file=./schema-updates.sql
```

### Step 2: Update Existing Services

1. **Integrate Enhanced GitHub Service**
   ```typescript
   // In src/agents/GitHubAgent.ts
   import { GitHubEnhancedService } from '../services/github-enhanced';
   
   // Add to constructor
   private githubEnhanced: GitHubEnhancedService;
   
   constructor(state: DurableObjectState, env: Env) {
     // ... existing code
     this.githubEnhanced = new GitHubEnhancedService(env);
   }
   ```

2. **Integrate Enhanced Storage Service**
   ```typescript
   // In src/agents/GitHubAgent.ts
   import { StorageEnhancedService } from '../services/storage-enhanced';
   
   // Add to constructor
   private storageEnhanced: StorageEnhancedService;
   
   constructor(state: DurableObjectState, env: Env) {
     // ... existing code
     this.storageEnhanced = new StorageEnhancedService(env);
   }
   ```

3. **Integrate Enhanced Analyzer**
   ```typescript
   // In src/agents/GitHubAgent.ts
   import { RepoAnalyzerEnhanced } from '../analyzers/repoAnalyzer-enhanced';
   
   // Add to constructor
   private analyzerEnhanced: RepoAnalyzerEnhanced;
   
   constructor(state: DurableObjectState, env: Env) {
     // ... existing code
     this.analyzerEnhanced = new RepoAnalyzerEnhanced(env);
   }
   ```

### Step 3: Implement Comprehensive Scanning

Add new methods to GitHubAgent:

```typescript
/**
 * Comprehensive repository scanning with tiered approach
 */
private async comprehensiveScan(): Promise<void> {
  console.log('Starting comprehensive repository scan...');
  
  // 1. Discover new repositories using multiple strategies
  const allRepos = await this.githubEnhanced.searchComprehensive(
    CONFIG.github.searchStrategies,
    CONFIG.limits.reposPerScan
  );
  
  // 2. Save discovered repositories and assign tiers
  for (const repo of allRepos) {
    await this.storage.saveRepository(repo);
    
    // Calculate initial tier assignment
    const growthVelocity = repo.stars / Math.max(1, 
      (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    await this.storageEnhanced.updateRepoTier(repo.id, {
      stars: repo.stars,
      growth_velocity: growthVelocity,
      engagement_score: 50, // Initial estimate
    });
  }
  
  // 3. Process each tier
  await this.processTier1Repos();
  await this.processTier2Repos();
  await this.processTier3Repos();
}

/**
 * Process Tier 1 repositories (deep scan)
 */
private async processTier1Repos(): Promise<void> {
  const tier1Repos = await this.storageEnhanced.getReposNeedingScan(1, 'deep');
  
  for (const repoId of tier1Repos) {
    const repo = await this.storage.getRepository(repoId);
    if (!repo) continue;
    
    try {
      // Collect all enhanced metrics
      const [commits, releases, prs, issues, stars, forks] = await Promise.all([
        this.githubEnhanced.getCommitActivity(repo.owner, repo.name),
        this.githubEnhanced.getReleaseMetrics(repo.owner, repo.name),
        this.githubEnhanced.getPullRequestMetrics(repo.owner, repo.name),
        this.githubEnhanced.getIssueMetrics(repo.owner, repo.name),
        this.githubEnhanced.getStarHistory(repo.owner, repo.name),
        this.githubEnhanced.analyzeForkNetwork(repo.owner, repo.name),
      ]);
      
      // Save metrics with repo_id
      await this.saveMetricsWithRepoId(repoId, { commits, releases, prs, issues, stars, forks });
      
      // Analyze with enhanced metrics
      const score = await this.analyzerEnhanced.analyzeWithMetrics(repo, {
        commits, releases, pullRequests: prs, issues, stars, forks
      });
      
      // Update tier based on new score
      const growthVelocity = this.analyzerEnhanced.calculateGrowthVelocity(repo.stars, stars);
      const engagementScore = this.analyzerEnhanced.calculateEngagementScoreForTier({
        forks: repo.forks,
        issues: repo.open_issues,
        prActivity: prs?.total_prs,
        contributors: prs?.unique_contributors,
      });
      
      await this.storageEnhanced.updateRepoTier(repoId, {
        stars: repo.stars,
        growth_velocity: growthVelocity,
        engagement_score: engagementScore,
      });
      
      // Mark as scanned
      await this.storageEnhanced.markRepoScanned(repoId, 'deep');
      
      // If high potential, run Claude analysis
      if (this.analyzerEnhanced.isHighPotential(score)) {
        await this.analyzeRepository(repo);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing tier 1 repo ${repo.full_name}:`, error);
    }
  }
}

/**
 * Process Tier 2 repositories (basic scan)
 */
private async processTier2Repos(): Promise<void> {
  const tier2Repos = await this.storageEnhanced.getReposNeedingScan(2, 'basic');
  
  for (const repoId of tier2Repos) {
    const repo = await this.storage.getRepository(repoId);
    if (!repo) continue;
    
    try {
      // Collect basic metrics only
      const [stars, issues] = await Promise.all([
        this.githubEnhanced.getStarHistory(repo.owner, repo.name, 7),
        this.githubEnhanced.getIssueMetrics(repo.owner, repo.name, 7),
      ]);
      
      // Save basic metrics
      await this.storageEnhanced.saveStarHistory(
        stars.map(s => ({ ...s, repo_id: repoId }))
      );
      if (issues) {
        await this.storageEnhanced.saveIssueMetrics({ ...issues, repo_id: repoId });
      }
      
      // Check for promotion to Tier 1
      const growthVelocity = this.analyzerEnhanced.calculateGrowthVelocity(repo.stars, stars);
      if (growthVelocity > 10 || repo.stars >= 100) {
        await this.storageEnhanced.updateRepoTier(repoId, {
          stars: repo.stars,
          growth_velocity: growthVelocity,
          engagement_score: 50,
        });
      }
      
      await this.storageEnhanced.markRepoScanned(repoId, 'basic');
      
      // Lighter rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing tier 2 repo ${repo.full_name}:`, error);
    }
  }
}

/**
 * Process Tier 3 repositories (minimal scan)
 */
private async processTier3Repos(): Promise<void> {
  const tier3Repos = await this.storageEnhanced.getReposNeedingScan(3, 'basic');
  
  // Batch process for efficiency
  const batchSize = 50;
  for (let i = 0; i < tier3Repos.length; i += batchSize) {
    const batch = tier3Repos.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (repoId) => {
      const repo = await this.storage.getRepository(repoId);
      if (!repo) return;
      
      try {
        // Just update basic metrics
        await this.storage.saveMetrics({
          repo_id: repoId,
          stars: repo.stars,
          forks: repo.forks,
          open_issues: repo.open_issues,
          watchers: repo.stars,
          contributors: Math.ceil(repo.forks * 0.1),
          commits_count: 0,
          recorded_at: new Date().toISOString(),
        });
        
        // Check for promotion
        if (repo.stars >= 50) {
          await this.storageEnhanced.updateRepoTier(repoId, {
            stars: repo.stars,
            growth_velocity: 0,
            engagement_score: 30,
          });
        }
        
        await this.storageEnhanced.markRepoScanned(repoId, 'basic');
      } catch (error) {
        console.error(`Error processing tier 3 repo ${repo.full_name}:`, error);
      }
    }));
    
    // Rate limiting between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### Step 4: Update API Endpoints

Add new endpoints to expose enhanced metrics:

```typescript
// In src/index.ts, add to directHandlers
'/api/metrics/comprehensive': async (request, env) => {
  const url = new URL(request.url);
  const repoId = url.searchParams.get('repo_id');
  
  if (!repoId) {
    return jsonResponse({ error: 'repo_id required' }, 400);
  }
  
  const storage = new StorageEnhancedService(env);
  const metrics = await storage.getComprehensiveMetrics(repoId);
  
  return jsonResponse(metrics);
},

'/api/repos/tier': async (request, env) => {
  const url = new URL(request.url);
  const tier = parseInt(url.searchParams.get('tier') || '1');
  
  const storage = new StorageEnhancedService(env);
  const repos = await storage.getReposByTier(tier as 1 | 2 | 3);
  
  return jsonResponse({ tier, count: repos.length, repos });
},
```

### Step 5: Update Scheduled Scanning

Modify the alarm handler to use comprehensive scanning:

```typescript
async alarm(): Promise<void> {
  console.log('Running comprehensive scheduled scan...');
  
  try {
    await this.comprehensiveScan();
  } catch (error) {
    console.error('Error in scheduled scan:', error);
  }
  
  // Schedule next run
  const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
  await this.state.storage.setAlarm(nextRun);
}
```

## Configuration Updates

Update `CONFIG` in `src/types/index.ts` as shown in the implementation to include:
- Tiered scanning configuration
- Multi-dimensional search strategies
- Increased repository limits (3,500 total)

## Monitoring & Optimization

### API Usage Tracking
Monitor GitHub API usage to ensure we stay within limits:
```typescript
const rateLimit = await this.github.checkRateLimit();
console.log(`API calls remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
```

### Performance Metrics
Track scanning performance:
- Time per tier scan
- API calls per repository
- Cache hit rates
- Error rates by tier

### Cost Optimization
- Use GraphQL API for batch operations
- Implement smart caching (7-day for stable metrics)
- Skip unchanged repositories (use ETags)
- Batch database operations

## Benefits

1. **Comprehensive Coverage**: Monitor 3,500-5,000 repositories vs 100
2. **Smart Prioritization**: Focus deep analysis on high-potential repos
3. **Rich Metrics**: 6 new metric types for better investment decisions
4. **Scalable Architecture**: Tiered approach manages API limits efficiently
5. **Growth Detection**: Identify breakout repos early with velocity tracking

## Next Steps

1. Deploy schema updates
2. Integrate enhanced services
3. Test with small batch
4. Monitor API usage
5. Scale up gradually
6. Add external data sources (npm, social media, etc.)
