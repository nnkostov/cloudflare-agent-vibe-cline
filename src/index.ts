import type { Env } from './types';
import { BaseService } from './services/base';
import { StreamProcessor } from './utils/streamProcessor';
import { PerformanceMonitor } from './utils/performanceMonitor';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

// Re-export the Durable Object
export { default as GitHubAgent } from './agents/GitHubAgent-fixed-comprehensive';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const service = new WorkerService(env);
    return service.handleRequest(request);
  }
};

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
      '/diagnostics/data-freshness': () => this.handleDataFreshness(),
      '/diagnostics/scan-history': () => this.handleScanHistory(),
      '/diagnostics/table-check': () => this.handleTableCheck(),
      '/diagnostics/system-health': () => this.handleSystemHealth(),
      '/logs/recent': () => this.handleRecentLogs(request),
      '/logs/errors': () => this.handleLogErrors(request),
      '/logs/performance': () => this.handleLogPerformance(request),
      '/logs/api-usage': () => this.handleAPIUsage(request),
      '/logs/scan-activity': () => this.handleScanActivity(request),
      '/logs/critical-alerts': () => this.handleCriticalAlerts(request),
      '/analyze/batch': () => this.handleBatchAnalyze(request),
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
        const { StorageUnifiedService } = await import('./services/storage-unified');
        const storage = new StorageUnifiedService(this.env);
      const count = await storage.getRepositoryCount();
      return this.jsonResponse({ count });
    }, 'get repository count');
  }

  private async handleTrendingRepos(): Promise<Response> {
    return this.performanceMonitor.monitor('handleTrendingRepos', async () => {
      return this.handleError(async () => {
        const { StorageUnifiedService } = await import('./services/storage-unified');
        const storage = new StorageUnifiedService(this.env);
        
        try {
          // Use the hybrid approach that works with or without historical data
          const repos = await storage.getHighGrowthRepos(30, 200);
          
          // Log which approach was used
          const hasHistoricalData = repos.some(r => r.growth_percent !== undefined);
          console.log(`Trending repos: Using ${hasHistoricalData ? 'historical growth data' : 'hybrid trending algorithm'}`);
          
          // For now, return a simplified response without analysis to avoid timeouts
          const simplifiedRepos = repos.slice(0, 30).map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            stars: repo.stars,
            forks: repo.forks,
            language: repo.language,
            topics: repo.topics,
            tier: repo.tier,
            trending_score: repo.trending_score || repo.growth_percent || 0,
            trending_reason: repo.trending_factors ? 
              this.getTrendingReason(repo.trending_factors) : 
              'High growth rate'
          }));
          
          return this.jsonResponse({
            repositories: simplifiedRepos,
            total: simplifiedRepos.length,
            data_source: hasHistoricalData ? 'historical' : 'hybrid'
          });
        } catch (error) {
          console.error('Error getting trending repos:', error);
          
          // Fallback: Return top starred repos as trending
          const fallbackRepos = await storage.getReposByTier(1, 10);
          
          return this.jsonResponse({
            repositories: fallbackRepos.map(repo => ({
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              stars: repo.stars,
              forks: repo.forks,
              language: repo.language,
              topics: repo.topics,
              tier: repo.tier,
              trending_score: 0,
              trending_reason: 'Top repository by stars'
            })),
            total: fallbackRepos.length,
            data_source: 'fallback'
          });
        }
      }, 'get trending repos');
    });
  }

  /**
   * Get a human-readable trending reason based on factors
   */
  private getTrendingReason(factors: Record<string, number>): string {
    const reasons = [];
    
    if (factors.starVelocity > 70) {
      reasons.push('Rapid star growth');
    }
    if (factors.recentActivity > 80) {
      reasons.push('Very active development');
    }
    if (factors.momentum > 60) {
      reasons.push('Strong momentum');
    }
    if (factors.forkActivity > 50) {
      reasons.push('High community engagement');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Trending repository';
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
      
      const { StorageUnifiedService } = await import('./services/storage-unified');
      const storage = new StorageUnifiedService(this.env);
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
      // Import rate limiters and CONFIG
      const { githubRateLimiter, githubSearchRateLimiter, claudeRateLimiter } = 
        await import('./utils/rateLimiter');
      const { CONFIG } = await import('./types');
      const { DiagnosticsService } = await import('./services/diagnostics');
      
      // Get rate limit statuses
      const rateLimits = {
        github: githubRateLimiter.getStatus(),
        githubSearch: githubSearchRateLimiter.getStatus(),
        claude: claudeRateLimiter.getStatus(),
      };
      
      // Get performance metrics
      const performanceMetrics = this.performanceMonitor.getReport();
      
      // Get system health
      const diagnostics = new DiagnosticsService(this.env);
      const [systemHealth, tierDistribution] = await Promise.all([
        diagnostics.getSystemHealth(),
        diagnostics.getTierDistribution()
      ]);
      
      return this.jsonResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: 'cloudflare-workers',
        scanInterval: CONFIG.github.scanInterval,
        systemHealth,
        tierDistribution,
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

  // New diagnostic endpoints
  private async handleDataFreshness(): Promise<Response> {
    return this.handleError(async () => {
      const { DiagnosticsService } = await import('./services/diagnostics');
      const diagnostics = new DiagnosticsService(this.env);
      const freshness = await diagnostics.checkDataFreshness();
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        dataFreshness: freshness,
        summary: {
          fresh: freshness.filter(f => !f.isStale).length,
          stale: freshness.filter(f => f.isStale).length,
          total: freshness.length
        }
      });
    }, 'check data freshness');
  }

  private async handleScanHistory(): Promise<Response> {
    return this.handleError(async () => {
      const { DiagnosticsService } = await import('./services/diagnostics');
      const diagnostics = new DiagnosticsService(this.env);
      const history = await diagnostics.getScanHistory(10);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        scanHistory: history,
        summary: {
          successfulScans: history.filter(h => h.success).length,
          failedScans: history.filter(h => !h.success).length,
          totalReposScanned: history.reduce((sum, h) => sum + h.reposScanned, 0),
          totalAnalyses: history.reduce((sum, h) => sum + h.analysesPerformed, 0)
        }
      });
    }, 'get scan history');
  }

  private async handleTableCheck(): Promise<Response> {
    return this.handleError(async () => {
      const { DiagnosticsService } = await import('./services/diagnostics');
      const diagnostics = new DiagnosticsService(this.env);
      const tables = await diagnostics.checkTables();
      
      const missingTables = tables.filter(t => t.rowCount === -1);
      const emptyTables = tables.filter(t => t.rowCount === 0);
      const populatedTables = tables.filter(t => t.rowCount > 0);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        tables,
        summary: {
          total: tables.length,
          missing: missingTables.length,
          empty: emptyTables.length,
          populated: populatedTables.length,
          missingTableNames: missingTables.map(t => t.name),
          totalRows: tables.reduce((sum, t) => sum + (t.rowCount > 0 ? t.rowCount : 0), 0)
        }
      });
    }, 'check tables');
  }

  private async handleSystemHealth(): Promise<Response> {
    return this.handleError(async () => {
      const { DiagnosticsService } = await import('./services/diagnostics');
      const diagnostics = new DiagnosticsService(this.env);
      
      const [health, staleRepos, tierDistribution] = await Promise.all([
        diagnostics.getSystemHealth(),
        diagnostics.getStaleRepositories(24),
        diagnostics.getTierDistribution()
      ]);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        health,
        staleRepositories: staleRepos,
        tierDistribution,
        quickActions: {
          runMigration: health.missingTables.includes('repo_tiers'),
          initializeAgent: health.lastScanStatus === 'unknown',
          checkLogs: health.lastScanStatus === 'failed'
        }
      });
    }, 'get system health');
  }

  // Log analysis endpoints
  private async handleRecentLogs(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const level = url.searchParams.get('level') as any;
      
      const { LogsService } = await import('./services/logs');
      const logsService = new LogsService(this.env);
      
      const logs = await logsService.queryLogs({
        startTime: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        limit,
        level,
      });
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        hours,
        count: logs.length,
        logs,
      });
    }, 'get recent logs');
  }

  private async handleLogErrors(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      
      const { LogsService } = await import('./services/logs');
      const logsService = new LogsService(this.env);
      
      const errors = await logsService.getErrorSummary(hours);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        hours,
        totalErrors: errors.reduce((sum, e) => sum + e.count, 0),
        uniqueErrors: errors.length,
        errors,
      });
    }, 'get log errors');
  }

  private async handleLogPerformance(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      
      const { LogsService } = await import('./services/logs');
      const logsService = new LogsService(this.env);
      
      const metrics = await logsService.getPerformanceMetrics(hours);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        hours,
        metrics,
      });
    }, 'get log performance');
  }

  private async handleAPIUsage(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      
      const { LogsService } = await import('./services/logs');
      const logsService = new LogsService(this.env);
      
      const usage = await logsService.getAPIUsage(hours);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        hours,
        usage,
      });
    }, 'get API usage');
  }

  private async handleScanActivity(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      
      const { LogsService } = await import('./services/logs');
      const logsService = new LogsService(this.env);
      
      const activity = await logsService.getScanActivity(hours);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        hours,
        activity,
      });
    }, 'get scan activity');
  }

  private async handleCriticalAlerts(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const hours = parseInt(url.searchParams.get('hours') || '24');
      
      const { LogsService } = await import('./services/logs');
      const logsService = new LogsService(this.env);
      
      const alerts = await logsService.getCriticalAlerts(hours);
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        hours,
        count: alerts.length,
        alerts,
      });
    }, 'get critical alerts');
  }

  /**
   * Handle batch analysis request for visible repositories
   */
  private async handleBatchAnalyze(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const body = await request.json() as any;
      const { target = 'visible' } = body;
      
      const { StorageUnifiedService } = await import('./services/storage-unified');
      const storage = new StorageUnifiedService(this.env);
      
      console.log(`Starting batch analysis for ${target} repositories...`);
      
      // Get repositories that need analysis
      let reposToAnalyze: any[] = [];
      
      if (target === 'visible' || target === 'all') {
        // Get all visible repos (trending, leaderboard, tier 1 & 2)
        const [trending, tier1, tier2] = await Promise.all([
          storage.getHighGrowthRepos(30, 200),
          storage.getReposByTier(1, 100),
          storage.getReposByTier(2, 20),
        ]);
        
        // Combine and deduplicate
        const allRepos = [...trending, ...tier1, ...tier2];
        const uniqueRepos = new Map();
        allRepos.forEach(repo => uniqueRepos.set(repo.id, repo));
        reposToAnalyze = Array.from(uniqueRepos.values());
      } else if (target === 'tier1') {
        reposToAnalyze = await storage.getReposByTier(1, 100);
      } else if (target === 'tier2') {
        reposToAnalyze = await storage.getReposByTier(2, 50);
      }
      
      // Filter out repos that already have recent analysis
      const reposNeedingAnalysis = [];
      for (const repo of reposToAnalyze) {
        const hasAnalysis = await storage.hasRecentAnalysis(repo.id);
        if (!hasAnalysis) {
          reposNeedingAnalysis.push(repo);
        }
      }
      
      console.log(`Found ${reposNeedingAnalysis.length} repositories needing analysis`);
      
      // Queue analysis for these repositories
      const id = this.env.GITHUB_AGENT.idFromName('main');
      const agent = this.env.GITHUB_AGENT.get(id);
      
      // Start batch analysis in the background
      const batchPromises = reposNeedingAnalysis.slice(0, 10).map(async (repo, index) => {
        // Add delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, index * 5000));
        
        try {
          const response = await agent.fetch(new Request('http://internal/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repoId: repo.id,
              force: true
            })
          }));
          
          if (response.ok) {
            return { repo: repo.full_name, status: 'success' };
          } else {
            return { repo: repo.full_name, status: 'failed', error: await response.text() };
          }
        } catch (error) {
          return { repo: repo.full_name, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });
      
      // Don't wait for all analyses to complete - just start them
      Promise.all(batchPromises).then(results => {
        console.log('Batch analysis completed:', results);
      }).catch(error => {
        console.error('Batch analysis error:', error);
      });
      
      return this.jsonResponse({
        message: 'Batch analysis started',
        target,
        totalRepos: reposToAnalyze.length,
        needingAnalysis: reposNeedingAnalysis.length,
        queued: Math.min(10, reposNeedingAnalysis.length),
        repositories: reposNeedingAnalysis.slice(0, 10).map(r => r.full_name)
      });
    }, 'batch analyze repositories');
  }
}
