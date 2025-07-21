-- Simple script to just create the repo_tiers table that's needed for Quick Scan

-- First, create repositories table if it doesn't exist
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

-- Create the repo_tiers table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_repo_tiers_tier ON repo_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_scan ON repo_tiers(next_scan_due);

-- Verify
SELECT 'repo_tiers table created successfully' as status;
