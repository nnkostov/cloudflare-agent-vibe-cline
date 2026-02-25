-- Production Database Migration: Fix schema mismatches
-- The production DB was created from schema-complete.sql, but the code
-- was written against schema-updates.sql. Four tables have incompatible
-- column structures. All four are empty (0 rows) so DROP is safe.
--
-- Run with: wrangler d1 execute github-intelligence --file=./database/schemas/migrate-production.sql
-- IMPORTANT: Verify tables are still empty before running!

-- =============================================
-- 1. star_history: production has "stars", code writes "star_count"
-- =============================================
DROP TABLE IF EXISTS star_history;
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
CREATE INDEX IF NOT EXISTS idx_star_history_date ON star_history(repo_id, date DESC);

-- =============================================
-- 2. fork_analysis: production missing analysis_date, forks_with_stars,
--    avg_fork_stars columns and UNIQUE constraint
-- =============================================
DROP TABLE IF EXISTS fork_analysis;
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
CREATE INDEX IF NOT EXISTS idx_fork_analysis_date ON fork_analysis(repo_id, analysis_date DESC);

-- =============================================
-- 3. issue_metrics: production has completely different columns
--    (open_issues, issues_with_labels, avg_close_time_hours, avg_response_time_hours)
--    Code writes: period_start, period_end, bug_issues, feature_issues,
--    avg_time_to_close_hours, avg_time_to_first_response_hours
-- =============================================
DROP TABLE IF EXISTS issue_metrics;
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
CREATE INDEX IF NOT EXISTS idx_issue_metrics_period ON issue_metrics(repo_id, period_end DESC);

-- =============================================
-- 4. pr_metrics: does not exist in production (only pull_request_metrics
--    with different column structure). Create the table the code expects.
-- =============================================
DROP TABLE IF EXISTS pr_metrics;
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
CREATE INDEX IF NOT EXISTS idx_pr_metrics_period ON pr_metrics(repo_id, period_end DESC);
