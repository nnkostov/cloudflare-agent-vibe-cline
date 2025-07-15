import type { Env } from './types';
import { BaseService } from './services/base';

// Re-export the Durable Object
export { GitHubAgent } from './agents/GitHubAgent';

class WorkerService extends BaseService {
  private corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

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
          '/api/analyze': 'POST - Analyze a specific repository',
          '/api/repos/trending': 'GET - Get trending repositories',
          '/api/alerts': 'GET - Get recent alerts',
          '/api/reports/daily': 'GET - Get daily report',
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
      '/alerts': () => this.handleAlerts(),
      '/reports/daily': () => this.handleDailyReport(),
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
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage');
      const storage = new StorageService(this.env);
      
      const repos = await storage.getHighGrowthRepos(30, 200);
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
