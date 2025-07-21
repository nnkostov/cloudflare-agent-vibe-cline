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

interface BatchProgress {
  batchId: string;
  status: 'running' | 'completed' | 'failed' | 'not_found';
  total: number;
  completed: number;
  failed: number;
  currentRepository: string | null;
  startTime: number;
  estimatedCompletion: number | null;
  repositories: string[];
  results: Array<{ repo: string; status: 'success' | 'failed'; error?: string }>;
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
        '/batch/status': () => this.handleBatchStatus(request),
        '/batch/start': () => this.handleBatchStart(request),
        '/batch/stop': () => this.handleBatchStop(request),
        '/batch/clear': () => this.handleBatchClear(),
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
   * Handle scheduled alarm with schedule detection
   */
  async alarm(): Promise<void> {
    const scheduleType = this.detectScheduleType();
    console.log(`Running scheduled ${scheduleType} operation...`);
    
    try {
      if (scheduleType === 'daily') {
        await this.runDailyComprehensiveSweep();
      } else {
        // Hourly: Comprehensive scan + Batch analysis
        await this.runHourlyOperations();
      }
    } catch (error) {
      console.error(`Error in scheduled ${scheduleType} operation:`, error);
    }
    
    // Schedule next run
    const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
    await this.state.storage.setAlarm(nextRun);
  }

  /**
   * Detect which schedule triggered this alarm
   */
  private detectScheduleType(): 'hourly' | 'daily' {
    const now = new Date();
    const hour = now.getHours();
    
    // Comprehensive sweep at 2 AM and 2 PM (every 12 hours)
    if (hour === 2 || hour === 14) {
      return 'daily';
    }
    
    // All other hours are hourly operations
    return 'hourly';
  }

  /**
   * Run hourly operations: Comprehensive scan + Batch analysis
   */
  private async runHourlyOperations(): Promise<void> {
    console.log('Starting hourly operations: Comprehensive scan + Batch analysis');
    const startTime = Date.now();
    const MAX_RUNTIME = 300000; // 5 minutes
    
    try {
      // Phase 1: Run comprehensive scan (0-3 minutes)
      console.log('Phase 1: Running comprehensive scan...');
      const comprehensiveResult = await this.comprehensiveScan(false, 10);
      const phase1Duration = Date.now() - startTime;
      
      console.log(`Phase 1 completed in ${Math.round(phase1Duration / 1000)}s:`, comprehensiveResult);
      
      // Phase 2: Run batch analysis if time permits (3-5 minutes)
      const remainingTime = MAX_RUNTIME - phase1Duration;
      if (remainingTime > 30000) { // At least 30 seconds remaining
        console.log(`Phase 2: Running batch analysis with ${Math.round(remainingTime / 1000)}s remaining...`);
        const batchResult = await this.runHourlyBatchAnalysis(remainingTime);
        
        console.log(`Phase 2 completed: ${batchResult} additional repositories analyzed`);
      } else {
        console.log('Phase 2 skipped: Insufficient time remaining');
      }
      
      const totalDuration = Date.now() - startTime;
      console.log(`Hourly operations completed in ${Math.round(totalDuration / 1000)}s`);
      
    } catch (error) {
      console.error('Error in hourly operations:', error);
      throw error;
    }
  }

  /**
   * Run daily comprehensive sweep: Full coverage analysis
   */
  private async runDailyComprehensiveSweep(): Promise<void> {
    console.log('Starting comprehensive sweep (runs every 12 hours): Full coverage analysis');
    const startTime = Date.now();
    
    try {
      // Run comprehensive scan in force mode with higher targets
      const result = await this.comprehensiveScan(true, 50);
      
      // Run additional batch analysis for complete coverage
      const remainingTime = 300000 - (Date.now() - startTime);
      if (remainingTime > 30000) {
        const batchResult = await this.runComprehensiveBatchAnalysis(remainingTime);
        console.log(`Daily sweep batch analysis: ${batchResult} additional repositories analyzed`);
      }
      
      const totalDuration = Date.now() - startTime;
      console.log(`Daily comprehensive sweep completed in ${Math.round(totalDuration / 1000)}s:`, result);
      
    } catch (error) {
      console.error('Error in daily comprehensive sweep:', error);
      throw error;
    }
  }

  /**
   * Run hourly batch analysis for unanalyzed repositories
   */
  private async runHourlyBatchAnalysis(maxRuntime: number): Promise<number> {
    console.log(`Starting hourly batch analysis with ${Math.round(maxRuntime / 1000)}s available`);
    const startTime = Date.now();
    let analyzed = 0;
    
    try {
      // Get repositories needing analysis, prioritized by staleness
      const unanalyzedRepos = await this.getRepositoriesNeedingAnalysis(25); // Target 25 repos per hour
      
      if (unanalyzedRepos.length === 0) {
        console.log('No repositories need analysis at this time');
        return 0;
      }
      
      console.log(`Found ${unanalyzedRepos.length} repositories needing analysis`);
      
      // Process repositories with time management
      for (const repo of unanalyzedRepos) {
        if (Date.now() - startTime > maxRuntime - 10000) { // Leave 10s buffer
          console.log('Hourly batch analysis time limit reached');
          break;
        }
        
        try {
          console.log(`Batch analyzing: ${repo.full_name}`);
          const analysis = await this.analyzeRepository(repo, true);
          
          if (analysis) {
            analyzed++;
            console.log(`✅ Batch analyzed: ${repo.full_name}`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Failed to batch analyze ${repo.full_name}:`, error);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`Hourly batch analysis completed: ${analyzed} repositories analyzed in ${Math.round(duration / 1000)}s`);
      
      return analyzed;
      
    } catch (error) {
      console.error('Error in hourly batch analysis:', error);
      return analyzed;
    }
  }

  /**
   * Run comprehensive batch analysis for daily sweep
   */
  private async runComprehensiveBatchAnalysis(maxRuntime: number): Promise<number> {
    console.log(`Starting comprehensive batch analysis with ${Math.round(maxRuntime / 1000)}s available`);
    const startTime = Date.now();
    let analyzed = 0;
    
    try {
      // Get all repositories needing analysis for complete coverage
      const unanalyzedRepos = await this.getRepositoriesNeedingAnalysis(100); // Target 100 repos for daily sweep
      
      if (unanalyzedRepos.length === 0) {
        console.log('All repositories have recent analysis');
        return 0;
      }
      
      console.log(`Found ${unanalyzedRepos.length} repositories needing analysis for daily sweep`);
      
      // Process repositories with time management
      for (const repo of unanalyzedRepos) {
        if (Date.now() - startTime > maxRuntime - 10000) { // Leave 10s buffer
          console.log('Daily batch analysis time limit reached');
          break;
        }
        
        try {
          console.log(`Daily batch analyzing: ${repo.full_name}`);
          const analysis = await this.analyzeRepository(repo, true);
          
          if (analysis) {
            analyzed++;
            console.log(`✅ Daily batch analyzed: ${repo.full_name}`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Failed to daily batch analyze ${repo.full_name}:`, error);
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`Daily batch analysis completed: ${analyzed} repositories analyzed in ${Math.round(duration / 1000)}s`);
      
      return analyzed;
      
    } catch (error) {
      console.error('Error in comprehensive batch analysis:', error);
      return analyzed;
    }
  }

  /**
   * Get repositories that need analysis, prioritized by staleness
   */
  private async getRepositoriesNeedingAnalysis(limit: number): Promise<Repository[]> {
    try {
      // Query for repositories without recent analysis, ordered by staleness
      const query = `
        SELECT r.* FROM repositories r
        LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
        LEFT JOIN analyses a ON r.id = a.repo_id AND a.created_at > datetime('now', '-7 days')
        WHERE a.id IS NULL
        AND rt.tier IS NOT NULL
        ORDER BY 
          rt.tier ASC,  -- Prioritize higher tiers
          r.stars DESC, -- Then by popularity
          r.updated_at DESC -- Then by recent activity
        LIMIT ?
      `;
      
      const results = await this.env.DB.prepare(query).bind(limit).all();
      
      if (!results.results || results.results.length === 0) {
        return [];
      }
      
      // Convert database results to Repository objects
      return results.results.map((result: any) => ({
        id: String(result.id),
        name: String(result.name),
        owner: String(result.owner),
        full_name: String(result.full_name),
        description: String(result.description || ''),
        stars: Number(result.stars || 0),
        forks: Number(result.forks || 0),
        open_issues: Number(result.open_issues || 0),
        language: String(result.language || ''),
        topics: Array.isArray(result.topics) ? result.topics : JSON.parse(String(result.topics || '[]')),
        created_at: String(result.created_at),
        updated_at: String(result.updated_at),
        pushed_at: String(result.pushed_at),
        is_archived: Boolean(result.is_archived),
        is_fork: Boolean(result.is_fork),
        html_url: String(result.html_url || ''),
        clone_url: String(result.clone_url || ''),
        default_branch: String(result.default_branch || 'main'),
      })) as Repository[];
      
    } catch (error) {
      console.error('Error getting repositories needing analysis:', error);
      return [];
    }
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
        return this.jsonResponse({ 
          message: 'Using cached analysis', 
          analysis,
          repository: {
            id: repo.id,
            full_name: repo.full_name,
            description: repo.description,
            stars: repo.stars,
            forks: repo.forks,
            language: repo.language,
            topics: repo.topics
          }
        });
      }
    }
    
    // If no analysis exists or force is true, always analyze
    // When explicitly requested via API, we should always provide an analysis
    const generatedAnalysis = await this.analyzeRepository(repo, true); // Always force when requested via API
    
    if (!generatedAnalysis) {
      // If analysis still failed, return an error
      return this.jsonResponse({ 
        error: 'Failed to generate analysis for this repository' 
      }, 500);
    }
    
    // Small delay to ensure database write is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Fetch the saved analysis from database to ensure we have complete data
    const savedAnalysis = await this.storage.getLatestAnalysis(repo.id);
    
    if (!savedAnalysis) {
      // Fallback to the generated analysis if retrieval fails
      return this.jsonResponse({ 
        message: 'Analysis completed',
        analysis: {
          repo_id: repo.id,
          investment_score: generatedAnalysis.scores.investment,
          innovation_score: generatedAnalysis.scores.innovation,
          team_score: generatedAnalysis.scores.team,
          market_score: generatedAnalysis.scores.market,
          recommendation: generatedAnalysis.recommendation,
          summary: generatedAnalysis.summary,
          strengths: generatedAnalysis.strengths,
          risks: generatedAnalysis.risks,
          key_questions: generatedAnalysis.questions,
          model_used: generatedAnalysis.metadata.model,
          analyzed_at: new Date().toISOString()
        },
        repository: {
          id: repo.id,
          full_name: repo.full_name,
          description: repo.description,
          stars: repo.stars,
          forks: repo.forks,
          language: repo.language,
          topics: repo.topics
        }
      });
    }
    
    return this.jsonResponse({ 
      message: 'Analysis completed',
      analysis: savedAnalysis,
      repository: {
        id: repo.id,
        full_name: repo.full_name,
        description: repo.description,
        stars: repo.stars,
        forks: repo.forks,
        language: repo.language,
        topics: repo.topics
      }
    });
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
    minStars: number = Config.github.minStars,
    limit: number = 1000
  ): Promise<Repository[]> {
    this.log(`Scanning GitHub for topics: ${topics.join(', ')}, limit: ${limit}`);
    
    const repos = await this.github.searchTrendingRepos(topics, minStars, undefined, limit);
    
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
    const isManual = true; // This is always a manual scan from the UI
    
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
      // Pass isManual flag to use reduced limits
      const result = await this.comprehensiveScan(force, minRepos, isManual);
      
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
   * Handle batch status request
   */
  private async handleBatchStatus(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const { batchId } = body;
    
    if (!batchId) {
      return this.jsonResponse({ error: 'batchId required' }, 400);
    }
    
    // Get batch progress from Durable Object storage
    const batchProgress = await this.state.storage.get(`batch_${batchId}`) as BatchProgress | undefined;
    
    if (!batchProgress) {
      return this.jsonResponse({ 
        error: 'Batch not found',
        batchId,
        status: 'not_found'
      }, 404);
    }
    
    return this.jsonResponse({
      batchId,
      status: batchProgress.status,
      progress: {
        total: batchProgress.total,
        completed: batchProgress.completed,
        failed: batchProgress.failed,
        currentRepository: batchProgress.currentRepository,
        startTime: batchProgress.startTime,
        estimatedCompletion: batchProgress.estimatedCompletion
      }
    });
  }

  /**
   * Handle batch start request
   */
  private async handleBatchStart(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const { batchId, repositories } = body;
    
    if (!batchId || !repositories || !Array.isArray(repositories)) {
      return this.jsonResponse({ error: 'batchId and repositories array required' }, 400);
    }
    
    console.log(`Starting batch analysis ${batchId} with ${repositories.length} repositories`);
    
    // Start the batch analysis
    await this.startBatchAnalysis(batchId, repositories);
    
    return this.jsonResponse({
      message: 'Batch analysis started',
      batchId,
      repositoryCount: repositories.length
    });
  }

  /**
   * Start batch analysis with progress tracking
   */
  async startBatchAnalysis(batchId: string, repositories: string[]): Promise<void> {
    const batchProgress: BatchProgress = {
      batchId,
      status: 'running',
      total: repositories.length,
      completed: 0,
      failed: 0,
      currentRepository: repositories.length > 0 ? repositories[0] : null,
      startTime: Date.now(),
      estimatedCompletion: null,
      repositories,
      results: []
    };
    
    // Store initial batch progress
    await this.state.storage.put(`batch_${batchId}`, batchProgress);
    
    // Process repositories in background
    this.processBatchAnalysis(batchProgress).catch(error => {
      console.error(`Batch ${batchId} failed:`, error);
      this.updateBatchStatus(batchId, 'failed');
    });
  }

  /**
   * Process batch analysis with real-time progress updates
   */
  private async processBatchAnalysis(batchProgress: BatchProgress): Promise<void> {
    const { batchId, repositories } = batchProgress;
    const DELAY_BETWEEN_ANALYSES = 2000; // 2 seconds
    const MAX_RETRIES = 2;
    const ANALYSIS_TIMEOUT = 120000; // 2 minutes per repository
    
    console.log(`[${batchId}] Starting batch analysis of ${repositories.length} repositories`);
    
    for (let i = 0; i < repositories.length; i++) {
      const repoFullName = repositories[i];
      
      try {
        // Update current repository
        batchProgress.currentRepository = repoFullName;
        batchProgress.estimatedCompletion = batchProgress.startTime + 
          ((Date.now() - batchProgress.startTime) / (i + 1)) * repositories.length;
        
        await this.state.storage.put(`batch_${batchId}`, batchProgress);
        
        console.log(`[${batchId}] Analyzing ${repoFullName} (${i + 1}/${repositories.length})`);
        
        // Get repository from database by full_name
        const [owner, name] = repoFullName.split('/');
        let repo = await this.getRepositoryByFullName(repoFullName);
        
        if (!repo) {
          // Try to fetch from GitHub if not in database
          try {
            repo = await this.github.getRepoDetails(owner, name);
            await this.storage.saveRepository(repo);
          } catch (error) {
            console.error(`[${batchId}] Failed to fetch ${repoFullName}:`, error);
            batchProgress.failed++;
            batchProgress.results.push({
              repo: repoFullName,
              status: 'failed',
              error: 'Repository not found'
            });
            continue;
          }
        }
        
        // Retry logic for analysis
        let lastError = null;
        let success = false;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Add timeout protection
            const analysisPromise = this.analyzeRepository(repo, true);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Analysis timeout')), ANALYSIS_TIMEOUT)
            );
            
            const analysis = await Promise.race([analysisPromise, timeoutPromise]);
            if (analysis) {
              batchProgress.completed++;
              batchProgress.results.push({
                repo: repoFullName,
                status: 'success'
              });
              success = true;
              console.log(`[${batchId}] ✅ Successfully analyzed ${repoFullName}`);
              break;
            }
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error';
            console.log(`[${batchId}] ❌ Failed to analyze ${repoFullName} (attempt ${attempt}): ${lastError}`);
            
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          }
        }
        
        if (!success) {
          batchProgress.failed++;
          batchProgress.results.push({
            repo: repoFullName,
            status: 'failed',
            error: lastError || 'Analysis failed'
          });
        }
        
        // Update progress
        await this.state.storage.put(`batch_${batchId}`, batchProgress);
        
        // Rate limiting
        if (i < repositories.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ANALYSES));
        }
        
      } catch (error) {
        console.error(`[${batchId}] Error processing ${repoFullName}:`, error);
        batchProgress.failed++;
        batchProgress.results.push({
          repo: repoFullName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        await this.state.storage.put(`batch_${batchId}`, batchProgress);
      }
    }
    
    // Mark batch as completed
    batchProgress.status = 'completed';
    batchProgress.currentRepository = null;
    await this.state.storage.put(`batch_${batchId}`, batchProgress);
    
    const successRate = Math.round((batchProgress.completed / batchProgress.total) * 100);
    console.log(`[${batchId}] 🎉 Batch analysis completed: ${batchProgress.completed} successful, ${batchProgress.failed} failed (${successRate}% success rate)`);
  }

  /**
   * Update batch status
   */
  private async updateBatchStatus(batchId: string, status: 'running' | 'completed' | 'failed'): Promise<void> {
    const batchProgress = await this.state.storage.get(`batch_${batchId}`) as BatchProgress | undefined;
    if (batchProgress) {
      batchProgress.status = status;
      await this.state.storage.put(`batch_${batchId}`, batchProgress);
    }
  }

  /**
   * Get repository by full name (owner/name)
   */
  private async getRepositoryByFullName(fullName: string): Promise<Repository | null> {
    // Query the database for a repository with the matching full_name
    const result = await this.env.DB.prepare(
      'SELECT * FROM repositories WHERE full_name = ?'
    ).bind(fullName).first();
    
    if (!result) {
      return null;
    }
    
    // Parse the repository data
    return {
      id: String(result.id),
      name: String(result.name),
      owner: String(result.owner),
      full_name: String(result.full_name),
      description: String(result.description || ''),
      stars: Number(result.stars || 0),
      forks: Number(result.forks || 0),
      open_issues: Number(result.open_issues || 0),
      language: String(result.language || ''),
      topics: Array.isArray(result.topics) ? result.topics : JSON.parse(String(result.topics || '[]')),
      created_at: String(result.created_at),
      updated_at: String(result.updated_at),
      pushed_at: String(result.pushed_at),
      is_archived: Boolean(result.is_archived),
      is_fork: Boolean(result.is_fork),
      html_url: String(result.html_url || ''),
      clone_url: String(result.clone_url || ''),
      default_branch: String(result.default_branch || 'main'),
    } as Repository;
  }

  /**
   * Comprehensive repository scanning with tiered approach - Optimized for Paid Cloudflare Plan
   */
  private async comprehensiveScan(force: boolean = false, minRepos: number = 10, isManual: boolean = false): Promise<{ processed: number, analyzed: number, discovered: number }> {
    this.log(`Starting comprehensive repository scan (Paid Plan Optimized)... Force: ${force}, Min repos: ${minRepos}, Manual: ${isManual}`);
    
    if (this.scanProgress) {
      this.scanProgress.phase = 'starting';
    }
    
    const startTime = Date.now();
    const MAX_RUNTIME = 300000; // 5 minutes max runtime (Paid Plan: 30s CPU + 1000 subrequests)
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
      
      // Run discovery phase to find new repositories
      // Always run discovery in force mode, or periodically in normal mode
      if (force || repoCount === 0 || Math.random() < 0.3) { // 30% chance in normal mode
        this.log('Running discovery phase to find repositories...');
        if (this.scanProgress) {
          this.scanProgress.phase = 'discovery';
        }
        
        // Use reduced limit for manual scans to avoid subrequest limit
        const discoveryLimit = isManual ? 200 : 1000;
        const repos = await this.scanGitHub(Config.github.topics, Config.github.minStars, discoveryLimit);
        discovered = repos.length;
        this.log(`Discovered ${discovered} new repositories (limit: ${discoveryLimit})`);
      }
      
      // Process each tier with time limits
      if (this.scanProgress) {
        this.scanProgress.phase = 'tier1';
      }
      const tier1Result = await this.processTier1ReposSimplified(MAX_RUNTIME - (Date.now() - startTime), force, minRepos, isManual);
      processed += tier1Result.processed;
      analyzed += tier1Result.analyzed;
      
      if (Date.now() - startTime < MAX_RUNTIME) {
        if (this.scanProgress) {
          this.scanProgress.phase = 'tier2';
        }
        const tier2Result = await this.processTier2ReposSimplified(MAX_RUNTIME - (Date.now() - startTime), force, minRepos, isManual);
        processed += tier2Result.processed;
        analyzed += tier2Result.analyzed;
      }
      
      if (Date.now() - startTime < MAX_RUNTIME) {
        if (this.scanProgress) {
          this.scanProgress.phase = 'tier3';
        }
        const tier3Result = await this.processTier3Repos(MAX_RUNTIME - (Date.now() - startTime), force, minRepos, isManual);
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
  private async processTier1ReposSimplified(maxRuntime: number, force: boolean = false, minRepos: number = 10, isManual: boolean = false): Promise<{ processed: number, analyzed: number }> {
    this.log(`Processing Tier 1 repositories (simplified)... Force: ${force}, Manual: ${isManual}`);
    const startTime = Date.now();
    
    try {
      const tier1Repos = await this.storage.getReposNeedingScan(1, 'deep', force);
      this.log(`Found ${tier1Repos.length} Tier 1 repos needing scan`);
      
      if (this.scanProgress) {
        this.scanProgress.tier1.found = tier1Repos.length;
      }
      
      let processed = 0;
      let analyzed = 0;
      // Use reduced limits for manual scans to avoid subrequest limit
      const MAX_BATCH = isManual ? 10 : (force ? Math.max(25, minRepos) : 25);
      
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
          
          // Rate limiting - optimized for paid plan (reduced from 3s to 2s)
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds between analyses
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
  private async processTier2ReposSimplified(maxRuntime: number, force: boolean = false, minRepos: number = 10, isManual: boolean = false): Promise<{ processed: number, analyzed: number }> {
    this.log(`Processing Tier 2 repositories (simplified)... Force: ${force}, Manual: ${isManual}`);
    const startTime = Date.now();
    
    try {
      const tier2Repos = await this.storage.getReposNeedingScan(2, 'basic', force);
      this.log(`Found ${tier2Repos.length} Tier 2 repos needing scan`);
      
      if (this.scanProgress) {
        this.scanProgress.tier2.found = tier2Repos.length;
      }
      
      let processed = 0;
      let analyzed = 0;
      // Use reduced limits for manual scans to avoid subrequest limit
      const MAX_BATCH = isManual ? 20 : (force ? Math.max(50, minRepos) : 50);
      const ANALYZE_TOP = isManual ? 3 : 10; // Reduce analysis count for manual scans
      
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
            // Extra delay after Claude analysis - optimized for paid plan
            await new Promise(resolve => setTimeout(resolve, 2000));
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
   * Handle batch stop request - stops a running batch
   */
  private async handleBatchStop(request: Request): Promise<Response> {
    const body = await request.json() as any;
    const { batchId } = body;
    
    if (!batchId) {
      return this.jsonResponse({ error: 'batchId required' }, 400);
    }
    
    console.log(`Stopping batch analysis ${batchId}`);
    
    // Get batch progress
    const batchProgress = await this.state.storage.get(`batch_${batchId}`) as BatchProgress | undefined;
    
    if (!batchProgress) {
      return this.jsonResponse({ 
        error: 'Batch not found',
        batchId,
        status: 'not_found'
      }, 404);
    }
    
    // Update status to failed/stopped
    batchProgress.status = 'failed';
    await this.state.storage.put(`batch_${batchId}`, batchProgress);
    
    return this.jsonResponse({
      message: 'Batch analysis stopped',
      batchId,
      stoppedAt: {
        completed: batchProgress.completed,
        failed: batchProgress.failed,
        total: batchProgress.total,
        currentRepository: batchProgress.currentRepository
      }
    });
  }

  /**
   * Handle batch clear request - clears all batch data
   */
  private async handleBatchClear(): Promise<Response> {
    console.log('Clearing all batch data');
    
    // Get all keys that start with "batch_"
    const allKeys = await this.state.storage.list({ prefix: 'batch_' });
    
    let clearedCount = 0;
    for (const [key, value] of allKeys) {
      await this.state.storage.delete(key);
      clearedCount++;
    }
    
    return this.jsonResponse({
      message: 'All batch data cleared',
      batchesCleared: clearedCount
    });
  }

  /**
   * Process Tier 3 repositories (minimal scan)
   */
  private async processTier3Repos(maxRuntime: number, force: boolean = false, minRepos: number = 10, isManual: boolean = false): Promise<{ processed: number }> {
    this.log(`Processing Tier 3 repositories... Force: ${force}, Manual: ${isManual}`);
    const startTime = Date.now();
    
    try {
      const tier3Repos = await this.storage.getReposNeedingScan(3, 'basic', force);
      this.log(`Found ${tier3Repos.length} Tier 3 repos needing scan`);
      
      if (this.scanProgress) {
        this.scanProgress.tier3.found = tier3Repos.length;
      }
      
      let processed = 0;
      // Use reduced limits for manual scans to avoid subrequest limit
      const MAX_BATCH = isManual ? 30 : (force ? Math.max(100, minRepos) : 100);
      
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
