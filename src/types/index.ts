// Type definitions for GitHub AI Intelligence Agent

export interface Env {
  // Bindings
  DB: D1Database;
  STORAGE: R2Bucket;
  GITHUB_AGENT: DurableObjectNamespace;
  
  // Secrets
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY: string;
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
export type ClaudeModel = 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307';
export type Recommendation = 'strong-buy' | 'buy' | 'watch' | 'pass';

export interface Analysis {
  repo_id: string;
  scores: {
    investment: number;
    innovation: number;
    team: number;
    market: number;
  };
  recommendation: Recommendation;
  summary: string;
  strengths: string[];
  risks: string[];
  questions: string[];
  metadata: {
    model: ClaudeModel;
    cost: number;
    timestamp: string;
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
    scanInterval: 6, // hours
  },
  claude: {
    models: {
      high: 'claude-3-opus-20240229' as ClaudeModel,
      medium: 'claude-3-sonnet-20240229' as ClaudeModel,
      low: 'claude-3-haiku-20240307' as ClaudeModel,
    },
    thresholds: { high: 85, medium: 70 },
    maxTokens: { opus: 8000, sonnet: 4000, haiku: 1000 },
  },
  alerts: {
    growthThreshold: 200, // percent
    scoreThreshold: 80,
  },
  limits: {
    reposPerScan: 100,
    analysesPerDay: 50,
    cacheHours: 168, // 7 days
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
