-- Initialize production database with all required tables

-- Create repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,
  description TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  topics TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_analyzed TEXT
);

-- Create repo_metrics table
CREATE TABLE IF NOT EXISTS repo_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  forks INTEGER NOT NULL,
  open_issues INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  strengths TEXT NOT NULL,
  growth_potential TEXT NOT NULL,
  risks TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  scores TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create contributors table
CREATE TABLE IF NOT EXISTS contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  username TEXT NOT NULL,
  contributions INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, username)
);

-- Create trends table
CREATE TABLE IF NOT EXISTS trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL UNIQUE,
  repo_count INTEGER NOT NULL DEFAULT 1,
  total_stars INTEGER NOT NULL DEFAULT 0,
  avg_growth_rate REAL NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create repo_tiers table
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

-- Create commit_metrics table
CREATE TABLE IF NOT EXISTS commit_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  commit_count INTEGER NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  avg_commits_per_day REAL NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create release_history table
CREATE TABLE IF NOT EXISTS release_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  release_tag TEXT NOT NULL,
  release_name TEXT,
  published_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create pull_request_metrics table
CREATE TABLE IF NOT EXISTS pull_request_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  total_prs INTEGER NOT NULL DEFAULT 0,
  open_prs INTEGER NOT NULL DEFAULT 0,
  avg_merge_time_hours REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create issue_metrics table
CREATE TABLE IF NOT EXISTS issue_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  total_issues INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  avg_close_time_hours REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create star_history table
CREATE TABLE IF NOT EXISTS star_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  daily_growth INTEGER NOT NULL DEFAULT 0,
  weekly_growth INTEGER NOT NULL DEFAULT 0,
  monthly_growth INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create fork_analysis table
CREATE TABLE IF NOT EXISTS fork_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  total_forks INTEGER NOT NULL DEFAULT 0,
  active_forks INTEGER NOT NULL DEFAULT 0,
  fork_contribution_ratio REAL NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Create api_usage table
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_repositories_stars ON repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repositories_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_repo_metrics_repo_id ON repo_metrics(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_metrics_recorded ON repo_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_analyses_repo_id ON analyses(repo_id);
CREATE INDEX IF NOT EXISTS idx_alerts_repo_id ON alerts(repo_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts(sent_at);
CREATE INDEX IF NOT EXISTS idx_contributors_repo_id ON contributors(repo_id);
CREATE INDEX IF NOT EXISTS idx_trends_topic ON trends(topic);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_tier ON repo_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_scan ON repo_tiers(next_scan_due);
CREATE INDEX IF NOT EXISTS idx_commit_metrics_repo_id ON commit_metrics(repo_id);
CREATE INDEX IF NOT EXISTS idx_release_history_repo_id ON release_history(repo_id);
CREATE INDEX IF NOT EXISTS idx_star_history_repo_id ON star_history(repo_id);

-- Verify tables were created
SELECT 'Database initialization complete. Created ' || COUNT(*) || ' tables.' as status
FROM sqlite_master 
WHERE type = 'table';
