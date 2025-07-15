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
export type ClaudeModel = 
  | 'claude-opus-4'                 // Claude Opus 4
  | 'claude-sonnet-4'               // Claude Sonnet 4
  | 'claude-3-opus-20240229'        // Legacy Claude 3 Opus
  | 'claude-3-sonnet-20240229'      // Legacy Claude 3 Sonnet
  | 'claude-3-haiku-20240307';      // Claude 3 Haiku (keeping for efficiency)

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
      high: 'claude-opus-4' as ClaudeModel,              // Claude Opus 4 for research-heavy analysis
      medium: 'claude-sonnet-4' as ClaudeModel,          // Claude Sonnet 4 for standard analysis
      low: 'claude-3-haiku-20240307' as ClaudeModel,     // Keep Haiku for efficiency
    },
    thresholds: { 
      high: 70,    // Lowered from 85 for aggressive Opus usage
      medium: 50   // Lowered from 70 to use Sonnet-4 more
    },
    maxTokens: { 
      opus: 16000,    // Doubled for deeper analysis
      sonnet: 8000,   // Doubled from 4000
      haiku: 1000     // Keep the same
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
