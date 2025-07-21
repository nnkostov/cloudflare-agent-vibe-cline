-- Tail Worker Logs Table
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

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tail_logs_timestamp ON tail_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_tail_logs_outcome ON tail_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_tail_logs_log_level ON tail_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_tail_logs_error_name ON tail_logs(error_name);
CREATE INDEX IF NOT EXISTS idx_tail_logs_request_url ON tail_logs(request_url);

-- Aggregated metrics table for performance analysis
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

-- API usage tracking
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

-- Error tracking table
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

CREATE INDEX IF NOT EXISTS idx_error_summary_name ON error_summary(error_name);
CREATE INDEX IF NOT EXISTS idx_error_summary_resolved ON error_summary(resolved);
