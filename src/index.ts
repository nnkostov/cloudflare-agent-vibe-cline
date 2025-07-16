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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
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
    
    // In development, return a simple HTML page that redirects to the Vite dev server
    if (this.env.ENVIRONMENT === 'development') {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <title>GitHub AI Intelligence</title>
  <meta http-equiv="refresh" content="0; url=http://localhost:3003">
</head>
<body>
  <p>Redirecting to development server at <a href="http://localhost:3003">http://localhost:3003</a>...</p>
</body>
</html>`,
        { 
          headers: { 
            'Content-Type': 'text/html',
            ...this.corsHeaders 
          } 
        }
      );
    }
    
    // In production, we need to handle static assets differently
    // Since this is a Workers deployment, static assets should be served from a separate domain
    // or we need to configure asset handling properly
    
    // For now, return a simple HTML page that explains the setup
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>GitHub AI Intelligence - API</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    .info { background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0; }
    code { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }
    .endpoint { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>GitHub AI Intelligence API</h1>
  <div class="info">
    <p>This is the API endpoint for the GitHub AI Intelligence system.</p>
    <p>The dashboard should be deployed separately as a Cloudflare Pages project.</p>
  </div>
  
  <h2>Available API Endpoints:</h2>
  <div class="endpoint"><code>GET /api/status</code> - System status</div>
  <div class="endpoint"><code>GET /api/repos/trending</code> - Get trending repositories</div>
  <div class="endpoint"><code>GET /api/repos/tier?tier=1</code> - Get repositories by tier (1, 2, or 3)</div>
  <div class="endpoint"><code>GET /api/alerts</code> - Get recent alerts</div>
  <div class="endpoint"><code>GET /api/reports/daily</code> - Get daily report</div>
  <div class="endpoint"><code>GET /api/reports/enhanced</code> - Get enhanced report</div>
  <div class="endpoint"><code>POST /api/scan</code> - Trigger a scan</div>
  <div class="endpoint"><code>POST /api/scan/comprehensive</code> - Trigger comprehensive scan</div>
  <div class="endpoint"><code>POST /api/agent/init</code> - Initialize the agent</div>
  
  <div class="info">
    <h3>Dashboard Deployment:</h3>
    <p>To deploy the dashboard:</p>
    <ol>
      <li>Build the dashboard: <code>cd dashboard && npm run build</code></li>
      <li>Deploy to Cloudflare Pages: <code>npx wrangler pages deploy dist</code></li>
      <li>Configure the dashboard to use this API endpoint</li>
    </ol>
  </div>
</body>
</html>`,
      { 
        headers: { 
          'Content-Type': 'text/html',
          ...this.corsHeaders 
        } 
      }
    );
  }

  private getContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'html': 'text/html',
      'js': 'application/javascript',
      'css': 'text/css',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  private async handleApiRequest(request: Request, pathname: string): Promise<Response> {
    const agentPath = pathname.replace('/api', '');
    
    // Handle direct endpoints
    const directHandlers: Record<string, () => Promise<Response>> = {
      '/repos/trending': () => this.handleTrendingRepos(),
      '/repos/count': () => this.handleRepoCount(),
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

  private async handleRepoCount(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageServiceFixed } = await import('./services/storage-fix');
      const storage = new StorageServiceFixed(this.env);
      const count = await storage.getRepositoryCount();
      return this.jsonResponse({ count });
    }, 'get repository count');
  }

  private async handleTrendingRepos(): Promise<Response> {
    return this.performanceMonitor.monitor('handleTrendingRepos', async () => {
      return this.handleError(async () => {
        const { StorageServiceFixed } = await import('./services/storage-fix');
        const storage = new StorageServiceFixed(this.env);
        
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
      // Forward the initialization request to the Durable Object
      const id = this.env.GITHUB_AGENT.idFromName('main');
      const agent = this.env.GITHUB_AGENT.get(id);
      
      // Call the Durable Object's init endpoint
      const initResponse = await agent.fetch(new Request('http://internal/init', {
        method: 'POST'
      }));
      
      if (!initResponse.ok) {
        const error = await initResponse.text();
        throw new Error(`Failed to initialize agent: ${error}`);
      }
      
      const result = await initResponse.json() as any;
      
      return this.jsonResponse({
        message: 'Agent initialized successfully',
        nextRun: result.nextRun,
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
      // Include CORS headers in error responses
      return new Response(
        JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Internal server error' 
        }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        }
      );
    }
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', event.cron);
    
    // Trigger comprehensive scan on schedule
    try {
      const id = env.GITHUB_AGENT.idFromName('main');
      const agent = env.GITHUB_AGENT.get(id);
      
      // Trigger the alarm to run comprehensive scan
      await agent.fetch(new Request('http://internal/alarm', {
        method: 'POST'
      }));
    } catch (error) {
      console.error('Scheduled scan error:', error);
    }
  }
};
