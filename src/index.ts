import type { Env } from './types';
import { BaseService } from './services/base';
import { StreamProcessor } from './utils/streamProcessor';
import { PerformanceMonitor } from './utils/performanceMonitor';

// Re-export the Durable Object
export { GitHubAgent } from './agents/GitHubAgent';

class WorkerService extends BaseService {
  private corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  private performanceMonitor: PerformanceMonitor;

  constructor(env: Env) {
    super(env);
    this.performanceMonitor = new PerformanceMonitor();
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: this.corsHeaders });
    }
    
    // Route API requests
    if (url.pathname.startsWith('/api/')) {
      return this.handleApiRequest(request, url.pathname);
    }
    
    // Default response
    return new Response(
      JSON.stringify({
        name: 'GitHub AI Intelligence Agent',
        version: '1.0.0',
        endpoints: {
          '/api/scan': 'POST - Scan GitHub for trending AI repositories',
          '/api/scan/comprehensive': 'POST - Run comprehensive tiered scan',
          '/api/analyze': 'POST - Analyze a specific repository',
          '/api/repos/trending': 'GET - Get trending repositories',
          '/api/repos/tier': 'GET - Get repositories by tier (1, 2, or 3)',
          '/api/metrics/comprehensive': 'GET - Get comprehensive metrics for a repository',
          '/api/alerts': 'GET - Get recent alerts',
          '/api/reports/daily': 'GET - Get daily report',
          '/api/reports/enhanced': 'GET - Get enhanced report with tier metrics',
          '/api/status': 'GET - Get system status',
          '/api/agent/init': 'POST - Initialize the agent'
        }
      }),
      { headers: { 'Content-Type': 'application/json', ...this.corsHeaders } }
    );
  }

  private async handleApiRequest(request: Request, pathname: string): Promise<Response> {
    const agentPath = pathname.replace('/api', '');
    
    // Handle direct endpoints
    const directHandlers: Record<string, () => Promise<Response>> = {
      '/repos/trending': () => this.handleTrendingRepos(),
      '/repos/tier': () => this.handleReposByTier(request),
      '/metrics/comprehensive': () => this.handleComprehensiveMetrics(request),
      '/alerts': () => this.handleAlerts(),
      '/reports/daily': () => this.handleDailyReport(),
      '/reports/enhanced': () => this.handleEnhancedReport(),
      '/agent/init': () => this.handleAgentInit(),
      '/status': () => this.handleStatus(),
    };

    const handler = directHandlers[agentPath];
    if (handler) {
      return handler();
    }

    // Forward to Durable Object
    const id = this.env.GITHUB_AGENT.idFromName('main');
    const agent = this.env.GITHUB_AGENT.get(id);
    const agentUrl = new URL(request.url);
    agentUrl.pathname = agentPath;
    return agent.fetch(new Request(agentUrl, request));
  }

  private async handleTrendingRepos(): Promise<Response> {
    return this.performanceMonitor.monitor('handleTrendingRepos', async () => {
      return this.handleError(async () => {
        const { StorageService } = await import('./services/storage');
        const storage = new StorageService(this.env);
        
        const repos = await storage.getHighGrowthRepos(30, 200);
        
        // For large datasets, use streaming
        if (repos.length > 50) {
          const stream = StreamProcessor.createJSONStream();
          const writer = stream.writable.getWriter();
          
          // Write opening
          await writer.write(new TextEncoder().encode('{"repositories":['));
          
          // Stream repositories with analysis
          for (let i = 0; i < Math.min(repos.length, 100); i++) {
            const repo = repos[i];
            const analysis = await storage.getLatestAnalysis(repo.id);
            const repoData = { ...repo, latest_analysis: analysis };
            
            if (i > 0) await writer.write(new TextEncoder().encode(','));
            await writer.write(new TextEncoder().encode(JSON.stringify(repoData)));
          }
          
          // Write closing
          await writer.write(new TextEncoder().encode(`],"total":${repos.length}}`));
          await writer.close();
          
          return new Response(stream.readable, {
            headers: {
              'Content-Type': 'application/json',
              'Transfer-Encoding': 'chunked',
              ...this.corsHeaders
            }
          });
        }
        
        // For smaller datasets, use regular response
        const reposWithAnalysis = await Promise.all(
          repos.slice(0, 20).map(async (repo) => ({
            ...repo,
            latest_analysis: await storage.getLatestAnalysis(repo.id)
          }))
        );
        
        return this.jsonResponse({
          repositories: reposWithAnalysis,
          total: repos.length
        });
      }, 'get trending repos');
    });
  }

  private async handleAlerts(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage');
      const storage = new StorageService(this.env);
      const alerts = await storage.getRecentAlerts(50);
      return this.jsonResponse({ alerts });
    }, 'get alerts');
  }

  private async handleDailyReport(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage');
      const storage = new StorageService(this.env);
      
      const [highGrowthRepos, recentAlerts, trends, stats] = await Promise.all([
        storage.getHighGrowthRepos(1, 500),
        storage.getRecentAlerts(20),
        storage.getRecentTrends(),
        storage.getDailyStats()
      ]);
      
      // Get investment opportunities
      const opportunities = [];
      for (const repo of highGrowthRepos.slice(0, 5)) {
        const analysis = await storage.getLatestAnalysis(repo.id);
        if (analysis && analysis.scores.investment >= 80) {
          opportunities.push({
            repository: repo,
            analysis: {
              investment_score: analysis.scores.investment,
              recommendation: analysis.recommendation,
              strengths: analysis.strengths.slice(0, 3),
              summary: analysis.summary
            }
          });
        }
      }
      
      return this.jsonResponse({
        date: new Date().toISOString(),
        high_growth_repos: highGrowthRepos.slice(0, 10).map(repo => ({
          name: repo.full_name,
          stars: repo.stars,
          language: repo.language,
          topics: repo.topics
        })),
        investment_opportunities: opportunities,
        new_trends: trends,
        recent_alerts: recentAlerts.slice(0, 5),
        metrics: stats
      });
    }, 'generate daily report');
  }

  private async handleReposByTier(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const tier = parseInt(url.searchParams.get('tier') || '1');
      
      if (![1, 2, 3].includes(tier)) {
        return this.jsonResponse({ error: 'Invalid tier. Must be 1, 2, or 3' }, 400);
      }
      
      const { StorageEnhancedService } = await import('./services/storage-enhanced');
      const storage = new StorageEnhancedService(this.env);
      const repos = await storage.getReposByTier(tier as 1 | 2 | 3);
      
      return this.jsonResponse({ 
        tier, 
        count: repos.length, 
        repos: repos.slice(0, 100) 
      });
    }, 'get repos by tier');
  }

  private async handleComprehensiveMetrics(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const repoId = url.searchParams.get('repo_id');
      
      if (!repoId) {
        return this.jsonResponse({ error: 'repo_id required' }, 400);
      }
      
      const { StorageEnhancedService } = await import('./services/storage-enhanced');
      const storage = new StorageEnhancedService(this.env);
      const metrics = await storage.getComprehensiveMetrics(repoId);
      
      return this.jsonResponse(metrics);
    }, 'get comprehensive metrics');
  }

  private async handleEnhancedReport(): Promise<Response> {
    return this.performanceMonitor.monitor('handleEnhancedReport', async () => {
      return this.handleError(async () => {
        const { StorageService } = await import('./services/storage');
        const { StorageEnhancedService } = await import('./services/storage-enhanced');
        const storage = new StorageService(this.env);
        const storageEnhanced = new StorageEnhancedService(this.env);
        
        // Get tier summaries
        const [tier1, tier2, tier3] = await Promise.all([
          storageEnhanced.getReposByTier(1, 10),
          storageEnhanced.getReposByTier(2, 10),
          storageEnhanced.getReposByTier(3, 10),
        ]);
        
        // Get high-growth repos with enhanced metrics
        const highGrowthRepos = await storage.getHighGrowthRepos(7, 100);
        const topReposWithMetrics = await Promise.all(
          highGrowthRepos.slice(0, 5).map(async (repo) => {
            const metrics = await storageEnhanced.getComprehensiveMetrics(repo.id);
            const analysis = await storage.getLatestAnalysis(repo.id);
            return {
              repository: repo,
              metrics: {
                commits: metrics.commits.length,
                releases: metrics.releases.length,
                pullRequests: metrics.pullRequests?.total_prs || 0,
                issues: metrics.issues?.total_issues || 0,
                starGrowth: metrics.stars.length > 0 ? 
                  metrics.stars[0].daily_growth : 0,
                forkActivity: metrics.forks?.active_forks || 0,
              },
              analysis: analysis ? {
                investment_score: analysis.scores.investment,
                recommendation: analysis.recommendation,
              } : null
            };
          })
        );
        
        const [recentAlerts, stats] = await Promise.all([
          storage.getRecentAlerts(10),
          storage.getDailyStats()
        ]);
        
        return this.jsonResponse({
          date: new Date().toISOString(),
          tier_summary: {
            tier1: { count: tier1.length, repos: tier1.slice(0, 5) },
            tier2: { count: tier2.length, repos: tier2.slice(0, 5) },
            tier3: { count: tier3.length, repos: tier3.slice(0, 5) },
          },
          high_growth_repos_with_metrics: topReposWithMetrics,
          recent_alerts: recentAlerts.slice(0, 5),
          system_metrics: stats,
          total_monitored_repos: tier1.length + tier2.length + tier3.length,
        });
      }, 'generate enhanced report');
    });
  }

  private async handleAgentInit(): Promise<Response> {
    return this.handleError(async () => {
      // Initialize the agent by triggering a comprehensive scan
      const id = this.env.GITHUB_AGENT.idFromName('main');
      const agent = this.env.GITHUB_AGENT.get(id);
      
      // Schedule the next run
      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + 6);
      
      return this.jsonResponse({
        message: 'Agent initialized successfully',
        nextRun: nextRun.toISOString(),
        status: 'ready'
      });
    }, 'initialize agent');
  }

  private async handleStatus(): Promise<Response> {
    return this.handleError(async () => {
      // Import rate limiters
      const { githubRateLimiter, githubSearchRateLimiter, claudeRateLimiter } = 
        await import('./utils/rateLimiter');
      
      // Get rate limit statuses
      const rateLimits = {
        github: githubRateLimiter.getStatus(),
        githubSearch: githubSearchRateLimiter.getStatus(),
        claude: claudeRateLimiter.getStatus(),
      };
      
      // Get performance metrics
      const performanceMetrics = this.performanceMonitor.getReport();
      
      return this.jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-workers',
        rateLimits: {
          github: {
            ...rateLimits.github,
            description: 'GitHub API (30 req/min)',
          },
          githubSearch: {
            ...rateLimits.githubSearch,
            description: 'GitHub Search API (10 req/min)',
          },
          claude: {
            ...rateLimits.claude,
            description: 'Claude/Anthropic API (5 req/min)',
          },
        },
        performance: {
          totalTime: performanceMetrics.total,
          checkpoints: Object.keys(performanceMetrics.checkpoints).length,
          warnings: performanceMetrics.warnings.length,
          memoryUsage: performanceMetrics.memoryUsage,
          summary: this.performanceMonitor.getSummary(),
        },
      });
    }, 'get system status');
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const worker = new WorkerService(env);
    try {
      return await worker.handleRequest(request);
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Internal server error' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', event.cron);
  }
};
