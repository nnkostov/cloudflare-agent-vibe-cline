-- GitHub AI Intelligence Agent - Canonical Database Schema
-- This is the single source of truth for all table definitions.
-- Apply via: wrangler d1 execute github-intelligence --file=./database/schemas/schema-canonical.sql

-- =============
-- Core Tables
-- =============

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  topics TEXT, -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pushed_at TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_fork INTEGER NOT NULL DEFAULT 0,
  html_url TEXT,
  clone_url TEXT,
  default_branch TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Repository metrics history
CREATE TABLE IF NOT EXISTS repo_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  forks INTEGER NOT NULL,
  open_issues INTEGER NOT NULL,
  watchers INTEGER NOT NULL DEFAULT 0,
  contributors INTEGER NOT NULL DEFAULT 0,
  commits_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  investment_score INTEGER NOT NULL,
  innovation_score INTEGER NOT NULL,
  team_score INTEGER NOT NULL,
  market_score INTEGER NOT NULL,
  recommendation TEXT NOT NULL,
  summary TEXT NOT NULL,
  strengths TEXT NOT NULL, -- JSON array
  risks TEXT NOT NULL, -- JSON array
  questions TEXT NOT NULL, -- JSON array
  model TEXT NOT NULL,
  cost REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT, -- JSON object
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_at TEXT,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Contributors table
CREATE TABLE IF NOT EXISTS contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  username TEXT NOT NULL,
  contributions INTEGER NOT NULL,
  profile_url TEXT,
  company TEXT,
  location TEXT,
  bio TEXT,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  public_repos INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, username)
);

-- Trends table
CREATE TABLE IF NOT EXISTS trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  growth_rate REAL NOT NULL,
  repo_count INTEGER NOT NULL,
  total_stars INTEGER NOT NULL,
  examples TEXT NOT NULL, -- JSON array of repo IDs
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, name)
);

-- =================
-- Enhanced Tables
-- =================

-- Commit activity metrics
CREATE TABLE IF NOT EXISTS commit_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  commit_count INTEGER NOT NULL DEFAULT 0,
  unique_authors INTEGER NOT NULL DEFAULT 0,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  files_changed INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, date)
);

-- Release history
CREATE TABLE IF NOT EXISTS release_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  name TEXT,
  published_at TEXT NOT NULL,
  is_prerelease INTEGER NOT NULL DEFAULT 0,
  is_draft INTEGER NOT NULL DEFAULT 0,
  assets_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  body TEXT, -- Release notes
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, release_id)
);

-- Pull request metrics
CREATE TABLE IF NOT EXISTS pr_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_prs INTEGER NOT NULL DEFAULT 0,
  merged_prs INTEGER NOT NULL DEFAULT 0,
  avg_time_to_merge_hours REAL,
  unique_contributors INTEGER NOT NULL DEFAULT 0,
  avg_review_comments REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, period_start, period_end)
);

-- Issue metrics
CREATE TABLE IF NOT EXISTS issue_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  closed_issues INTEGER NOT NULL DEFAULT 0,
  avg_time_to_close_hours REAL,
  avg_time_to_first_response_hours REAL,
  bug_issues INTEGER NOT NULL DEFAULT 0,
  feature_issues INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, period_start, period_end)
);

-- Star history for growth tracking
CREATE TABLE IF NOT EXISTS star_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  star_count INTEGER NOT NULL,
  daily_growth INTEGER NOT NULL DEFAULT 0,
  weekly_growth_rate REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, date)
);

-- Fork network analysis
CREATE TABLE IF NOT EXISTS fork_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  analysis_date TEXT NOT NULL,
  total_forks INTEGER NOT NULL DEFAULT 0,
  active_forks INTEGER NOT NULL DEFAULT 0,
  forks_ahead INTEGER NOT NULL DEFAULT 0,
  forks_with_stars INTEGER NOT NULL DEFAULT 0,
  avg_fork_stars REAL,
  avg_commits_ahead REAL,
  notable_forks TEXT, -- JSON array
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, analysis_date)
);

-- Repository tiers for prioritized scanning.
-- Note: stars is denormalized from repositories.stars for query performance.
CREATE TABLE IF NOT EXISTS repo_tiers (
  repo_id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT 3 CHECK (tier IN (1, 2, 3)),
  stars INTEGER NOT NULL DEFAULT 0,
  last_deep_scan TEXT,
  last_basic_scan TEXT,
  growth_velocity REAL NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,
  scan_priority INTEGER NOT NULL DEFAULT 0,
  next_scan_due TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  requests_made INTEGER NOT NULL DEFAULT 0,
  rate_limit_remaining INTEGER,
  rate_limit_reset TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========
-- Indexes
-- ==========

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repos_archived_fork ON repositories(is_archived, is_fork);
CREATE INDEX IF NOT EXISTS idx_metrics_repo_time ON repo_metrics(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_repo ON analyses(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributors_repo ON contributors(repo_id);
CREATE INDEX IF NOT EXISTS idx_trends_growth ON trends(growth_rate DESC);

-- Enhanced table indexes
CREATE INDEX IF NOT EXISTS idx_commit_metrics_date ON commit_metrics(repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_release_history_date ON release_history(repo_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_metrics_period ON pr_metrics(repo_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_issue_metrics_period ON issue_metrics(repo_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_star_history_date ON star_history(repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fork_analysis_date ON fork_analysis(repo_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_tier ON repo_tiers(tier, scan_priority DESC);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_velocity ON repo_tiers(growth_velocity DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_usage(timestamp DESC);

-- ========================================
-- Deprecated Tables (data preservation)
-- ========================================
-- These tables were created by earlier schema versions (schema-complete.sql).
-- They are NOT used by application code, which uses repo_tiers and pr_metrics instead.
-- They are preserved here so existing data is not orphaned on fresh deployments.
-- To migrate data: INSERT INTO repo_tiers SELECT * FROM repository_tiers WHERE ...

-- Legacy duplicate of repo_tiers (schema-complete.sql created both)
CREATE TABLE IF NOT EXISTS repository_tiers (
  repo_id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  stars INTEGER NOT NULL,
  growth_velocity REAL NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,
  scan_priority INTEGER NOT NULL DEFAULT 0,
  last_deep_scan TEXT,
  last_basic_scan TEXT,
  next_scan_due TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Legacy PR metrics table (code uses pr_metrics with different column structure)
CREATE TABLE IF NOT EXISTS pull_request_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  total_prs INTEGER NOT NULL DEFAULT 0,
  open_prs INTEGER NOT NULL DEFAULT 0,
  merged_prs INTEGER NOT NULL DEFAULT 0,
  avg_merge_time_hours REAL,
  avg_review_time_hours REAL,
  unique_contributors INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- ========================================
-- Tail Worker Tables (observability)
-- ========================================
-- Used by src/tail-worker.ts for log ingestion and metrics aggregation.
-- Schema sourced from database/schemas/tail-logs-schema.sql.

-- Tail worker log entries
CREATE TABLE IF NOT EXISTS tail_logs (
  id TEXT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  script_name TEXT NOT NULL,
  outcome TEXT NOT NULL,
  request_url TEXT,
  request_method TEXT,
  cf_colo TEXT,
  cf_country TEXT,
  duration_ms INTEGER,
  log_level TEXT,
  log_message TEXT,
  error_name TEXT,
  error_message TEXT,
  error_stack TEXT,
  api_calls TEXT, -- JSON string
  metrics TEXT,   -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Aggregated metrics for performance analysis
CREATE TABLE IF NOT EXISTS tail_metrics_hourly (
  hour DATETIME PRIMARY KEY,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  github_api_calls INTEGER DEFAULT 0,
  claude_api_calls INTEGER DEFAULT 0,
  repos_scanned INTEGER DEFAULT 0,
  repos_analyzed INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  avg_duration_ms REAL,
  p95_duration_ms REAL,
  p99_duration_ms REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily API usage tracking
CREATE TABLE IF NOT EXISTS api_usage_daily (
  date DATE PRIMARY KEY,
  github_calls INTEGER DEFAULT 0,
  github_search_calls INTEGER DEFAULT 0,
  claude_opus_calls INTEGER DEFAULT 0,
  claude_sonnet_calls INTEGER DEFAULT 0,
  claude_haiku_calls INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Error tracking and aggregation
CREATE TABLE IF NOT EXISTS error_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  error_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  first_seen DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  sample_stack TEXT,
  sample_request_url TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tail worker indexes
CREATE INDEX IF NOT EXISTS idx_tail_logs_timestamp ON tail_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_tail_logs_outcome ON tail_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_tail_logs_log_level ON tail_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_tail_logs_error_name ON tail_logs(error_name);
CREATE INDEX IF NOT EXISTS idx_tail_logs_request_url ON tail_logs(request_url);
CREATE INDEX IF NOT EXISTS idx_error_summary_name ON error_summary(error_name);
CREATE INDEX IF NOT EXISTS idx_error_summary_resolved ON error_summary(resolved);
