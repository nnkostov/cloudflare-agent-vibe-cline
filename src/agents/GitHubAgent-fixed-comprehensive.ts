import type { Env, Repository, Score, CONFIG } from '../types';
import { GitHubService } from '../services/github-unified';
import { ClaudeService } from '../services/claude';
import { StorageService } from '../services/storage-unified';
import { RepoAnalyzer } from '../analyzers/repoAnalyzer-unified';
import { CONFIG as Config } from '../types';

interface ScanProgress {
  phase: string;
  startTime: number;
  endTime?: number;
  repoCount: number;
  tier1: { found: number; processed: number; analyzed: number };
  tier2: { found: number; processed: number; analyzed: number };
  tier3: { found: number; processed: number };
  errors: Array<{ phase: string; error: string; stack?: string }>;
  logs: string[];
}

export class GitHubAgent {
  private state: DurableObjectState;
  private env: Env;
  private github: GitHubService;
  private claude: ClaudeService;
  private storage: StorageService;
  private analyzer: RepoAnalyzer;
  private scanProgress: ScanProgress | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.github = new GitHubService(env);
    this.claude = new ClaudeService(env);
    this.storage = new StorageService(env);
    this.analyzer = new RepoAnalyzer(env);
  }

  private log(message: string, data?: any) {
    const logMessage = `[GitHubAgent] ${new Date().toISOString()} - ${message}`;
    console.log(logMessage, data || '');
    
    if (this.scanProgress) {
      this.scanProgress.logs.push(logMessage + (data ? ` - ${JSON.stringify(data)}` : ''));
    }
  }

  private logError(phase: string, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error(`[GitHubAgent ERROR] ${phase}:`, errorMessage, stack);
    
    if (this.scanProgress) {
      this.scanProgress.errors.push({ phase, error: errorMessage, stack });
    }
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
        '/scan/comprehensive': () => this.handleComprehensiveScan(request),
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
      return this.jsonResponse({ error: 'Missing required parameters' }, 400);
    }
    
    // Get repository
    let repo: Repository;
    if (repoId) {
      const stored = await this.storage.getRepository(repoId);
      if (!stored) {
        return this.jsonResponse({ error: 'Repository not found' }, 404);
      }
      repo = stored;
    } else {
      repo = await this.github.getRepoDetails(repoOwner, repoName);
      await this.storage.saveRepository(repo);
    }
    
    // Check cache - if we have a recent analysis, return it
    const hasAnalysis = await this.storage.hasRecentAnalysis(repo.id);
    if (!force && hasAnalysis) {
      const analysis = await this.storage.getLatestAnalysis(repo.id);
      if (analysis) {
        return this.jsonResponse(analysis);
      }
    }
    
    // If no analysis exists or force is true, always analyze
    // When explicitly requested via API, we should always provide an analysis
    const analysis = await this.analyzeRepository(repo, true); // Always force when requested via API
    
    if (!analysis) {
      // If analysis still failed, return an error
      return this.jsonResponse({ 
        error: 'Failed to generate analysis for this repository' 
      }, 500);
    }
    
    return this.jsonResponse(analysis);
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
    this.log(`Scanning GitHub for topics: ${topics.join(', ')}`);
    
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
      
      // Calculate and assign initial tier
      const growthVelocity = repo.stars / Math.max(1, 
        (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      await this.storage.updateRepoTier(repo.id, {
        stars: repo.stars,
        growth_velocity: growthVelocity,
        engagement_score: 50, // Initial estimate
      });
    }
    
    this.log(`Found ${repos.length} repositories and assigned tiers`);
    
    // Analyze top repositories from the scan
    const topRepos = repos.slice(0, 5); // Analyze top 5 repos
    this.log(`Analyzing top ${topRepos.length} repositories from Quick Scan`);
    
    for (const repo of topRepos) {
      try {
        // Check if already has recent analysis
        if (await this.storage.hasRecentAnalysis(repo.id)) {
          this.log(`Skipping ${repo.full_name} - recent analysis exists`);
          continue;
        }
        
        // Analyze the repository
        this.log(`Analyzing ${repo.full_name} from Quick Scan`);
        await this.analyzeRepository(repo, true); // Force analysis
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between analyses
      } catch (error) {
        this.logError(`Error analyzing ${repo.full_name} from Quick Scan`, error);
      }
    }
    
    return repos;
  }

  /**
   * Analyze high-potential repositories
   */
  private async analyzeHighPotentialRepos(repos?: Repository[]): Promise<void> {
    const highGrowthRepos = repos || await this.storage.getHighGrowthRepos(30, 200);
    this.log(`Analyzing ${highGrowthRepos.length} repositories`);
    
    for (const repo of highGrowthRepos.slice(0, 10)) {
      try {
        if (await this.storage.hasRecentAnalysis(repo.id)) {
          this.log(`Skipping ${repo.full_name} - recent analysis exists`);
          continue;
        }
        
        await this.analyzeRepository(repo, true); // Force analysis
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
      } catch (error) {
        this.logError(`Error analyzing ${repo.full_name}`, error);
      }
    }
  }

  /**
   * Analyze a single repository
   */
  private async analyzeRepository(repo: Repository, force: boolean = false) {
    this.log(`Analyzing repository: ${repo.full_name}`);
    
    // Get initial score
    const score = await this.analyzer.analyze(repo);
    this.log(`Score for ${repo.full_name}: ${score.total}`);
    
    // For forced analysis or Tier 1 repos, always analyze
    if (!force && !this.analyzer.isHighPotential(score)) {
      this.log(`${repo.full_name} does not meet threshold for deep analysis`);
      return null;
    }
    
    // Get README and analyze
    const readme = await this.github.getReadmeContent(repo.owner, repo.name);
    const model = this.analyzer.getRecommendedModel(score);
    
    this.log(`Using model ${model} for ${repo.full_name} (score: ${score.total}, growth: ${score.growth})`);
    
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
        this.logError(`Error getting contributors for ${repo.full_name}`, error);
      }
    }
    
    return analysis;
  }

  /**
   * Handle comprehensive scan request
   */
  private async handleComprehensiveScan(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';
    const minRepos = parseInt(url.searchParams.get('min_repos') || '10');
    
    this.log(`Starting manual comprehensive scan... Force: ${force}, Min repos: ${minRepos}`);
    
    // Initialize scan progress
    this.scanProgress = {
      phase: 'initialization',
      startTime: Date.now(),
      repoCount: 0,
      tier1: { found: 0, processed: 0, analyzed: 0 },
      tier2: { found: 0, processed: 0, analyzed: 0 },
      tier3: { found: 0, processed: 0 },
      errors: [],
      logs: []
    };
    
    try {
      const result = await this.comprehensiveScan(force, minRepos);
      
      this.scanProgress.endTime = Date.now();
      const duration = this.scanProgress.endTime - this.scanProgress.startTime;
      
      this.log(`Comprehensive scan completed in ${Math.round(duration / 1000)}s`, result);
      
      return this.jsonResponse({ 
        message: 'Comprehensive scan completed',
        duration: `${Math.round(duration / 1000)}s`,
        discovered: result.discovered,
        processed: result.processed,
        analyzed: result.analyzed,
        scanMode: force ? 'forced' : 'normal',
        progress: this.scanProgress,
        tiers: {
          tier1: await this.storage.getReposByTier(1, 10),
          tier2: await this.storage.getReposByTier(2, 10),
          tier3: await this.storage.getReposByTier(3, 10),
        }
      });
    } catch (error) {
      this.logError('Comprehensive scan failed', error);
      
      if (this.scanProgress) {
        this.scanProgress.endTime = Date.now();
      }
      
      return this.jsonResponse({ 
        error: error instanceof Error ? error.message : 'Scan failed',
        progress: this.scanProgress
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
    
    const metrics = await this.storage.getComprehensiveMetrics(repoId);
    
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
    
    const repos = await this.storage.getReposByTier(tier as 1 | 2 | 3);
    
    return this.jsonResponse({ 
      tier, 
      count: repos.length, 
      repos: repos.slice(0, 100) 
    });
  }

  /**
   * Comprehensive repository scanning with tiered approach
   */
  private async comprehensiveScan(force: boolean = false, minRepos: number = 10): Promise<{ processed: number, analyzed: number, discovered: number }> {
    this.log(`Starting comprehensive repository scan... Force: ${force}, Min repos: ${minRepos}`);
    
    if (this.scanProgress) {
      this.scanProgress.phase = 'starting';
    }
    
    const startTime = Date.now();
    const MAX_RUNTIME = 45000; // 45 seconds max runtime
    let processed = 0;
    let analyzed = 0;
    let discovered = 0;
    
    try {
      // First check if we have any repos in the database
      const repoCount = await this.storage.getRepositoryCount();
      this.log(`Found ${repoCount} repositories in database`);
      
      if (this.scanProgress) {
        this.scanProgress.repoCount = repoCount;
      }
      
      // If no repos, run discovery first
      if (repoCount < 100) {
        this.log('Running discovery phase to find repositories...');
        if (this.scanProgress) {
          this.scanProgress.phase = 'discovery';
        }
        
        const repos = await this.scanGitHub();
        discovered = repos.length;
        this.log(`Discovered ${discovered} new repositories`);
      }
      
      // Process each tier with time limits
      if (this.scanProgress) {
        this.scanProgress.phase = 'tier1';
      }
      const tier1Result = await this.processTier1ReposSimplified(MAX_RUNTIME - (Date.now() - startTime), force, minRepos);
      processed += tier1Result.processed;
      analyzed += tier1Result.analyzed;
      
      if (Date.now() - startTime < MAX_RUNTIME) {
        if (this.scanProgress) {
          this.scanProgress.phase = 'tier2';
        }
        const tier2Result = await this.processTier2ReposSimplified(MAX_RUNTIME - (Date.now() - startTime), force, minRepos);
        processed += tier2Result.processed;
        analyzed += tier2Result.analyzed;
      }
      
      if (Date.now() - startTime < MAX_RUNTIME) {
        if (this.scanProgress) {
          this.scanProgress.phase = 'tier3';
        }
        const tier3Result = await this.processTier3Repos(MAX_RUNTIME - (Date.now() - startTime), force, minRepos);
        processed += tier3Result.processed;
      }
      
      // Ensure minimum repos are processed
      if (processed < minRepos && force) {
        this.log(`Only processed ${processed} repos, forcing scan to reach minimum of ${minRepos}`);
        
        // Get all repos regardless of scan status
        const allRepos = await this.storage.getHighGrowthRepos(365, 0); // Get all repos
        const remaining = minRepos - processed;
        
        for (let i = 0; i < Math.min(remaining, allRepos.length) && Date.now() - startTime < MAX_RUNTIME; i++) {
          const repo = allRepos[i];
          if (!repo || !repo.id) continue;
          
          try {
            // Update metrics
            await this.storage.saveMetrics({
              repo_id: repo.id,
              stars: repo.stars,
              forks: repo.forks,
              open_issues: repo.open_issues,
              watchers: repo.stars,
              contributors: Math.ceil(repo.forks * 0.1),
              commits_count: 0,
              recorded_at: new Date().toISOString(),
            });
            
            processed++;
            
            // Analyze if we haven't hit our analysis quota
            if (analyzed < 5 && !await this.storage.hasRecentAnalysis(repo.id)) {
              const analysis = await this.analyzeRepository(repo, true);
              if (analysis) {
                analyzed++;
              }
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (error) {
            this.logError(`Error processing additional repo ${repo.id}`, error);
          }
        }
      }
      
      this.log(`Comprehensive scan completed. Discovered: ${discovered}, Processed: ${processed}, Analyzed: ${analyzed}`);
      return { processed, analyzed, discovered };
    } catch (error) {
      this.logError('Comprehensive scan error', error);
      throw error;
    }
  }

  /**
   * Process Tier 1 repositories (simplified - skip enhanced metrics for now)
   */
  private async processTier1ReposSimplified(maxRuntime: number, force: boolean = false, minRepos: number = 10): Promise<{ processed: number, analyzed: number }> {
    this.log(`Processing Tier 1 repositories (simplified)... Force: ${force}`);
    const startTime = Date.now();
    
    try {
      const tier1Repos = await this.storage.getReposNeedingScan(1, 'deep', force);
      this.log(`Found ${tier1Repos.length} Tier 1 repos needing scan`);
      
      if (this.scanProgress) {
        this.scanProgress.tier1.found = tier1Repos.length;
      }
      
      let processed = 0;
      let analyzed = 0;
      const MAX_BATCH = force ? Math.max(10, minRepos) : 10; // In force mode, process at least minRepos
      
      for (const repoId of tier1Repos.slice(0, MAX_BATCH)) {
        if (Date.now() - startTime > maxRuntime) {
          this.log('Tier 1 processing time limit reached');
          break;
        }
        
        try {
          const repo = await this.storage.getRepository(repoId);
          if (!repo) {
            this.log(`Repository ${repoId} not found in database`);
            continue;
          }
          
          this.log(`Processing Tier 1 repo: ${repo.full_name}`);
          
          // Skip enhanced metrics collection for now - just update basic metrics
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
          
          // Basic score calculation
          const score = await this.analyzer.analyze(repo);
          
          // Update tier based on new score
          await this.storage.updateRepoTier(repoId, {
            stars: repo.stars,
            growth_velocity: score.factors?.growth_velocity || 0,
            engagement_score: score.engagement,
          });
          
          // Mark as scanned
          await this.storage.markRepoScanned(repoId, 'deep');
          
          // ALWAYS analyze Tier 1 repos with Claude AI
          this.log(`Running Claude AI analysis for Tier 1 repo: ${repo.full_name}`);
          const analysis = await this.analyzeRepository(repo, true); // Force analysis
          if (analysis) {
            analyzed++;
            this.log(`Successfully analyzed ${repo.full_name} with Claude AI`);
          }
          
          processed++;
          
          if (this.scanProgress) {
            this.scanProgress.tier1.processed = processed;
            this.scanProgress.tier1.analyzed = analyzed;
          }
          
          // Rate limiting - increased delay to avoid hitting limits
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between analyses
        } catch (error) {
          this.logError(`Error processing tier 1 repo ${repoId}`, error);
        }
      }
      
      return { processed, analyzed };
    } catch (error) {
      this.logError('Error in processTier1ReposSimplified', error);
      return { processed: 0, analyzed: 0 };
    }
  }

  /**
   * Process Tier 2 repositories (simplified)
   */
  private async processTier2ReposSimplified(maxRuntime: number, force: boolean = false, minRepos: number = 10): Promise<{ processed: number, analyzed: number }> {
    this.log(`Processing Tier 2 repositories (simplified)... Force: ${force}`);
    const startTime = Date.now();
    
    try {
      const tier2Repos = await this.storage.getReposNeedingScan(2, 'basic', force);
      this.log(`Found ${tier2Repos.length} Tier 2 repos needing scan`);
      
      if (this.scanProgress) {
        this.scanProgress.tier2.found = tier2Repos.length;
      }
      
      let processed = 0;
      let analyzed = 0;
      const MAX_BATCH = force ? Math.max(20, minRepos) : 20; // In force mode, process at least minRepos
      const ANALYZE_TOP = 5; // Analyze top 5 Tier 2 repos
      
      for (let i = 0; i < tier2Repos.length && i < MAX_BATCH; i++) {
        if (Date.now() - startTime > maxRuntime) {
          this.log('Tier 2 processing time limit reached');
          break;
        }
        
        const repoId = tier2Repos[i];
        
        try {
          const repo = await this.storage.getRepository(repoId);
          if (!repo) {
            this.log(`Repository ${repoId} not found in database`);
            continue;
          }
          
          this.log(`Processing Tier 2 repo: ${repo.full_name}`);
          
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
          
          // Basic analysis
          const score = await this.analyzer.analyze(repo);
          
          // Check for promotion to Tier 1
          if (score.growth > 70 || repo.stars >= 100) {
            await this.storage.updateRepoTier(repoId, {
              stars: repo.stars,
              growth_velocity: score.factors?.growth_velocity || 0,
              engagement_score: score.engagement,
            });
          }
          
          // Analyze top Tier 2 repos with Claude AI
          if (i < ANALYZE_TOP && !await this.storage.hasRecentAnalysis(repo.id)) {
            this.log(`Running Claude AI analysis for top Tier 2 repo: ${repo.full_name}`);
            const analysis = await this.analyzeRepository(repo, true); // Force analysis
            if (analysis) {
              analyzed++;
              this.log(`Successfully analyzed ${repo.full_name} with Claude AI`);
            }
            // Extra delay after Claude analysis
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          
          await this.storage.markRepoScanned(repoId, 'basic');
          processed++;
          
          if (this.scanProgress) {
            this.scanProgress.tier2.processed = processed;
            this.scanProgress.tier2.analyzed = analyzed;
          }
          
          // Lighter rate limiting for non-analyzed repos
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          this.logError(`Error processing tier 2 repo ${repoId}`, error);
        }
      }
      
      return { processed, analyzed };
    } catch (error) {
      this.logError('Error in processTier2ReposSimplified', error);
      return { processed: 0, analyzed: 0 };
    }
  }

  /**
   * Process Tier 3 repositories (minimal scan)
   */
  private async processTier3Repos(maxRuntime: number, force: boolean = false, minRepos: number = 10): Promise<{ processed: number }> {
    this.log(`Processing Tier 3 repositories... Force: ${force}`);
    const startTime = Date.now();
    
    try {
      const tier3Repos = await this.storage.getReposNeedingScan(3, 'basic', force);
      this.log(`Found ${tier3Repos.length} Tier 3 repos needing scan`);
      
      if (this.scanProgress) {
        this.scanProgress.tier3.found = tier3Repos.length;
      }
      
      let processed = 0;
      const MAX_BATCH = force ? Math.max(30, minRepos) : 30; // In force mode, process at least minRepos
      
      // Batch process for efficiency
      const batch = tier3Repos.slice(0, MAX_BATCH);
      
      for (const repoId of batch) {
        if (Date.now() - startTime > maxRuntime) {
          break;
        }
        
        try {
          const repo = await this.storage.getRepository(repoId);
          if (!repo) {
            this.log(`Repository ${repoId} not found in database`);
            continue;
          }
          
          this.log(`Processing Tier 3 repo: ${repo.full_name}`);
          
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
            await this.storage.updateRepoTier(repoId, {
              stars: repo.stars,
              growth_velocity: 0,
              engagement_score: 30,
            });
          }
          
          await this.storage.markRepoScanned(repoId, 'basic');
          processed++;
          
          if (this.scanProgress) {
            this.scanProgress.tier3.processed = processed;
          }
        } catch (error) {
          this.logError(`Error processing tier 3 repo ${repoId}`, error);
        }
      }
      
      return { processed };
    } catch (error) {
      this.logError('Error in processTier3Repos', error);
      return { processed: 0 };
    }
  }
}

export default GitHubAgent;
