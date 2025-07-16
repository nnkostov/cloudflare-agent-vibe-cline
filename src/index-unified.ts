import type { Env } from './types';
import { BaseService } from './services/base';
import { StreamProcessor } from './utils/streamProcessor';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// Re-export the Durable Object
export { GitHubAgent } from './agents/GitHubAgent-unified';

// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const assetManifest = JSON.parse(manifestJSON);

class WorkerService extends BaseService {
  private corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  constructor(env: Env) {
    super(env);
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
    
    // In production, try to serve static assets
    try {
      // @ts-ignore
      const response = await getAssetFromKV(
        {
          request,
          waitUntil: (promise: Promise<any>) => promise,
        },
        {
          ASSET_NAMESPACE: (this.env as any).__STATIC_CONTENT,
          ASSET_MANIFEST: assetManifest,
        }
      );
      
      // Add CORS headers to asset responses
      const newHeaders = new Headers(response.headers);
      Object.entries(this.corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (e) {
      // If the asset is not found, try index.html for client-side routing
      if (url.pathname !== '/' && !url.pathname.includes('.')) {
        try {
          const indexRequest = new Request(new URL('/', request.url).toString());
          // @ts-ignore
          const response = await getAssetFromKV(
            {
              request: indexRequest,
              waitUntil: (promise: Promise<any>) => promise,
            },
            {
              ASSET_NAMESPACE: (this.env as any).__STATIC_CONTENT,
              ASSET_MANIFEST: assetManifest,
            }
          );
          
          // Add CORS headers
          const newHeaders = new Headers(response.headers);
          Object.entries(this.corsHeaders).forEach(([key, value]) => {
            newHeaders.set(key, value);
          });
          
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        } catch (indexError) {
          // If index.html is also not found, return 404
        }
      }
      
      // Return 404 if no asset found
      return new Response('Not Found', { status: 404, headers: this.corsHeaders });
    }
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
      const { StorageService } = await import('./services/storage-unified');
      const storage = new StorageService(this.env);
      const count = await storage.getRepositoryCount();
      return this.jsonResponse({ count });
    }, 'get repository count');
  }

  private async handleTrendingRepos(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage-unified');
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
  }

  private async handleAlerts(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage-unified');
      const storage = new StorageService(this.env);
      const alerts = await storage.getRecentAlerts(50);
      return this.jsonResponse({ alerts });
    }, 'get alerts');
  }

  private async handleDailyReport(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage-unified');
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
      
      const { StorageService } = await import('./services/storage-unified');
      const storage = new StorageService(this.env);
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
      
      const { StorageService } = await import('./services/storage-unified');
      const storage = new StorageService(this.env);
      const metrics = await storage.getComprehensiveMetrics(repoId);
      
      return this.jsonResponse(metrics);
    }, 'get comprehensive metrics');
  }

  private async handleEnhancedReport(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage-unified');
      const storage = new StorageService(this.env);
      
      // Get tier summaries
      const [tier1, tier2, tier3] = await Promise.all([
        storage.getReposByTier(1, 10),
        storage.getReposByTier(2, 10),
        storage.getReposByTier(3, 10),
      ]);
      
      // Get high-growth repos with enhanced metrics
      const highGrowthRepos = await storage.getHighGrowthRepos(7, 100);
      const topReposWithMetrics = await Promise.all(
        highGrowthRepos.slice(0, 5).map(async (repo) => {
          const metrics = await storage.getComprehensiveMetrics(repo.id);
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
        await import('./utils/simpleRateLimiter');
      
      // Get rate limit statuses
      const rateLimits = {
        github: githubRateLimiter.getStatus(),
        githubSearch: githubSearchRateLimiter.getStatus(),
        claude: claudeRateLimiter.getStatus(),
      };
      
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
          note: 'Performance monitoring is handled by Cloudflare Analytics'
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
