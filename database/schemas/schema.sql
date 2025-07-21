-- GitHub AI Intelligence Agent Database Schema

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repositories(stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_updated ON repositories(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories(language);
CREATE INDEX IF NOT EXISTS idx_metrics_repo_time ON repo_metrics(repo_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_repo ON analyses(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_trends_growth ON trends(growth_rate DESC);
