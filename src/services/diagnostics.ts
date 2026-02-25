import type { Env } from "../types";
import { BaseService } from "./base";

interface TableInfo {
  name: string;
  rowCount: number;
  lastUpdated: string | null;
}

interface DataFreshnessInfo {
  table: string;
  lastUpdate: string | null;
  ageInHours: number | null;
  isStale: boolean;
  staleThresholdHours: number;
}

interface ScanHistoryEntry {
  timestamp: string;
  reposScanned: number;
  analysesPerformed: number;
  alertsSent: number;
  success: boolean;
  error?: string;
}

interface SystemHealth {
  databaseStatus: "healthy" | "degraded" | "error";
  dataFreshness: "fresh" | "stale" | "critical";
  lastScanStatus: "success" | "failed" | "unknown";
  missingTables: string[];
  recommendations: string[];
}

export class DiagnosticsService extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Check data freshness across all tables
   */
  async checkDataFreshness(): Promise<DataFreshnessInfo[]> {
    const tables = [
      { name: "repositories", column: "discovered_at", staleHours: 24 },
      { name: "repo_metrics", column: "recorded_at", staleHours: 48 },
      { name: "analyses", column: "created_at", staleHours: 168 },
      { name: "alerts", column: "sent_at", staleHours: 168 },
      { name: "commit_metrics", column: "recorded_at", staleHours: 48 },
      { name: "release_history", column: "recorded_at", staleHours: 168 },
      { name: "star_history", column: "recorded_at", staleHours: 48 },
      { name: "repo_tiers", column: "updated_at", staleHours: 48 },
    ];

    const freshnessInfo: DataFreshnessInfo[] = [];

    for (const table of tables) {
      try {
        const result = await this.env.DB.prepare(
          `SELECT MAX(${table.column}) as last_update FROM ${table.name}`,
        ).first<{ last_update: string | null }>();

        const lastUpdate = result?.last_update || null;
        let ageInHours: number | null = null;
        let isStale = false;

        if (lastUpdate) {
          const lastUpdateDate = new Date(lastUpdate);
          const now = new Date();
          ageInHours =
            (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);
          isStale = ageInHours > table.staleHours;
        } else {
          isStale = true;
        }

        freshnessInfo.push({
          table: table.name,
          lastUpdate,
          ageInHours,
          isStale,
          staleThresholdHours: table.staleHours,
        });
      } catch (error) {
        // Table might not exist
        freshnessInfo.push({
          table: table.name,
          lastUpdate: null,
          ageInHours: null,
          isStale: true,
          staleThresholdHours: table.staleHours,
        });
      }
    }

    return freshnessInfo;
  }

  /**
   * Get scan history from various metrics
   */
  async getScanHistory(limit: number = 10): Promise<ScanHistoryEntry[]> {
    try {
      // Get daily stats for the last N days
      const days = [];
      for (let i = 0; i < limit; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split("T")[0]);
      }

      const history: ScanHistoryEntry[] = [];

      for (const day of days) {
        const [repos, analyses, alerts] = await Promise.all([
          this.env.DB.prepare(
            "SELECT COUNT(*) as count FROM repositories WHERE DATE(discovered_at) = ?",
          )
            .bind(day)
            .first<{ count: number }>(),
          this.env.DB.prepare(
            "SELECT COUNT(*) as count FROM analyses WHERE DATE(created_at) = ?",
          )
            .bind(day)
            .first<{ count: number }>(),
          this.env.DB.prepare(
            "SELECT COUNT(*) as count FROM alerts WHERE DATE(sent_at) = ?",
          )
            .bind(day)
            .first<{ count: number }>(),
        ]);

        history.push({
          timestamp: day,
          reposScanned: repos?.count || 0,
          analysesPerformed: analyses?.count || 0,
          alertsSent: alerts?.count || 0,
          success: (repos?.count || 0) > 0,
        });
      }

      return history;
    } catch (error) {
      return [
        {
          timestamp: new Date().toISOString(),
          reposScanned: 0,
          analysesPerformed: 0,
          alertsSent: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ];
    }
  }

  /**
   * Check if all required tables exist
   */
  async checkTables(): Promise<TableInfo[]> {
    // Static column map — no runtime introspection needed
    const requiredTables: Array<{
      name: string;
      timestampColumn: string | null;
    }> = [
      { name: "repositories", timestampColumn: "updated_at" },
      { name: "repo_metrics", timestampColumn: "recorded_at" },
      { name: "analyses", timestampColumn: "created_at" },
      { name: "alerts", timestampColumn: "sent_at" },
      { name: "contributors", timestampColumn: "created_at" },
      { name: "trends", timestampColumn: "detected_at" },
      { name: "repo_tiers", timestampColumn: "updated_at" },
      { name: "commit_metrics", timestampColumn: "recorded_at" },
      { name: "release_history", timestampColumn: "recorded_at" },
      { name: "pr_metrics", timestampColumn: "recorded_at" },
      { name: "issue_metrics", timestampColumn: "recorded_at" },
      { name: "star_history", timestampColumn: "recorded_at" },
      { name: "fork_analysis", timestampColumn: "recorded_at" },
      { name: "api_usage", timestampColumn: "timestamp" },
    ];

    const tableInfo: TableInfo[] = [];

    for (const table of requiredTables) {
      try {
        const countResult = await this.env.DB.prepare(
          `SELECT COUNT(*) as count FROM ${table.name}`,
        ).first<{ count: number }>();

        let lastUpdated: string | null = null;
        if (table.timestampColumn) {
          const result = await this.env.DB.prepare(
            `SELECT MAX(${table.timestampColumn}) as last_update FROM ${table.name}`,
          ).first<{ last_update: string | null }>();
          lastUpdated = result?.last_update || null;
        }

        tableInfo.push({
          name: table.name,
          rowCount: countResult?.count || 0,
          lastUpdated,
        });
      } catch (error) {
        // Table doesn't exist
        tableInfo.push({
          name: table.name,
          rowCount: -1,
          lastUpdated: null,
        });
      }
    }

    return tableInfo;
  }

  /**
   * Get repositories by last scan time
   */
  async getStaleRepositories(hoursThreshold: number = 24): Promise<{
    total: number;
    stale: Array<{
      id: string;
      full_name: string;
      tier: number;
      last_scan: string | null;
      hours_since_scan: number | null;
    }>;
  }> {
    try {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - hoursThreshold);

      const staleRepos = await this.env.DB.prepare(
        `
        SELECT 
          r.id,
          r.full_name,
          COALESCE(rt.tier, 3) as tier,
          rt.last_basic_scan as last_scan,
          CASE 
            WHEN rt.last_basic_scan IS NOT NULL 
            THEN ROUND((julianday('now') - julianday(rt.last_basic_scan)) * 24, 2)
            ELSE NULL
          END as hours_since_scan
        FROM repositories r
        LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
        WHERE rt.last_basic_scan IS NULL 
           OR rt.last_basic_scan < ?
        ORDER BY rt.tier ASC, r.stars DESC
        LIMIT 20
      `,
      )
        .bind(cutoff.toISOString())
        .all();

      const totalResult = await this.env.DB.prepare(
        "SELECT COUNT(*) as count FROM repositories",
      ).first<{ count: number }>();

      return {
        total: totalResult?.count || 0,
        stale: staleRepos.results as any[],
      };
    } catch (error) {
      console.error("Error getting stale repositories:", error);
      return { total: 0, stale: [] };
    }
  }

  /**
   * Get overall system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const [tables, freshness, scanHistory] = await Promise.all([
      this.checkTables(),
      this.checkDataFreshness(),
      this.getScanHistory(1),
    ]);

    // Check for missing tables
    const missingTables = tables
      .filter((t) => t.rowCount === -1)
      .map((t) => t.name);

    // Check database status
    const databaseStatus =
      missingTables.length === 0
        ? "healthy"
        : missingTables.includes("repositories") ||
            missingTables.includes("repo_tiers")
          ? "error"
          : "degraded";

    // Check data freshness
    const staleCount = freshness.filter((f) => f.isStale).length;
    const dataFreshness =
      staleCount === 0
        ? "fresh"
        : staleCount > freshness.length / 2
          ? "critical"
          : "stale";

    // Check last scan status
    const lastScan = scanHistory[0];
    const lastScanStatus = lastScan
      ? lastScan.success
        ? "success"
        : "failed"
      : "unknown";

    // Generate recommendations
    const recommendations: string[] = [];

    if (missingTables.includes("repo_tiers")) {
      recommendations.push(
        "Run migrate-repo-tiers.sql to create missing repo_tiers table",
      );
    }

    if (dataFreshness === "critical") {
      recommendations.push(
        "Data is critically stale. Check if scheduled scans are running",
      );
    }

    if (lastScanStatus === "failed") {
      recommendations.push("Last scan failed. Check worker logs for errors");
    }

    const staleTables = freshness.filter((f) => f.isStale).map((f) => f.table);

    if (staleTables.length > 0) {
      recommendations.push(`Stale data in tables: ${staleTables.join(", ")}`);
    }

    return {
      databaseStatus,
      dataFreshness,
      lastScanStatus,
      missingTables,
      recommendations,
    };
  }

  /**
   * Get tier distribution using active repository filtering for consistency
   * This matches the filtering logic used by StorageUnifiedService.getReposByTier()
   * and ensures consistent counts across Overview, Controls, and Leaderboard pages
   */
  async getTierDistribution(): Promise<{
    tier1: number;
    tier2: number;
    tier3: number;
    unassigned: number;
  }> {
    try {
      // Use active filtering (excluding archived and fork repositories) for ALL counts
      // This ensures consistency with Leaderboard page counts
      const [tier1, tier2, tier3, totalActive] = await Promise.all([
        this.env.DB.prepare(
          `
          SELECT COUNT(*) as count 
          FROM repositories r 
          JOIN repo_tiers rt ON r.id = rt.repo_id 
          WHERE rt.tier = 1 AND r.is_archived = 0 AND r.is_fork = 0
        `,
        ).first<{ count: number }>(),
        this.env.DB.prepare(
          `
          SELECT COUNT(*) as count 
          FROM repositories r 
          JOIN repo_tiers rt ON r.id = rt.repo_id 
          WHERE rt.tier = 2 AND r.is_archived = 0 AND r.is_fork = 0
        `,
        ).first<{ count: number }>(),
        this.env.DB.prepare(
          `
          SELECT COUNT(*) as count 
          FROM repositories r 
          JOIN repo_tiers rt ON r.id = rt.repo_id 
          WHERE rt.tier = 3 AND r.is_archived = 0 AND r.is_fork = 0
        `,
        ).first<{ count: number }>(),
        this.env.DB.prepare(
          `
          SELECT COUNT(*) as count 
          FROM repositories 
          WHERE is_archived = 0 AND is_fork = 0
        `,
        ).first<{ count: number }>(),
      ]);

      const assigned =
        (tier1?.count || 0) + (tier2?.count || 0) + (tier3?.count || 0);
      const unassigned = (totalActive?.count || 0) - assigned;

      return {
        tier1: tier1?.count || 0,
        tier2: tier2?.count || 0,
        tier3: tier3?.count || 0,
        unassigned: Math.max(0, unassigned),
      };
    } catch (error) {
      // repo_tiers table might not exist
      return {
        tier1: 0,
        tier2: 0,
        tier3: 0,
        unassigned: 0,
      };
    }
  }
}
