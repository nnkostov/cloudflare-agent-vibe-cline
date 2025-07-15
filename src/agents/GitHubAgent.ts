import type { Env, Repository, Score, CONFIG } from '../types';
import { GitHubService } from '../services/github';
import { ClaudeService } from '../services/claude';
import { StorageService } from '../services/storage';
import { RepoAnalyzer } from '../analyzers/repoAnalyzer';
import { BaseService } from '../services/base';
import { CONFIG as Config } from '../types';

export class GitHubAgent extends BaseService {
  private state: DurableObjectState;
  private github: GitHubService;
  private claude: ClaudeService;
  private storage: StorageService;
  private analyzer: RepoAnalyzer;

  constructor(state: DurableObjectState, env: Env) {
    super(env);
    this.state = state;
    this.github = new GitHubService(env);
    this.claude = new ClaudeService(env);
    this.storage = new StorageService(env);
    this.analyzer = new RepoAnalyzer(env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    try {
      const handlers: Record<string, () => Promise<Response>> = {
        '/scan': () => this.handleScan(request),
        '/analyze': () => this.handleAnalyze(request),
        '/status': () => this.handleStatus(),
        '/report': () => this.handleReport(),
        '/init': () => this.handleInit(),
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
    console.log('Running scheduled GitHub scan...');
    
    try {
      const repos = await this.scanGitHub();
      await this.analyzeHighPotentialRepos(repos);
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
    
    // Check cache
    if (!force && await this.storage.hasRecentAnalysis(repo.id)) {
      const analysis = await this.storage.getLatestAnalysis(repo.id);
      return this.jsonResponse({ message: 'Using cached analysis', analysis });
    }
    
    // Perform analysis
    const analysis = await this.analyzeRepository(repo);
    
    return this.jsonResponse({ 
      message: 'Analysis completed',
      analysis 
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
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
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
          recommendation: analysis.recommendation
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
    
    return analysis;
  }
}

export default GitHubAgent;
