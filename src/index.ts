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
      
      // Add cache control headers for JavaScript files to prevent caching issues
      if (url.pathname.endsWith('.js')) {
        newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        newHeaders.set('Pragma', 'no-cache');
        newHeaders.set('Expires', '0');
      }
      
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
      '/analyze/batch/status': () => this.handleBatchStatus(request),
      '/analysis/stats': () => this.handleAnalysisStats(),
      '/worker-metrics': () => this.handleWorkerMetrics(),
      '/version': () => this.handleVersion(),
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
          
          // Return all trending repositories (increased from 30 to show all)
          // Include analysis data for each repository
          const simplifiedRepos = await Promise.all(
            repos.slice(0, 200).map(async (repo) => ({
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
                'High growth rate',
              latest_analysis: await storage.getLatestAnalysis(repo.id)
            }))
          );
          
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
          description: repo.description,
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
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      if (![1, 2, 3].includes(tier)) {
        return this.jsonResponse({ error: 'Invalid tier. Must be 1, 2, or 3' }, 400);
      }
      
      if (page < 1) {
        return this.jsonResponse({ error: 'Invalid page. Must be >= 1' }, 400);
      }
      
      if (limit < 1 || limit > 100) {
        return this.jsonResponse({ error: 'Invalid limit. Must be between 1 and 100' }, 400);
      }
      
      const { StorageUnifiedService } = await import('./services/storage-unified');
      const storage = new StorageUnifiedService(this.env);
      
      // Get total count for pagination info
      const totalCount = await storage.getRepoCountByTier(tier as 1 | 2 | 3);
      const totalPages = Math.ceil(totalCount / limit);
      
      // Calculate offset
      const offset = (page - 1) * limit;
      
      // Get paginated repos
      const repos = await storage.getReposByTierPaginated(tier as 1 | 2 | 3, limit, offset);
      
      // Always fetch full analysis data since we're dealing with manageable page sizes
      const reposWithAnalysisInfo = await Promise.all(
        repos.map(async (repo: any) => ({
          ...repo,
          latest_analysis: await storage.getLatestAnalysis(repo.id)
        }))
      );
      
      return this.jsonResponse({ 
        tier, 
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        repos: reposWithAnalysisInfo
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
      const { target = 'visible', force = false } = body;
      
      const { StorageUnifiedService } = await import('./services/storage-unified');
      const storage = new StorageUnifiedService(this.env);
      
      console.log(`Starting enhanced batch analysis for ${target} repositories... Force: ${force}`);
      
      // Get repositories that need analysis with priority ordering
      let reposToAnalyze: any[] = [];
      
      if (target === 'visible' || target === 'all') {
        // Get ALL repositories from ALL tiers with no artificial limits
        const [tier1, tier2, tier3, trending] = await Promise.all([
          storage.getReposByTier(1), // No limit - get ALL Tier 1 repositories
          storage.getReposByTier(2), // No limit - get ALL Tier 2 repositories  
          storage.getReposByTier(3), // No limit - get ALL Tier 3 repositories
          storage.getHighGrowthRepos(30, 100), // Keep trending as supplementary
        ]);
        
        console.log(`Repository counts: Tier 1: ${tier1.length}, Tier 2: ${tier2.length}, Tier 3: ${tier3.length}, Trending: ${trending.length}`);
        
        // Priority order: Tier 1 first, then Tier 2, then Tier 3, then trending
        const allRepos = [...tier1, ...tier2, ...tier3, ...trending];
        const uniqueRepos = new Map();
        allRepos.forEach(repo => {
          if (!uniqueRepos.has(repo.id)) {
            uniqueRepos.set(repo.id, { ...repo, priority: this.getRepoPriority(repo) });
          }
        });
        reposToAnalyze = Array.from(uniqueRepos.values())
          .sort((a, b) => a.priority - b.priority); // Lower number = higher priority
      } else if (target === 'tier1') {
        const tier1Repos = await storage.getReposByTier(1); // No limit
        reposToAnalyze = tier1Repos.map(repo => ({ ...repo, priority: 1 }));
      } else if (target === 'tier2') {
        const tier2Repos = await storage.getReposByTier(2); // No limit
        reposToAnalyze = tier2Repos.map(repo => ({ ...repo, priority: 2 }));
      } else if (target === 'tier3') {
        const tier3Repos = await storage.getReposByTier(3); // No limit
        reposToAnalyze = tier3Repos.map(repo => ({ ...repo, priority: 3 }));
      }
      
      // Use SQL-based filtering to avoid "Too many API requests" error
      // This is much more efficient than checking each repository individually
      const reposNeedingAnalysis = [];
      
      // Build SQL query to find repositories needing analysis based on tier thresholds
      let tierConditions = [];
      if (force) {
        // Force mode: shorter thresholds
        tierConditions = [
          `(rt.tier = 1 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-72 hours')))`, // 3 days for Tier 1
          `(rt.tier = 2 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-120 hours')))`, // 5 days for Tier 2  
          `(rt.tier = 3 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-168 hours')))` // 7 days for Tier 3
        ];
      } else {
        // Normal mode: longer thresholds
        tierConditions = [
          `(rt.tier = 1 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-168 hours')))`, // 7 days for Tier 1
          `(rt.tier = 2 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-240 hours')))`, // 10 days for Tier 2
          `(rt.tier = 3 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-336 hours')))` // 14 days for Tier 3
        ];
      }
      
      // Get repository IDs that need analysis using efficient SQL
      const needingAnalysisQuery = `
        SELECT DISTINCT r.id, r.full_name, rt.tier, r.stars
        FROM repositories r
        JOIN repo_tiers rt ON r.id = rt.repo_id
        LEFT JOIN (
          SELECT repo_id, MAX(created_at) as created_at
          FROM analyses
          GROUP BY repo_id
        ) a ON r.id = a.repo_id
        WHERE r.is_archived = 0 AND r.is_fork = 0
          AND (${tierConditions.join(' OR ')})
        ORDER BY rt.tier ASC, r.stars DESC
        LIMIT 100
      `;
      
      const needingAnalysisResults = await this.env.DB.prepare(needingAnalysisQuery).all();
      
      // Map the results to match the expected format
      for (const row of needingAnalysisResults.results || []) {
        const repo = reposToAnalyze.find(r => r.id === (row as any).id);
        if (repo) {
          reposNeedingAnalysis.push({
            ...repo,
            priority: this.getRepoPriority(repo)
          });
        }
      }
      
      console.log(`Found ${reposNeedingAnalysis.length} repositories needing analysis (${reposToAnalyze.length} total, force: ${force})`);
      
      // If no repos need analysis, provide helpful feedback
      if (reposNeedingAnalysis.length === 0) {
        const analysisStats = await this.getAnalysisStatsInternal();
        
        return this.jsonResponse({
          message: 'No repositories need analysis at this time',
          batchId: null,
          target,
          totalRepos: reposToAnalyze.length,
          needingAnalysis: 0,
          queued: 0,
          reason: force ? 
            'All visible repositories have been analyzed recently (within tier-specific thresholds)' :
            'All visible repositories have recent analysis. Try using force mode for more aggressive re-analysis.',
          suggestion: force ? 
            'All repositories are up to date!' :
            'Click the button again to force re-analysis of recently analyzed repositories',
          analysisStats: {
            tier1: `${analysisStats.tier1.analyzed}/${analysisStats.tier1.total} analyzed (${analysisStats.tier1.progress}%)`,
            tier2: `${analysisStats.tier2.analyzed}/${analysisStats.tier2.total} analyzed (${analysisStats.tier2.progress}%)`,
            tier3: `${analysisStats.tier3.analyzed}/${analysisStats.tier3.total} analyzed (${analysisStats.tier3.progress}%)`,
            totalRemaining: analysisStats.remainingRepositories
          },
          repositories: []
        });
      }
      
      // Enhanced batch processing - process up to 30 repositories
      const BATCH_SIZE = 30;
      const DELAY_BETWEEN_ANALYSES = 2000; // 2 seconds
      const MAX_RETRIES = 2;
      
      const id = this.env.GITHUB_AGENT.idFromName('main');
      const agent = this.env.GITHUB_AGENT.get(id);
      
      // Store batch progress in Durable Object state for tracking
      const batchId = `batch_${Date.now()}`;
      
      // Start batch analysis using the Durable Object's batch processing
      const repositoryNames = reposNeedingAnalysis.slice(0, BATCH_SIZE).map(r => r.full_name);
      
      // Call the Durable Object's startBatchAnalysis method
      const startBatchResponse = await agent.fetch(new Request('http://internal/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId,
          repositories: repositoryNames
        })
      }));
      
      if (!startBatchResponse.ok) {
        const error = await startBatchResponse.text();
        console.error(`[${batchId}] Failed to start batch analysis:`, error);
        throw new Error(`Failed to start batch analysis: ${error}`);
      } else {
        console.log(`[${batchId}] Batch analysis started successfully`);
      }
      
      return this.jsonResponse({
        message: 'Enhanced batch analysis started',
        batchId,
        target,
        totalRepos: reposToAnalyze.length,
        needingAnalysis: reposNeedingAnalysis.length,
        queued: Math.min(BATCH_SIZE, reposNeedingAnalysis.length),
        batchSize: BATCH_SIZE,
        delayBetweenAnalyses: `${DELAY_BETWEEN_ANALYSES / 1000}s`,
        maxRetries: MAX_RETRIES,
        estimatedCompletionTime: `${Math.round((Math.min(BATCH_SIZE, reposNeedingAnalysis.length) * DELAY_BETWEEN_ANALYSES) / 1000 / 60)} minutes`,
        repositories: reposNeedingAnalysis.slice(0, BATCH_SIZE).map(r => ({
          name: r.full_name,
          priority: r.priority,
          tier: r.tier
        }))
      });
    }, 'enhanced batch analyze repositories');
  }

  /**
   * Get analysis statistics for internal use
   */
  private async getAnalysisStatsInternal() {
    // Use active filtering (excluding archived and fork repositories) for consistency
    const tierCounts = await Promise.all([
      this.env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM repositories r 
        JOIN repo_tiers rt ON r.id = rt.repo_id 
        WHERE rt.tier = 1 AND r.is_archived = 0 AND r.is_fork = 0
      `).first(),
      this.env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM repositories r 
        JOIN repo_tiers rt ON r.id = rt.repo_id 
        WHERE rt.tier = 2 AND r.is_archived = 0 AND r.is_fork = 0
      `).first(),
      this.env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM repositories r 
        JOIN repo_tiers rt ON r.id = rt.repo_id 
        WHERE rt.tier = 3 AND r.is_archived = 0 AND r.is_fork = 0
      `).first()
    ]);
    
    const tier1Count = (tierCounts[0] as any)?.count || 0;
    const tier2Count = (tierCounts[1] as any)?.count || 0;
    const tier3Count = (tierCounts[2] as any)?.count || 0;
    
    // Count analyzed repositories (those with recent analysis)
    const analyzedCounts = await Promise.all([
      this.env.DB.prepare(`
        SELECT COUNT(DISTINCT rt.repo_id) as count 
        FROM repo_tiers rt 
        JOIN analyses a ON rt.repo_id = a.repo_id 
        JOIN repositories r ON rt.repo_id = r.id
        WHERE rt.tier = 1 AND r.is_archived = 0 AND r.is_fork = 0 
          AND a.created_at > datetime('now', '-30 days')
      `).first(),
      this.env.DB.prepare(`
        SELECT COUNT(DISTINCT rt.repo_id) as count 
        FROM repo_tiers rt 
        JOIN analyses a ON rt.repo_id = a.repo_id 
        JOIN repositories r ON rt.repo_id = r.id
        WHERE rt.tier = 2 AND r.is_archived = 0 AND r.is_fork = 0 
          AND a.created_at > datetime('now', '-30 days')
      `).first(),
      this.env.DB.prepare(`
        SELECT COUNT(DISTINCT rt.repo_id) as count 
        FROM repo_tiers rt 
        JOIN analyses a ON rt.repo_id = a.repo_id 
        JOIN repositories r ON rt.repo_id = r.id
        WHERE rt.tier = 3 AND r.is_archived = 0 AND r.is_fork = 0 
          AND a.created_at > datetime('now', '-30 days')
      `).first()
    ]);
    
    const tier1Analyzed = (analyzedCounts[0] as any)?.count || 0;
    const tier2Analyzed = (analyzedCounts[1] as any)?.count || 0;
    const tier3Analyzed = (analyzedCounts[2] as any)?.count || 0;
    
    const totalRepositories = tier1Count + tier2Count + tier3Count;
    const totalAnalyzed = tier1Analyzed + tier2Analyzed + tier3Analyzed;
    const remainingRepositories = totalRepositories - totalAnalyzed;
    
    return {
      totalRepositories,
      analyzedRepositories: totalAnalyzed,
      remainingRepositories,
      tier1: {
        total: tier1Count,
        analyzed: tier1Analyzed,
        progress: tier1Count > 0 ? Math.round((tier1Analyzed / tier1Count) * 100) : 0
      },
      tier2: {
        total: tier2Count,
        analyzed: tier2Analyzed,
        progress: tier2Count > 0 ? Math.round((tier2Analyzed / tier2Count) * 100) : 0
      },
      tier3: {
        total: tier3Count,
        analyzed: tier3Analyzed,
        progress: tier3Count > 0 ? Math.round((tier3Analyzed / tier3Count) * 100) : 0
      }
    };
  }

  /**
   * Get repository priority for batch analysis (lower number = higher priority)
   */
  private getRepoPriority(repo: any): number {
    if (repo.tier === 1) return 1;
    if (repo.tier === 2) return 2;
    if (repo.stars > 10000) return 3;
    if (repo.stars > 1000) return 4;
    return 5;
  }

  /**
   * Handle batch analysis status request
   */
  private async handleBatchStatus(request: Request): Promise<Response> {
    return this.handleError(async () => {
      const url = new URL(request.url);
      const batchId = url.searchParams.get('batchId');
      
      if (!batchId) {
        return this.jsonResponse({ error: 'batchId parameter required' }, 400);
      }
      
      // Forward to Durable Object to get batch status
      const id = this.env.GITHUB_AGENT.idFromName('main');
      const agent = this.env.GITHUB_AGENT.get(id);
      
      const statusResponse = await agent.fetch(new Request('http://internal/batch/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId })
      }));
      
      if (!statusResponse.ok) {
        const error = await statusResponse.text();
        return this.jsonResponse({ 
          error: 'Failed to get batch status', 
          details: error 
        }, statusResponse.status);
      }
      
      const statusData = await statusResponse.json() as any;
      return this.jsonResponse(statusData);
    }, 'get batch analysis status');
  }

  /**
   * Handle analysis statistics request - provides global analysis progress
   */
  private async handleAnalysisStats(): Promise<Response> {
    return this.handleError(async () => {
      const { StorageService } = await import('./services/storage');
      const storage = new StorageService(this.env);
      
      // Use active filtering (excluding archived and fork repositories) for consistency
      // This matches the filtering used by DiagnosticsService and StorageUnifiedService
      const tierCounts = await Promise.all([
        this.env.DB.prepare(`
          SELECT COUNT(*) as count 
          FROM repositories r 
          JOIN repo_tiers rt ON r.id = rt.repo_id 
          WHERE rt.tier = 1 AND r.is_archived = 0 AND r.is_fork = 0
        `).first(),
        this.env.DB.prepare(`
          SELECT COUNT(*) as count 
          FROM repositories r 
          JOIN repo_tiers rt ON r.id = rt.repo_id 
          WHERE rt.tier = 2 AND r.is_archived = 0 AND r.is_fork = 0
        `).first(),
        this.env.DB.prepare(`
          SELECT COUNT(*) as count 
          FROM repositories r 
          JOIN repo_tiers rt ON r.id = rt.repo_id 
          WHERE rt.tier = 3 AND r.is_archived = 0 AND r.is_fork = 0
        `).first()
      ]);
      
      const tier1Count = (tierCounts[0] as any)?.count || 0;
      const tier2Count = (tierCounts[1] as any)?.count || 0;
      const tier3Count = (tierCounts[2] as any)?.count || 0;
      
      // Count analyzed repositories (those with recent analysis) - also use active filtering
      const analyzedCounts = await Promise.all([
        this.env.DB.prepare(`
          SELECT COUNT(DISTINCT rt.repo_id) as count 
          FROM repo_tiers rt 
          JOIN analyses a ON rt.repo_id = a.repo_id 
          JOIN repositories r ON rt.repo_id = r.id
          WHERE rt.tier = 1 AND r.is_archived = 0 AND r.is_fork = 0 
            AND a.created_at > datetime('now', '-30 days')
        `).first(),
        this.env.DB.prepare(`
          SELECT COUNT(DISTINCT rt.repo_id) as count 
          FROM repo_tiers rt 
          JOIN analyses a ON rt.repo_id = a.repo_id 
          JOIN repositories r ON rt.repo_id = r.id
          WHERE rt.tier = 2 AND r.is_archived = 0 AND r.is_fork = 0 
            AND a.created_at > datetime('now', '-30 days')
        `).first(),
        this.env.DB.prepare(`
          SELECT COUNT(DISTINCT rt.repo_id) as count 
          FROM repo_tiers rt 
          JOIN analyses a ON rt.repo_id = a.repo_id 
          JOIN repositories r ON rt.repo_id = r.id
          WHERE rt.tier = 3 AND r.is_archived = 0 AND r.is_fork = 0 
            AND a.created_at > datetime('now', '-30 days')
        `).first()
      ]);
      
      const tier1Analyzed = (analyzedCounts[0] as any)?.count || 0;
      const tier2Analyzed = (analyzedCounts[1] as any)?.count || 0;
      const tier3Analyzed = (analyzedCounts[2] as any)?.count || 0;
      
      const totalRepositories = tier1Count + tier2Count + tier3Count;
      const totalAnalyzed = tier1Analyzed + tier2Analyzed + tier3Analyzed;
      const remainingRepositories = totalRepositories - totalAnalyzed;
      const analysisProgress = totalRepositories > 0 ? (totalAnalyzed / totalRepositories) * 100 : 0;
      
      // Calculate estimated batches and time remaining
      const BATCH_SIZE = 30;
      const BATCH_TIME_MINUTES = 2; // Estimated 2 minutes per batch
      const estimatedBatchesRemaining = Math.ceil(remainingRepositories / BATCH_SIZE);
      const estimatedTimeRemaining = estimatedBatchesRemaining * BATCH_TIME_MINUTES;
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        totalRepositories,
        analyzedRepositories: totalAnalyzed,
        remainingRepositories,
        analysisProgress: Math.round(analysisProgress * 100) / 100,
        tierBreakdown: {
          tier1: {
            total: tier1Count,
            analyzed: tier1Analyzed,
            remaining: tier1Count - tier1Analyzed,
            progress: tier1Count > 0 ? Math.round((tier1Analyzed / tier1Count) * 100) : 0
          },
          tier2: {
            total: tier2Count,
            analyzed: tier2Analyzed,
            remaining: tier2Count - tier2Analyzed,
            progress: tier2Count > 0 ? Math.round((tier2Analyzed / tier2Count) * 100) : 0
          },
          tier3: {
            total: tier3Count,
            analyzed: tier3Analyzed,
            remaining: tier3Count - tier3Analyzed,
            progress: tier3Count > 0 ? Math.round((tier3Analyzed / tier3Count) * 100) : 0
          }
        },
        batchInfo: {
          batchSize: BATCH_SIZE,
          estimatedBatchesRemaining,
          estimatedTimeRemaining: estimatedTimeRemaining > 60 ? 
            `${Math.round(estimatedTimeRemaining / 60)} hours` : 
            `${estimatedTimeRemaining} minutes`
        },
        recommendations: this.getAnalysisRecommendations(
          tier1Count - tier1Analyzed,
          tier2Count - tier2Analyzed,
          tier3Count - tier3Analyzed
        )
      });
    }, 'get analysis statistics');
  }

  /**
   * Get smart recommendations based on analysis coverage
   */
  private getAnalysisRecommendations(tier1Remaining: number, tier2Remaining: number, tier3Remaining: number): string[] {
    const recommendations = [];
    
    if (tier1Remaining > 0) {
      recommendations.push(`Focus on Tier 1 first (${tier1Remaining} high-priority repos remaining)`);
    }
    
    if (tier2Remaining > 10) {
      recommendations.push(`Complete Tier 2 analysis (${tier2Remaining} repos remaining)`);
    }
    
    if (tier3Remaining > 50) {
      recommendations.push(`Consider background processing for Tier 3 (${tier3Remaining} repos remaining)`);
    }
    
    if (tier1Remaining === 0 && tier2Remaining === 0) {
      recommendations.push('Excellent! All high-priority repositories are analyzed');
    }
    
    return recommendations;
  }

  /**
   * Handle System Heartbeat request - provides organic system activity visualization
   */
  private async handleWorkerMetrics(): Promise<Response> {
    return this.handleError(async () => {
      // Get performance data from the performance monitor
      const performanceReport = this.performanceMonitor.getReport();
      const performanceSummary = this.performanceMonitor.getSummary();
      
      // Generate heartbeat metrics based on multiple system activities
      const now = Date.now();
      const metrics = [];
      
      // Create 12 data points representing the last 60 minutes (5-minute intervals)
      for (let i = 11; i >= 0; i--) {
        const timestamp = new Date(now - (i * 5 * 60 * 1000));
        const timestampStr = timestamp.toISOString();
        
        // Calculate individual activity components
        const apiActivity = this.calculateApiActivity(timestamp, performanceReport);
        const analysisActivity = this.calculateAnalysisActivity(timestamp, performanceReport);
        const dbActivity = this.calculateDatabaseActivity(timestamp, performanceReport);
        const systemActivity = this.calculateSystemActivity(timestamp, performanceReport);
        
        // Calculate weighted heartbeat score
        const heartbeatScore = this.calculateHeartbeatScore(
          apiActivity, analysisActivity, dbActivity, systemActivity, timestamp
        );
        
        // Add organic variation to make it feel alive
        const organicVariation = (Math.sin(now / 10000) + Math.cos(now / 7000)) * 3;
        const finalHeartbeat = Math.max(15, Math.min(95, heartbeatScore + organicVariation));
        
        metrics.push({
          timestamp: timestampStr,
          heartbeat: Math.round(finalHeartbeat * 100) / 100,
          components: {
            apiActivity: Math.round(apiActivity * 100) / 100,
            analysisActivity: Math.round(analysisActivity * 100) / 100,
            dbActivity: Math.round(dbActivity * 100) / 100,
            systemActivity: Math.round(systemActivity * 100) / 100
          },
          activityType: this.getActivityType(apiActivity, analysisActivity, dbActivity, systemActivity)
        });
      }
      
      return this.jsonResponse({
        timestamp: new Date().toISOString(),
        type: 'heartbeat',
        metrics,
        summary: {
          averageHeartbeat: Math.round(metrics.reduce((sum, m) => sum + m.heartbeat, 0) / metrics.length * 100) / 100,
          peakHeartbeat: Math.max(...metrics.map(m => m.heartbeat)),
          currentRhythm: this.getHeartbeatRhythm(metrics),
          systemHealth: this.getSystemHealth(metrics)
        },
        performance: {
          totalExecutionTime: performanceReport.total,
          checkpoints: Object.keys(performanceReport.checkpoints).length,
          warnings: performanceReport.warnings.length,
          memoryUsage: performanceReport.memoryUsage,
          summary: performanceSummary
        }
      });
    }, 'get system heartbeat');
  }

  /**
   * Calculate API activity component (40% of heartbeat)
   */
  private calculateApiActivity(timestamp: Date, performanceReport: any): number {
    const hour = timestamp.getHours();
    const minute = timestamp.getMinutes();
    
    // Simulate API activity based on time patterns and performance data
    let baseActivity = 20;
    
    // Business hours boost
    if (hour >= 9 && hour <= 17) {
      baseActivity += 30;
    } else if (hour >= 18 && hour <= 21) {
      baseActivity += 20;
    }
    
    // Performance-based activity
    if (performanceReport.total && performanceReport.total > 100) {
      baseActivity += Math.min(30, performanceReport.total / 10);
    }
    
    // Add realistic variation
    const timeVariation = Math.sin((hour * 60 + minute) / 100) * 15;
    const randomSpikes = Math.random() > 0.8 ? Math.random() * 25 : 0;
    
    return Math.max(5, Math.min(85, baseActivity + timeVariation + randomSpikes));
  }

  /**
   * Calculate AI analysis activity component (30% of heartbeat)
   */
  private calculateAnalysisActivity(timestamp: Date, performanceReport: any): number {
    const hour = timestamp.getHours();
    
    // Simulate analysis workload patterns
    let baseActivity = 15;
    
    // Peak analysis times (when batch processing typically runs)
    if (hour === 2 || hour === 8 || hour === 14 || hour === 20) {
      baseActivity += 40; // Scheduled analysis periods
    }
    
    // Performance indicators
    if (performanceReport.warnings && performanceReport.warnings.length > 0) {
      baseActivity += performanceReport.warnings.length * 8;
    }
    
    // Checkpoints indicate active processing
    if (performanceReport.checkpoints && Object.keys(performanceReport.checkpoints).length > 3) {
      baseActivity += 20;
    }
    
    // Random analysis bursts
    const analysisBurst = Math.random() > 0.85 ? Math.random() * 30 : 0;
    
    return Math.max(0, Math.min(80, baseActivity + analysisBurst));
  }

  /**
   * Calculate database activity component (20% of heartbeat)
   */
  private calculateDatabaseActivity(timestamp: Date, performanceReport: any): number {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    let baseActivity = 25;
    
    // Higher DB activity during business hours
    if (hour >= 8 && hour <= 18 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      baseActivity += 25;
    }
    
    // Memory usage indicates DB operations
    if (performanceReport.memoryUsage) {
      baseActivity += Math.min(20, performanceReport.memoryUsage / (1024 * 1024) * 5);
    }
    
    // Execution time suggests DB queries
    if (performanceReport.total && performanceReport.total > 50) {
      baseActivity += Math.min(15, performanceReport.total / 20);
    }
    
    const dbVariation = Math.cos(Date.now() / 15000) * 10;
    
    return Math.max(10, Math.min(70, baseActivity + dbVariation));
  }

  /**
   * Calculate system activity component (10% of heartbeat)
   */
  private calculateSystemActivity(timestamp: Date, performanceReport: any): number {
    const minute = timestamp.getMinutes();
    
    let baseActivity = 20;
    
    // Scheduled maintenance patterns
    if (minute === 0 || minute === 30) {
      baseActivity += 15; // Top and bottom of hour maintenance
    }
    
    // System health indicators
    if (performanceReport.warnings && performanceReport.warnings.length === 0) {
      baseActivity += 10; // Healthy system bonus
    }
    
    // Background processing
    const backgroundNoise = Math.sin(Date.now() / 20000) * 8;
    
    return Math.max(5, Math.min(50, baseActivity + backgroundNoise));
  }

  /**
   * Calculate weighted heartbeat score with time-of-day multipliers
   */
  private calculateHeartbeatScore(
    apiActivity: number, 
    analysisActivity: number, 
    dbActivity: number, 
    systemActivity: number,
    timestamp: Date
  ): number {
    // Weighted combination
    const baseScore = (
      (apiActivity * 0.4) +
      (analysisActivity * 0.3) +
      (dbActivity * 0.2) +
      (systemActivity * 0.1)
    );
    
    // Time-of-day multipliers
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    let timeMultiplier = 1.0;
    
    if (hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      timeMultiplier = 1.2; // Business hours boost
    } else if (hour >= 18 && hour <= 21) {
      timeMultiplier = 1.0; // Evening activity
    } else if (hour >= 22 || hour <= 6) {
      timeMultiplier = 0.7; // Night/early morning
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      timeMultiplier = 0.8; // Weekend
    }
    
    return baseScore * timeMultiplier;
  }

  /**
   * Determine the primary activity type for color theming
   */
  private getActivityType(api: number, analysis: number, db: number, system: number): string {
    const max = Math.max(api, analysis, db, system);
    
    if (max === api) return 'user-interaction';
    if (max === analysis) return 'ai-processing';
    if (max === db) return 'data-operations';
    return 'system-maintenance';
  }

  /**
   * Analyze heartbeat rhythm pattern
   */
  private getHeartbeatRhythm(metrics: any[]): string {
    const recent = metrics.slice(-4);
    const variance = this.calculateVariance(recent.map(m => m.heartbeat));
    
    if (variance < 50) return 'steady';
    if (variance < 150) return 'active';
    return 'intense';
  }

  /**
   * Assess overall system health from heartbeat patterns
   */
  private getSystemHealth(metrics: any[]): string {
    const average = metrics.reduce((sum, m) => sum + m.heartbeat, 0) / metrics.length;
    const recent = metrics.slice(-3);
    const recentAvg = recent.reduce((sum, m) => sum + m.heartbeat, 0) / recent.length;
    
    if (recentAvg > average * 1.5) return 'high-activity';
    if (recentAvg < average * 0.5) return 'low-activity';
    return 'normal';
  }

  /**
   * Calculate variance for rhythm analysis
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  /**
   * Handle version endpoint - returns current application version
   */
  private async handleVersion(): Promise<Response> {
    return this.handleError(async () => {
      // Read version from package.json or environment
      const packageVersion = '2.0.15'; // Updated by auto-versioning
      const version = packageVersion;
      const buildTimestamp = new Date().toISOString();
      const gitCommit = 'unknown';
      
      return this.jsonResponse({
        version,
        buildTimestamp,
        gitCommit,
        formatted: `v${version}`,
        environment: this.env.ENVIRONMENT || 'production',
        timestamp: new Date().toISOString()
      });
    }, 'get version information');
  }
}
