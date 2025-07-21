-- Enhanced GitHub Data Collection Schema Updates

-- Commit activity metrics
CREATE TABLE IF NOT EXISTS commit_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  commit_count INTEGER NOT NULL DEFAULT 0,
  unique_authors INTEGER NOT NULL DEFAULT 0,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
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
  period_start TEXT NOT NULL, -- Start of measurement period
  period_end TEXT NOT NULL,   -- End of measurement period
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

-- Star history
CREATE TABLE IF NOT EXISTS star_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  star_count INTEGER NOT NULL,
  daily_growth INTEGER NOT NULL DEFAULT 0,
  weekly_growth_rate REAL, -- Percentage
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, date)
);

-- Fork analysis
CREATE TABLE IF NOT EXISTS fork_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  analysis_date TEXT NOT NULL,
  total_forks INTEGER NOT NULL DEFAULT 0,
  active_forks INTEGER NOT NULL DEFAULT 0, -- Forks with recent commits
  forks_ahead INTEGER NOT NULL DEFAULT 0, -- Forks ahead of parent
  forks_with_stars INTEGER NOT NULL DEFAULT 0,
  avg_fork_stars REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, analysis_date)
);

-- Repository tiers for comprehensive scanning
CREATE TABLE IF NOT EXISTS repo_tiers (
  repo_id TEXT PRIMARY KEY,
  tier INTEGER NOT NULL DEFAULT 3, -- 1: Hot prospects, 2: Rising stars, 3: Long tail
  last_deep_scan TEXT,
  last_basic_scan TEXT,
  growth_velocity REAL, -- Stars per day
  engagement_score REAL,
  scan_priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commit_metrics_date ON commit_metrics(repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_release_history_date ON release_history(repo_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_metrics_period ON pr_metrics(repo_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_issue_metrics_period ON issue_metrics(repo_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_star_history_date ON star_history(repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fork_analysis_date ON fork_analysis(repo_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_tier ON repo_tiers(tier, scan_priority DESC);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_velocity ON repo_tiers(growth_velocity DESC);
