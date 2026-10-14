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

  // Deployed version id and upload time ([version_metadata] in wrangler.toml)
  CF_VERSION_METADATA?: WorkerVersionMetadata;
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

// Analysis types
export type ClaudeModel =
  | "claude-opus-5-5" // not in rotation (cost); kept so it can be switched back on
  | "claude-sonnet-5-5" // high- and medium-scoring repos
  | "claude-haiku-5-5"; // quick scan for the long tail

export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

export type Recommendation = "strong-buy" | "buy" | "watch" | "pass";

export interface Analysis {
  repo_id: string;
  scores: {
    investment: number;
    innovation: number;
    team: number;
    market: number;
    // Optional because analyses saved before Oct 2026 don't have them
    technical_moat?: number;
    scalability?: number;
    developer_adoption?: number;
  };
  recommendation: Recommendation;
  summary: string;
  strengths: string[];
  risks: string[];
  questions: string[];
  growth_prediction?: string;
  investment_thesis?: string;
  competitive_analysis?: string;
  metadata: {
    // The model that produced the analysis. A string rather than
    // ClaudeModel: older rows hold retired IDs, and a refusal fallback can
    // be served by a model outside the ClaudeModel set.
    model: string;
    cost: number;
    timestamp: string;
    input_tokens?: number;
    output_tokens?: number;
  };
}

// Alert types
export interface Alert {
  id?: number;
  repo_id: string | null; // null for system alerts
  type: "high_growth" | "investment_opportunity" | "trend" | "system";
  level: "urgent" | "high" | "medium";
  message: string;
  metadata?: Record<string, any>;
  sent_at?: string;
}

// Trend types
export interface Trend {
  id?: number;
  type: "technology" | "topic" | "pattern";
  name: string;
  description: string;
  growth_rate: number;
  repo_count: number;
  total_stars: number;
  examples: string[];
  detected_at: string;
}

// Orchestrator result types
export interface BatchResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; name: string; error: string }>;
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
    topics: ["ai", "llm", "agents", "machine-learning", "gpt", "langchain"],
    minStars: 100,
    scanInterval: 1, // hours
    // Comprehensive scanning configuration
    tiers: {
      hot: {
        maxRepos: 200,
        minStars: 100,
        scanDepth: "deep", // All metrics
        scanFrequency: 1, // hours
      },
      rising: {
        maxRepos: 1000,
        minStars: 50,
        scanDepth: "basic", // Core metrics only
        scanFrequency: 24, // hours
      },
      longtail: {
        maxRepos: 3000,
        minStars: 10,
        scanDepth: "minimal", // Just stars/forks
        scanFrequency: 168, // weekly
      },
    },
  },
  claude: {
    models: {
      // Sonnet rather than Opus for the high tier: ~45% cheaper per
      // analysis. Set back to "claude-opus-5-5" for deeper top-tier analysis.
      high: "claude-sonnet-5-5" as ClaudeModel,
      medium: "claude-sonnet-5-5" as ClaudeModel,
      low: "claude-haiku-5-5" as ClaudeModel,
    },
    thresholds: {
      high: 70, // score.total at or above this gets the high model
      medium: 50, // score.total at or above this gets the medium model
    },
    // Thinking is always on for these models and counts toward this cap,
    // so leave room beyond the ~2-3K-token analysis JSON.
    maxTokens: 16000,
    // How much the model thinks: the main quality/cost/latency lever.
    effort: {
      "claude-opus-5-5": "medium",
      "claude-sonnet-5-5": "medium",
      "claude-haiku-5-5": "low",
    } as Record<ClaudeModel, ClaudeEffort>,
    // USD per million tokens. Haiku's rate is for prompts up to 100K
    // tokens, which every analysis prompt is.
    pricing: {
      "claude-opus-5-5": { input: 4, output: 20 },
      "claude-sonnet-5-5": { input: 2, output: 10 },
      "claude-haiku-5-5": { input: 0.1, output: 0.5 },
    } as Record<ClaudeModel, { input: number; output: number }>,
    // Models with server-side refusal fallback. Haiku 5.5 has none; a
    // refused Haiku analysis is retried on the medium model instead.
    serverSideFallback: ["claude-opus-5-5", "claude-sonnet-5-5"] as ClaudeModel[],
  },
  alerts: {
    growthThreshold: 200, // percent
    scoreThreshold: 80,
  },
  limits: {
    reposPerScan: 3500, // Total across all tiers
    analysesPerDay: 200,
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
