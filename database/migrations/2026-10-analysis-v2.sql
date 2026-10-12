-- Analysis v2 (Oct 2026, Claude 5.5 migration)
--
-- Adds the extended analysis fields (previously only archived to R2),
-- real token usage, a snapshot of the repo at analysis time (used to skip
-- re-analysis until something changes), and persistent-failure tracking.
--
-- Additive only: the code deployed before this migration keeps working.
-- Run BEFORE deploying the code that writes these columns:
--   wrangler d1 execute github-intelligence --remote --file=database/migrations/2026-10-analysis-v2.sql

ALTER TABLE analyses ADD COLUMN technical_moat_score INTEGER;
ALTER TABLE analyses ADD COLUMN scalability_score INTEGER;
ALTER TABLE analyses ADD COLUMN developer_adoption_score INTEGER;
ALTER TABLE analyses ADD COLUMN growth_prediction TEXT;
ALTER TABLE analyses ADD COLUMN investment_thesis TEXT;
ALTER TABLE analyses ADD COLUMN competitive_analysis TEXT;
ALTER TABLE analyses ADD COLUMN input_tokens INTEGER;
ALTER TABLE analyses ADD COLUMN output_tokens INTEGER;
ALTER TABLE analyses ADD COLUMN stars_at_analysis INTEGER;
ALTER TABLE analyses ADD COLUMN forks_at_analysis INTEGER;
ALTER TABLE analyses ADD COLUMN pushed_at_at_analysis TEXT;

ALTER TABLE repo_tiers ADD COLUMN last_analysis_attempt_at TEXT;
ALTER TABLE repo_tiers ADD COLUMN last_analysis_error TEXT;

-- Backfill the snapshot on each repo's latest analysis from the repo's
-- current values; latest analyses are at most ~7 days old, so this is a
-- close approximation. Old fallback analyses (saved as score 0 when the
-- response wasn't valid JSON) keep a NULL snapshot, which the selection
-- query treats as "changed", so those repos get re-analyzed soon.
UPDATE analyses
SET stars_at_analysis = (SELECT r.stars FROM repositories r WHERE r.id = analyses.repo_id),
    forks_at_analysis = (SELECT r.forks FROM repositories r WHERE r.id = analyses.repo_id),
    pushed_at_at_analysis = (SELECT r.pushed_at FROM repositories r WHERE r.id = analyses.repo_id)
WHERE id IN (SELECT MAX(id) FROM analyses GROUP BY repo_id)
  AND summary NOT LIKE 'Analysis could not be completed%';
