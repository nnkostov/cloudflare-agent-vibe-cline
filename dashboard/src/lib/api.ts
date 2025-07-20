import { QueryClient } from '@tanstack/react-query';

// API base URL - always use relative paths since we're serving from the same origin
const API_BASE_URL = '/api';

// Query client configuration with faster defaults for real-time feel
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000, // 5 seconds - consider data stale faster
      refetchInterval: 10 * 1000, // 10 seconds default refresh
      refetchIntervalInBackground: true, // Keep refreshing in background
      retry: 2, // Reduce retries for faster response
    },
  },
});

// API client
class ApiClient {
  private request = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`[API] ${options?.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const responseText = await response.text();
      console.log(`[API] Response status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If response is not JSON, use the text
          if (responseText) {
            errorMessage = responseText;
          }
        }
        console.error(`[API] Error response:`, errorMessage);
        throw new Error(errorMessage);
      }

      try {
        const data = JSON.parse(responseText);
        console.log(`[API] Success response:`, data);
        return data;
      } catch {
        console.error(`[API] Failed to parse JSON response:`, responseText);
        throw new Error('Invalid JSON response from server');
      }
    } catch (error) {
      console.error(`[API] Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // System status
  getStatus = async () => {
    return this.request<{
      status: string;
      timestamp: string;
      environment: string;
      scanInterval?: number;
      rateLimits: Record<string, any>;
      performance: Record<string, any>;
    }>('/status');
  }

  // Repositories
  getTrendingRepos = async () => {
    return this.request<{
      repositories: Array<{
        id: string;
        name: string;
        owner: string;
        full_name: string;
        description: string | null;
        stars: number;
        forks: number;
        language: string | null;
        topics: string[];
        latest_analysis?: any;
      }>;
      total: number;
    }>('/repos/trending');
  }

  getReposByTier = async (tier: 1 | 2 | 3, page: number = 1, limit: number = 50) => {
    return this.request<{
      tier: number;
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      repos: any[];
    }>(`/repos/tier?tier=${tier}&page=${page}&limit=${limit}`);
  }

  // Analysis
  analyzeRepository = async (owner: string, repo: string, force = false) => {
    return this.request<any>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ repoOwner: owner, repoName: repo, force }),
    });
  }

  // Alerts
  getAlerts = async () => {
    return this.request<{
      alerts: Array<{
        id: number;
        repo_id: string;
        type: string;
        level: string;
        message: string;
        metadata?: Record<string, any>;
        sent_at: string;
      }>;
    }>('/alerts');
  }

  // Reports
  getDailyReport = async () => {
    return this.request<{
      date: string;
      high_growth_repos: any[];
      investment_opportunities: any[];
      new_trends: any[];
      recent_alerts: any[];
      metrics: any;
    }>('/reports/daily');
  }

  getEnhancedReport = async () => {
    return this.request<{
      date: string;
      tier_summary: any;
      high_growth_repos_with_metrics: any[];
      recent_alerts: any[];
      system_metrics: any;
      total_monitored_repos: number;
    }>('/reports/enhanced');
  }

  // Scanning
  triggerScan = async (options?: { topics?: string[]; minStars?: number }) => {
    return this.request<{
      message: string;
      repositoriesFound: number;
      repositories: any[];
    }>('/scan', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  triggerComprehensiveScan = async (force: boolean = false) => {
    const url = force ? '/scan/comprehensive?force=true' : '/scan/comprehensive';
    return this.request<any>(url, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Agent initialization
  initializeAgent = async () => {
    return this.request<{
      message: string;
      nextRun: string;
      status: string;
    }>('/agent/init', {
      method: 'POST',
    });
  }

  // Batch analysis
  triggerBatchAnalysis = async (target: 'visible' | 'tier1' | 'tier2' | 'all' = 'visible', force: boolean = false) => {
    return this.request<{
      message: string;
      batchId?: string | null;
      target: string;
      totalRepos: number;
      needingAnalysis: number;
      queued: number;
      batchSize?: number;
      delayBetweenAnalyses?: string;
      maxRetries?: number;
      estimatedCompletionTime?: string;
      reason?: string;
      suggestion?: string;
      analysisStats?: {
        tier1: string;
        tier2: string;
        tier3: string;
        totalRemaining: number;
      };
      repositories: Array<{
        name: string;
        priority?: number;
        tier?: number;
      }> | string[];
    }>('/analyze/batch', {
      method: 'POST',
      body: JSON.stringify({ target, force }),
    });
  }

  // Batch analysis status
  getBatchAnalysisStatus = async (batchId: string) => {
    return this.request<{
      batchId: string;
      status: 'running' | 'completed' | 'failed' | 'not_found';
      progress?: {
        total: number;
        completed: number;
        failed: number;
        currentRepository: string | null;
        startTime: number;
        estimatedCompletion: number | null;
      };
      error?: string;
    }>(`/analyze/batch/status?batchId=${encodeURIComponent(batchId)}`);
  }

  // Analysis statistics
  getAnalysisStats = async () => {
    return this.request<{
      timestamp: string;
      totalRepositories: number;
      analyzedRepositories: number;
      remainingRepositories: number;
      analysisProgress: number;
      tierBreakdown: {
        tier1: {
          total: number;
          analyzed: number;
          remaining: number;
          progress: number;
        };
        tier2: {
          total: number;
          analyzed: number;
          remaining: number;
          progress: number;
        };
        tier3: {
          total: number;
          analyzed: number;
          remaining: number;
          progress: number;
        };
      };
      batchInfo: {
        batchSize: number;
        estimatedBatchesRemaining: number;
        estimatedTimeRemaining: string;
      };
      recommendations: string[];
    }>('/analysis/stats');
  }

  // System Heartbeat
  getWorkerMetrics = async () => {
    return this.request<{
      timestamp: string;
      type: 'heartbeat';
      metrics: Array<{
        timestamp: string;
        heartbeat: number;
        components: {
          apiActivity: number;
          analysisActivity: number;
          dbActivity: number;
          systemActivity: number;
        };
        activityType: 'user-interaction' | 'ai-processing' | 'data-operations' | 'system-maintenance';
      }>;
      summary: {
        averageHeartbeat: number;
        peakHeartbeat: number;
        currentRhythm: 'steady' | 'active' | 'intense';
        systemHealth: 'high-activity' | 'normal' | 'low-activity';
      };
      performance: {
        totalExecutionTime: number;
        checkpoints: number;
        warnings: number;
        memoryUsage?: number;
        summary: string;
      };
    }>('/worker-metrics');
  }
}

export const api = new ApiClient();

// Utility functions
export function formatNumber(num: number | undefined | null): string {
  // Handle undefined, null, or invalid numbers
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

export function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-blue-600 dark:text-blue-400';
  if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-600 dark:text-gray-400';
}

export function getRecommendationBadge(recommendation: string): {
  color: string;
  text: string;
} {
  switch (recommendation) {
    case 'strong-buy':
      return { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', text: 'Strong Buy' };
    case 'buy':
      return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', text: 'Buy' };
    case 'watch':
      return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', text: 'Watch' };
    case 'pass':
      return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', text: 'Pass' };
    default:
      return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', text: recommendation };
  }
}
