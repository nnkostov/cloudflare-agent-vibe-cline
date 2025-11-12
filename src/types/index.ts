// Type definitions for GitHub AI Intelligence Agent

export interface Env {
  // Bindings
  DB: D1Database;
  STORAGE: R2Bucket;
  GITHUB_AGENT: DurableObjectNamespace;
  
  // Secrets
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  
  // Environment variables
  ENVIRONMENT?: string;
}

// GitHub API types
export interface Repository {
  id: string;
  name: string;
  owner: string;
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  is_archived: boolean;
  is_fork: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
}

export interface RepoMetrics {
  repo_id: string;
  stars: number;
  forks: number;
  open_issues: number;
  watchers: number;
  contributors: number;
  commits_count: number;
  recorded_at: string;
}

// Enhanced metrics types
export interface CommitMetrics {
  repo_id: string;
  date: string;
  commit_count: number;
  unique_authors: number;
  additions: number;
  deletions: number;
}

export interface ReleaseMetrics {
  repo_id: string;
  release_id: string;
  tag_name: string;
  name: string | null;
  published_at: string;
  is_prerelease: boolean;
  is_draft: boolean;
  download_count: number;
  body: string | null;
}

export interface PullRequestMetrics {
  repo_id: string;
  period_start: string;
  period_end: string;
  total_prs: number;
  merged_prs: number;
  avg_time_to_merge_hours: number | null;
  unique_contributors: number;
  avg_review_comments: number | null;
}

export interface IssueMetrics {
  repo_id: string;
  period_start: string;
  period_end: string;
  total_issues: number;
  closed_issues: number;
  avg_time_to_close_hours: number | null;
  avg_time_to_first_response_hours: number | null;
  bug_issues: number;
  feature_issues: number;
}

export interface StarHistory {
  repo_id: string;
  date: string;
  star_count: number;
  daily_growth: number;
  weekly_growth_rate: number | null;
}

export interface ForkAnalysis {
  repo_id: string;
  analysis_date: string;
  total_forks: number;
  active_forks: number;
  forks_ahead: number;
  forks_with_stars: number;
  avg_fork_stars: number | null;
}

export interface RepoTier {
  repo_id: string;
  tier: 1 | 2 | 3; // 1: Hot prospects, 2: Rising stars, 3: Long tail
  stars: number; // Added to match database schema
  last_deep_scan: string | null;
  last_basic_scan: string | null;
  growth_velocity: number | null;
  engagement_score: number | null;
  scan_priority: number;
  next_scan_due: string; // Added to match database schema
}

export interface Contributor {
  username: string;
  contributions: number;
  profile_url: string;
  company: string | null;
  location: string | null;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
}

// Simplified Analysis types
export type ClaudeModel = 
  | 'claude-opus-4-20250514'        // Claude 4 Opus (latest, most capable)
  | 'claude-sonnet-4-20250514'      // Claude 4 Sonnet (latest, balanced)
  | 'claude-3-5-sonnet-20241022'    // Claude 3.5 Sonnet (fallback)
  | 'claude-3-5-sonnet-20240620'    // Claude 3.5 Sonnet (previous)
  | 'claude-3-opus-20240229'        // Claude 3 Opus
  | 'claude-3-sonnet-20240229'      // Claude 3 Sonnet
  | 'claude-3-haiku-20240307'       // Claude 3 Haiku
  | 'claude-3-5-haiku-20241022';    // Claude 3.5 Haiku (fast)

export type Recommendation = 'strong-buy' | 'buy' | 'watch' | 'pass';

export interface Analysis {
  repo_id: string;
  scores: {
    investment: number;
    innovation: number;
    team: number;
    market: number;
    // New scores for enhanced analysis with Claude-4
    technical_moat?: number;
    scalability?: number;
    developer_adoption?: number;
  };
  recommendation: Recommendation;
  summary: string;
  strengths: string[];
  risks: string[];
  questions: string[];
  // New fields for enhanced Claude-4 analysis
  growth_prediction?: string;
  investment_thesis?: string;
  competitive_analysis?: string;
  metadata: {
    model: ClaudeModel;
    cost: number;
    timestamp: string;
    tokens_used?: number;
    error?: string;
    fallback?: boolean;
  };
}

// Alert types
export interface Alert {
  id?: number;
  repo_id: string;
  type: 'high_growth' | 'investment_opportunity' | 'trend';
  level: 'urgent' | 'high' | 'medium';
  message: string;
  metadata?: Record<string, any>;
  sent_at?: string;
}

// Trend types
export interface Trend {
  id?: number;
  type: 'technology' | 'topic' | 'pattern';
  name: string;
  description: string;
  growth_rate: number;
  repo_count: number;
  total_stars: number;
  examples: string[];
  detected_at: string;
}

// Scoring types
export interface Score {
  total: number;
  growth: number;
  engagement: number;
  quality: number;
  factors: Record<string, number>;
}

// Configuration
export const CONFIG = {
  github: {
    topics: ['ai', 'llm', 'agents', 'machine-learning', 'gpt', 'langchain'],
    minStars: 100,
    scanInterval: 1, // hours
    // Comprehensive scanning configuration
    tiers: {
      hot: {
        maxRepos: 200,
        minStars: 100,
        scanDepth: 'deep', // All metrics
        scanFrequency: 1, // hours
      },
      rising: {
        maxRepos: 1000,
        minStars: 50,
        scanDepth: 'basic', // Core metrics only
        scanFrequency: 24, // hours
      },
      longtail: {
        maxRepos: 3000,
        minStars: 10,
        scanDepth: 'minimal', // Just stars/forks
        scanFrequency: 168, // weekly
      },
    },
    // Multi-dimensional search strategies
    searchStrategies: [
      { type: 'topic', query: 'topic:ai stars:>10' },
      { type: 'topic', query: 'topic:llm stars:>10' },
      { type: 'topic', query: 'topic:machine-learning stars:>10' },
      { type: 'language', query: 'language:python topic:ai stars:>50' },
      { type: 'language', query: 'language:typescript topic:ai stars:>50' },
      { type: 'recent', query: 'created:>2024-01-01 topic:ai stars:>20' },
      { type: 'trending', query: 'pushed:>2024-12-01 topic:llm stars:>50' },
    ],
  },
  claude: {
    models: {
      high: 'claude-opus-4-20250514' as ClaudeModel,              // Claude 4 Opus - most capable model
      medium: 'claude-sonnet-4-20250514' as ClaudeModel,          // Claude 4 Sonnet - balanced performance
      low: 'claude-3-5-haiku-20241022' as ClaudeModel,            // Claude 3.5 Haiku for efficiency
    },
    thresholds: { 
      high: 70,    // Use latest Claude 3.5 Sonnet for high-value repos
      medium: 50   // Use previous Claude 3.5 Sonnet for medium repos
    },
    maxTokens: { 
      opus: 4096,     // Claude Opus max limit
      sonnet: 8192,   // Claude 3.5 Sonnet supports 8192
      haiku: 4096     // Claude Haiku supports 4096
    },
    // Feature flags for migration
    useClaude4: true,
    enhancedAnalysis: true,
  },
  alerts: {
    growthThreshold: 200, // percent
    scoreThreshold: 80,
  },
  limits: {
    reposPerScan: 3500, // Total across all tiers
    analysesPerDay: 50,
    cacheHours: 168, // 7 days
    apiRequestsPerHour: 5000, // GitHub rate limit
  },
};

// Scoring configuration
export const SCORING = {
  weights: {
    growth: 0.4,
    engagement: 0.3,
    quality: 0.3,
  },
  factors: {
    growth: { stars: 0.5, forks: 0.3, contributors: 0.2 },
    engagement: { forkRatio: 0.4, issues: 0.3, topics: 0.3 },
    quality: { docs: 0.4, code: 0.3, activity: 0.3 },
  },
  thresholds: {
    highPotential: 70,
    veryHigh: 85,
  },
};
