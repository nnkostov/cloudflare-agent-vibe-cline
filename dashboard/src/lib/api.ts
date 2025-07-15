import { QueryClient } from '@tanstack/react-query';

// API base URL - always use relative paths since we're serving from the same origin
const API_BASE_URL = '/api';

// Query client configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // 1 minute
      retry: 3,
    },
  },
});

// API client
class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
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
  async getStatus() {
    return this.request<{
      status: string;
      timestamp: string;
      environment: string;
      rateLimits: Record<string, any>;
      performance: Record<string, any>;
    }>('/status');
  }

  // Repositories
  async getTrendingRepos() {
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

  async getReposByTier(tier: 1 | 2 | 3) {
    return this.request<{
      tier: number;
      count: number;
      repos: any[];
    }>(`/repos/tier?tier=${tier}`);
  }

  // Analysis
  async analyzeRepository(owner: string, repo: string, force = false) {
    return this.request<any>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ repoOwner: owner, repoName: repo, force }),
    });
  }

  // Alerts
  async getAlerts() {
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
  async getDailyReport() {
    return this.request<{
      date: string;
      high_growth_repos: any[];
      investment_opportunities: any[];
      new_trends: any[];
      recent_alerts: any[];
      metrics: any;
    }>('/reports/daily');
  }

  async getEnhancedReport() {
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
  async triggerScan(options?: { topics?: string[]; minStars?: number }) {
    return this.request<{
      message: string;
      repositoriesFound: number;
      repositories: any[];
    }>('/scan', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async triggerComprehensiveScan() {
    return this.request<any>('/scan/comprehensive', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Agent initialization
  async initializeAgent() {
    return this.request<{
      message: string;
      nextRun: string;
      status: string;
    }>('/agent/init', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();

// Utility functions
export function formatNumber(num: number): string {
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
