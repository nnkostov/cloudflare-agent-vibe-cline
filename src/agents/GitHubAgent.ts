import type { Env, Repository, Score, CONFIG } from '../types';
import { GitHubService } from '../services/github';
import { GitHubEnhancedService } from '../services/github-enhanced';
import { ClaudeService } from '../services/claude';
import { StorageService } from '../services/storage';
import { StorageEnhancedService } from '../services/storage-enhanced';
import { RepoAnalyzer } from '../analyzers/repoAnalyzer';
import { RepoAnalyzerEnhanced } from '../analyzers/repoAnalyzer-enhanced';
import { CONFIG as Config } from '../types';

export class GitHubAgent {
  private state: DurableObjectState;
  private env: Env;
  private github: GitHubService;
  private githubEnhanced: GitHubEnhancedService;
  private claude: ClaudeService;
  private storage: StorageService;
  private storageEnhanced: StorageEnhancedService;
  private analyzer: RepoAnalyzer;
  private analyzerEnhanced: RepoAnalyzerEnhanced;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.github = new GitHubService(env);
    this.githubEnhanced = new GitHubEnhancedService(env);
    this.claude = new ClaudeService(env);
    this.storage = new StorageService(env);
    this.storageEnhanced = new StorageEnhancedService(env);
    this.analyzer = new RepoAnalyzer(env);
    this.analyzerEnhanced = new RepoAnalyzerEnhanced(env);
  }

  /**
   * Helper method to create JSON responses
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      const handlers: Record<string, () => Promise<Response>> = {
        '/scan': () => this.handleScan(request),
        '/scan/comprehensive': () => this.handleComprehensiveScan(),
        '/analyze': () => this.handleAnalyze(request),
        '/status': () => this.handleStatus(),
        '/report': () => this.handleReport(),
        '/init': () => this.handleInit(),
        '/metrics': () => this.handleMetrics(request),
        '/tiers': () => this.handleTiers(request),
      };

      const handler = handlers[url.pathname];
      return handler ? await handler() : new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Error in GitHubAgent:', error);
      return this.jsonResponse({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 500);
    }
  }

  /**
   * Initialize agent with scheduled scanning
   */
  private async handleInit(): Promise<Response> {
    const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
    await this.state.storage.setAlarm(nextRun);
    
    return this.jsonResponse({ 
      message: 'Agent initialized',
      nextRun: new Date(nextRun).toISOString()
    });
  }

  /**
   * Handle scheduled alarm
   */
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

  /**
   * Handle manual scan request
   */
  private async handleScan(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const topics = body.topics || Config.github.topics;
    const minStars = body.minStars || Config.github.minStars;
    
    const repos = await this.scanGitHub(topics, minStars);
    
    return this.jsonResponse({ 
      message: 'Scan completed',
      repositoriesFound: repos.length,
      repositories: repos.slice(0, 10)
    });
  }

  /**
   * Handle analyze request
   */
  private async handleAnalyze(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const { repoId, repoOwner, repoName, force } = body;
    
    if (!repoId && (!repoOwner || !repoName)) {
      return this.jsonResponse({ error: 'Missing required parameters: need either repoId or repoOwner+repoName' }, 400);
    }
    
    // Get repository
    let repo: Repository;
    if (repoId) {
      const stored = await this.storage.getRepository(repoId);
      if (!stored) {
        return this.jsonResponse({ error: 'Repository not found by ID' }, 404);
      }
      repo = stored;
    } else {
      // First try to find in database
      let stored = await this.storage.getRepositoryByName(repoOwner, repoName);
      if (stored) {
        repo = stored;
      } else {
        // If not found, fetch from GitHub and save
        try {
          repo = await this.github.getRepoDetails(repoOwner, repoName);
          await this.storage.saveRepository(repo);
          console.log(`Repository ${repoOwner}/${repoName} fetched from GitHub and saved`);
        } catch (error) {
          return this.jsonResponse({ 
            error: `Repository ${repoOwner}/${repoName} not found on GitHub: ${error instanceof Error ? error.message : 'Unknown error'}` 
          }, 404);
        }
      }
    }
    
    // Check cache
    if (!force && await this.storage.hasRecentAnalysis(repo.id)) {
      const analysis = await this.storage.getLatestAnalysis(repo.id);
      return this.jsonResponse({ 
        message: 'Using cached analysis', 
        analysis,
        repository: {
          id: repo.id,
          full_name: repo.full_name,
          stars: repo.stars,
          language: repo.language
        }
      });
    }
    
    // Perform analysis
    try {
      const analysis = await this.analyzeRepository(repo);
      
      return this.jsonResponse({ 
        message: 'Analysis completed',
        analysis,
        repository: {
          id: repo.id,
          full_name: repo.full_name,
          stars: repo.stars,
          language: repo.language
        }
      });
    } catch (error) {
      console.error(`Error analyzing ${repo.full_name}:`, error);
      return this.jsonResponse({ 
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }, 500);
    }
  }

  /**
   * Handle status request
   */
  private async handleStatus(): Promise<Response> {
    const [stats, rateLimit] = await Promise.all([
      this.storage.getDailyStats(),
      this.github.checkRateLimit()
    ]);
    
    return this.jsonResponse({ 
      status: 'active',
      dailyStats: stats,
      githubRateLimit: rateLimit,
      nextScheduledRun: new Date(Date.now() + Config.github.scanInterval * 60 * 60 * 1000).toISOString()
    });
  }

  /**
   * Handle report generation
   */
  private async handleReport(): Promise<Response> {
    const [highGrowthRepos, recentAlerts, trends] = await Promise.all([
      this.storage.getHighGrowthRepos(30, 200),
      this.storage.getRecentAlerts(10),
      this.storage.getRecentTrends()
    ]);
    
    const stats = await this.storage.getDailyStats();
    
    return this.jsonResponse({
      date: new Date().toISOString(),
      highGrowthRepos: highGrowthRepos.slice(0, 10),
      recentAlerts,
      trends,
      metrics: stats
    });
  }

  /**
   * Scan GitHub for trending repositories
   */
  private async scanGitHub(
    topics: string[] = Config.github.topics,
    minStars: number = Config.github.minStars
  ): Promise<Repository[]> {
    console.log(`Scanning GitHub for topics: ${topics.join(', ')}`);
    
    const repos = await this.github.searchTrendingRepos(topics, minStars);
    
    // Save repositories and metrics
    for (const repo of repos) {
      await this.storage.saveRepository(repo);
      
      // Save basic metrics without additional API calls to avoid subrequest limits
      await this.storage.saveMetrics({
        repo_id: repo.id,
        stars: repo.stars,
        forks: repo.forks,
        open_issues: repo.open_issues,
        watchers: repo.stars, // Use stars as approximation for watchers
        contributors: Math.ceil(repo.forks * 0.1), // Estimate contributors
        commits_count: 0,
        recorded_at: new Date().toISOString()
      });
    }
    
    console.log(`Found ${repos.length} repositories`);
    return repos;
  }

  /**
   * Analyze high-potential repositories
   */
  private async analyzeHighPotentialRepos(repos?: Repository[]): Promise<void> {
    const highGrowthRepos = repos || await this.storage.getHighGrowthRepos(30, 200);
    console.log(`Analyzing ${highGrowthRepos.length} repositories`);
    
    for (const repo of highGrowthRepos.slice(0, 10)) {
      try {
        if (await this.storage.hasRecentAnalysis(repo.id)) {
          console.log(`Skipping ${repo.full_name} - recent analysis exists`);
          continue;
        }
        
        await this.analyzeRepository(repo);
        // Reduced delay - frontend handles parallel processing with rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error analyzing ${repo.full_name}:`, error);
      }
    }
  }

  /**
   * Analyze a single repository
   */
  private async analyzeRepository(repo: Repository) {
    console.log(`Analyzing repository: ${repo.full_name}`);
    
    // Get initial score
    const score = await this.analyzer.analyze(repo);
    console.log(`Score for ${repo.full_name}: ${score.total}`);
    
    // Check if worth deep analysis
    if (!this.analyzer.isHighPotential(score)) {
      console.log(`${repo.full_name} does not meet threshold for deep analysis`);
      return null;
    }
    
    // Get README and analyze
    const readme = await this.github.getReadmeContent(repo.owner, repo.name);
    const model = this.analyzer.getRecommendedModel(score);
    
    console.log(`Using model ${model} for ${repo.full_name} (score: ${score.total}, growth: ${score.growth})`);
    
    const analysis = await this.claude.analyzeRepository(repo, readme, model);
    
    // Save analysis
    await this.storage.saveAnalysis(analysis);
    
    // Generate alert if needed
    if (analysis.scores.investment >= Config.alerts.scoreThreshold || score.growth >= 90) {
      await this.storage.saveAlert({
        repo_id: repo.id,
        type: 'investment_opportunity',
        level: analysis.scores.investment >= 90 ? 'urgent' : 'high',
        message: `High-potential investment opportunity: ${repo.full_name} (Score: ${analysis.scores.investment})`,
        metadata: {
          investment_score: analysis.scores.investment,
          growth_score: score.growth,
          recommendation: analysis.recommendation,
          model_used: model,
          technical_moat: analysis.scores.technical_moat,
          scalability: analysis.scores.scalability
        }
      });
    }
    
    // Get contributors for high-scoring repos
    if (analysis.scores.investment >= 70) {
      try {
        const contributors = await this.github.getContributors(repo.owner, repo.name);
        await this.storage.saveContributors(repo.id, contributors);
      } catch (error) {
        console.error(`Error getting contributors for ${repo.full_name}:`, error);
      }
    }
    
    // Return the analysis in the format expected by the frontend
    return await this.storage.getLatestAnalysis(repo.id);
  }

  /**
   * Handle comprehensive scan request
   */
  private async handleComprehensiveScan(): Promise<Response> {
    console.log('Starting manual comprehensive scan...');
    
    try {
      const startTime = Date.now();
      await this.comprehensiveScan();
      const duration = Date.now() - startTime;
      
      return this.jsonResponse({ 
        message: 'Comprehensive scan completed',
        duration: `${Math.round(duration / 1000)}s`,
        tiers: {
          tier1: await this.storageEnhanced.getReposByTier(1, 10),
          tier2: await this.storageEnhanced.getReposByTier(2, 10),
          tier3: await this.storageEnhanced.getReposByTier(3, 10),
        }
      });
    } catch (error) {
      console.error('Error in comprehensive scan:', error);
      return this.jsonResponse({ 
        error: error instanceof Error ? error.message : 'Scan failed' 
      }, 500);
    }
  }

  /**
   * Handle metrics request
   */
  private async handleMetrics(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const repoId = url.searchParams.get('repo_id');
    
    if (!repoId) {
      return this.jsonResponse({ error: 'repo_id required' }, 400);
    }
    
    const metrics = await this.storageEnhanced.getComprehensiveMetrics(repoId);
    
    return this.jsonResponse(metrics);
  }

  /**
   * Handle tiers request
   */
  private async handleTiers(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tier = parseInt(url.searchParams.get('tier') || '1');
    
    if (![1, 2, 3].includes(tier)) {
      return this.jsonResponse({ error: 'Invalid tier. Must be 1, 2, or 3' }, 400);
    }
    
    const repos = await this.storageEnhanced.getReposByTier(tier as 1 | 2 | 3);
    
    return this.jsonResponse({ 
      tier, 
      count: repos.length, 
      repos: repos.slice(0, 100) 
    });
  }

  /**
   * Comprehensive repository scanning with tiered approach
   */
  private async comprehensiveScan(): Promise<void> {
    console.log('Starting comprehensive repository scan...');
    
    // 1. Discover new repositories using multiple strategies
    const allRepos = await this.githubEnhanced.searchComprehensive(
      Config.github.searchStrategies,
      Config.limits.reposPerScan
    );
    
    console.log(`Found ${allRepos.length} repositories across all strategies`);
    
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
    console.log('Processing Tier 1 repositories...');
    const tier1Repos = await this.storageEnhanced.getReposNeedingScan(1, 'deep');
    console.log(`Found ${tier1Repos.length} Tier 1 repos needing scan`);
    
    // Process in batches to stay within CPU limits
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < tier1Repos.length; i += BATCH_SIZE) {
      const batch = tier1Repos.slice(i, i + BATCH_SIZE);
      
      for (const repoId of batch) {
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
  }

  /**
   * Process Tier 2 repositories (basic scan)
   */
  private async processTier2Repos(): Promise<void> {
    console.log('Processing Tier 2 repositories...');
    const tier2Repos = await this.storageEnhanced.getReposNeedingScan(2, 'basic');
    console.log(`Found ${tier2Repos.length} Tier 2 repos needing scan`);
    
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < tier2Repos.length; i += BATCH_SIZE) {
      const batch = tier2Repos.slice(i, i + BATCH_SIZE);
      
      for (const repoId of batch) {
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
  }

  /**
   * Process Tier 3 repositories (minimal scan)
   */
  private async processTier3Repos(): Promise<void> {
    console.log('Processing Tier 3 repositories...');
    const tier3Repos = await this.storageEnhanced.getReposNeedingScan(3, 'basic');
    console.log(`Found ${tier3Repos.length} Tier 3 repos needing scan`);
    
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

  /**
   * Helper to save metrics with repo_id
   */
  private async saveMetricsWithRepoId(
    repoId: string, 
    metrics: {
      commits?: any[];
      releases?: any[];
      prs?: any;
      issues?: any;
      stars?: any[];
      forks?: any;
    }
  ): Promise<void> {
    if (metrics.commits) {
      await this.storageEnhanced.saveCommitMetrics(
        metrics.commits.map(c => ({ ...c, repo_id: repoId }))
      );
    }
    
    if (metrics.releases) {
      await this.storageEnhanced.saveReleaseMetrics(
        metrics.releases.map(r => ({ ...r, repo_id: repoId }))
      );
    }
    
    if (metrics.prs) {
      await this.storageEnhanced.savePullRequestMetrics({
        ...metrics.prs,
        repo_id: repoId
      });
    }
    
    if (metrics.issues) {
      await this.storageEnhanced.saveIssueMetrics({
        ...metrics.issues,
        repo_id: repoId
      });
    }
    
    if (metrics.stars) {
      await this.storageEnhanced.saveStarHistory(
        metrics.stars.map(s => ({ ...s, repo_id: repoId }))
      );
    }
    
    if (metrics.forks) {
      await this.storageEnhanced.saveForkAnalysis({
        ...metrics.forks,
        repo_id: repoId
      });
    }
  }
}

export default GitHubAgent;
