-- GitHub AI Intelligence Agent Complete Database Schema
-- This includes both original and enhanced tables

-- Original Tables
-- ===============

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

-- Simplified analyses table
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

-- Enhanced Tables
-- ===============

-- Repository tiers for prioritized scanning
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

-- Commit activity metrics
CREATE TABLE IF NOT EXISTS commit_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL,
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
  download_count INTEGER NOT NULL DEFAULT 0,
  body TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, release_id)
);

-- Pull request metrics
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

-- Issue metrics
CREATE TABLE IF NOT EXISTS issue_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  closed_issues INTEGER NOT NULL DEFAULT 0,
  avg_close_time_hours REAL,
  avg_response_time_hours REAL,
  issues_with_labels INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Star history for growth tracking
CREATE TABLE IF NOT EXISTS star_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL,
  stars INTEGER NOT NULL,
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
  total_forks INTEGER NOT NULL DEFAULT 0,
  active_forks INTEGER NOT NULL DEFAULT 0,
  forks_ahead INTEGER NOT NULL DEFAULT 0,
  avg_commits_ahead REAL,
  notable_forks TEXT, -- JSON array
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_metrics_repo_time ON repo_metrics(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_repo ON analyses(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_trends_growth ON trends(growth_rate DESC);

-- Enhanced indexes
CREATE INDEX IF NOT EXISTS idx_repo_tiers_tier ON repository_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_scan ON repository_tiers(next_scan_due);
CREATE INDEX IF NOT EXISTS idx_commit_metrics_repo_date ON commit_metrics(repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_releases_repo_date ON release_history(repo_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_metrics_repo ON pull_request_metrics(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_metrics_repo ON issue_metrics(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_star_history_repo_date ON star_history(repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fork_analysis_repo ON fork_analysis(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_usage(timestamp DESC);

-- Create repo_tiers as an alias/copy of repository_tiers structure
CREATE TABLE IF NOT EXISTS repo_tiers (
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
