-- Migration script to add repo_tiers table to production database
-- This fixes the "no such table: repo_tiers" error

-- Create the repo_tiers table if it doesn't exist
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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_repo_tiers_tier ON repo_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_repo_tiers_scan ON repo_tiers(next_scan_due);

-- Check if repository_tiers table exists and copy data if it does
-- This handles the case where the old table name was used
INSERT OR IGNORE INTO repo_tiers 
SELECT 
  repo_id,
  tier,
  stars,
  growth_velocity,
  engagement_score,
  scan_priority,
  last_deep_scan,
  last_basic_scan,
  next_scan_due,
  created_at,
  updated_at
FROM repository_tiers 
WHERE EXISTS (
  SELECT 1 FROM sqlite_master 
  WHERE type='table' AND name='repository_tiers'
);

-- Populate repo_tiers with existing repositories if the table is empty
-- This ensures all repositories have tier assignments
INSERT OR IGNORE INTO repo_tiers (repo_id, tier, stars, growth_velocity, engagement_score, scan_priority, next_scan_due)
SELECT 
  r.id as repo_id,
  CASE 
    WHEN r.stars >= 100 THEN 1
    WHEN r.stars >= 50 THEN 2
    ELSE 3
  END as tier,
  r.stars,
  0 as growth_velocity,
  0 as engagement_score,
  0 as scan_priority,
  datetime('now', '+1 hour') as next_scan_due
FROM repositories r
WHERE NOT EXISTS (
  SELECT 1 FROM repo_tiers rt WHERE rt.repo_id = r.id
);

-- Verify the migration
SELECT 
  'Migration completed. repo_tiers table now contains ' || COUNT(*) || ' repositories' as status
FROM repo_tiers;
