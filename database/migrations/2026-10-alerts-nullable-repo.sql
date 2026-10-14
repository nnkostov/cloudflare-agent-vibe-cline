-- Alerts: allow repo_id to be NULL for system alerts (Oct 2026)
--
-- alerts.repo_id is a foreign key to repositories(id). System alerts were
-- written with repo_id = 'system', which isn't a repository, so with
-- foreign keys enforced (D1 default) every system alert insert failed and
-- scan/analysis failures were never recorded. System alerts now use NULL,
-- which foreign keys allow; alerts for real repos are still checked.
--
-- SQLite can't change a column constraint in place, so the table is
-- rebuilt. alerts has no dependent tables. Run before deploying the code
-- that writes NULL:
--   wrangler d1 execute github-intelligence --remote --file=database/migrations/2026-10-alerts-nullable-repo.sql

CREATE TABLE alerts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT, -- NULL for system alerts
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT, -- JSON object
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_at TEXT,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

INSERT INTO alerts_new (id, repo_id, type, level, message, metadata, sent_at, acknowledged, acknowledged_at)
SELECT id, repo_id, type, level, message, metadata, sent_at, acknowledged, acknowledged_at FROM alerts;

DROP TABLE alerts;

ALTER TABLE alerts_new RENAME TO alerts;

CREATE INDEX IF NOT EXISTS idx_alerts_sent ON alerts(sent_at DESC);
