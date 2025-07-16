import type { Env } from '../types';
import { BaseService } from './base';

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
  databaseStatus: 'healthy' | 'degraded' | 'error';
  dataFreshness: 'fresh' | 'stale' | 'critical';
  lastScanStatus: 'success' | 'failed' | 'unknown';
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
      { name: 'repositories', column: 'discovered_at', staleHours: 24 },
      { name: 'repo_metrics', column: 'recorded_at', staleHours: 6 },
      { name: 'analyses', column: 'created_at', staleHours: 168 },
      { name: 'alerts', column: 'sent_at', staleHours: 24 },
      { name: 'commit_metrics', column: 'recorded_at', staleHours: 24 },
      { name: 'release_history', column: 'recorded_at', staleHours: 48 },
      { name: 'star_history', column: 'recorded_at', staleHours: 24 },
      { name: 'repo_tiers', column: 'updated_at', staleHours: 12 },
    ];

    const freshnessInfo: DataFreshnessInfo[] = [];

    for (const table of tables) {
      try {
        const result = await this.env.DB.prepare(
          `SELECT MAX(${table.column}) as last_update FROM ${table.name}`
        ).first<{ last_update: string | null }>();

        const lastUpdate = result?.last_update || null;
        let ageInHours: number | null = null;
        let isStale = false;

        if (lastUpdate) {
          const lastUpdateDate = new Date(lastUpdate);
          const now = new Date();
          ageInHours = (now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60);
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
        days.push(date.toISOString().split('T')[0]);
      }

      const history: ScanHistoryEntry[] = [];

      for (const day of days) {
        const [repos, analyses, alerts] = await Promise.all([
          this.env.DB.prepare(
            "SELECT COUNT(*) as count FROM repositories WHERE DATE(discovered_at) = ?"
          ).bind(day).first<{ count: number }>(),
          this.env.DB.prepare(
            "SELECT COUNT(*) as count FROM analyses WHERE DATE(created_at) = ?"
          ).bind(day).first<{ count: number }>(),
          this.env.DB.prepare(
            "SELECT COUNT(*) as count FROM alerts WHERE DATE(sent_at) = ?"
          ).bind(day).first<{ count: number }>(),
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
      return [{
        timestamp: new Date().toISOString(),
        reposScanned: 0,
        analysesPerformed: 0,
        alertsSent: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }];
    }
  }

  /**
   * Check if all required tables exist
   */
  async checkTables(): Promise<TableInfo[]> {
    const requiredTables = [
      'repositories',
      'repo_metrics',
      'analyses',
      'alerts',
      'contributors',
      'trends',
      'repository_tiers',
      'repo_tiers',
      'commit_metrics',
      'release_history',
      'pull_request_metrics',
      'issue_metrics',
      'star_history',
      'fork_analysis',
      'api_usage',
    ];

    const tableInfo: TableInfo[] = [];

    for (const tableName of requiredTables) {
      try {
        const countResult = await this.env.DB.prepare(
          `SELECT COUNT(*) as count FROM ${tableName}`
        ).first<{ count: number }>();

        const lastUpdateResult = await this.env.DB.prepare(
          `SELECT MAX(
            CASE 
              WHEN EXISTS (SELECT 1 FROM pragma_table_info('${tableName}') WHERE name = 'created_at') THEN created_at
              WHEN EXISTS (SELECT 1 FROM pragma_table_info('${tableName}') WHERE name = 'recorded_at') THEN recorded_at
              WHEN EXISTS (SELECT 1 FROM pragma_table_info('${tableName}') WHERE name = 'updated_at') THEN updated_at
              WHEN EXISTS (SELECT 1 FROM pragma_table_info('${tableName}') WHERE name = 'sent_at') THEN sent_at
              WHEN EXISTS (SELECT 1 FROM pragma_table_info('${tableName}') WHERE name = 'discovered_at') THEN discovered_at
              ELSE NULL
            END
          ) as last_update FROM ${tableName}`
        ).first<{ last_update: string | null }>();

        tableInfo.push({
          name: tableName,
          rowCount: countResult?.count || 0,
          lastUpdated: lastUpdateResult?.last_update || null,
        });
      } catch (error) {
        // Table doesn't exist
        tableInfo.push({
          name: tableName,
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

      const staleRepos = await this.env.DB.prepare(`
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
      `).bind(cutoff.toISOString()).all();

      const totalResult = await this.env.DB.prepare(
        "SELECT COUNT(*) as count FROM repositories"
      ).first<{ count: number }>();

      return {
        total: totalResult?.count || 0,
        stale: staleRepos.results as any[],
      };
    } catch (error) {
      console.error('Error getting stale repositories:', error);
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
      .filter(t => t.rowCount === -1)
      .map(t => t.name);

    // Check database status
    const databaseStatus = missingTables.length === 0 
      ? 'healthy' 
      : missingTables.includes('repositories') || missingTables.includes('repo_tiers')
        ? 'error'
        : 'degraded';

    // Check data freshness
    const staleCount = freshness.filter(f => f.isStale).length;
    const dataFreshness = staleCount === 0 
      ? 'fresh' 
      : staleCount > freshness.length / 2
        ? 'critical'
        : 'stale';

    // Check last scan status
    const lastScan = scanHistory[0];
    const lastScanStatus = lastScan 
      ? lastScan.success ? 'success' : 'failed'
      : 'unknown';

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (missingTables.includes('repo_tiers')) {
      recommendations.push('Run migrate-repo-tiers.sql to create missing repo_tiers table');
    }
    
    if (dataFreshness === 'critical') {
      recommendations.push('Data is critically stale. Check if scheduled scans are running');
    }
    
    if (lastScanStatus === 'failed') {
      recommendations.push('Last scan failed. Check worker logs for errors');
    }

    const staleTables = freshness
      .filter(f => f.isStale)
      .map(f => f.table);
    
    if (staleTables.length > 0) {
      recommendations.push(`Stale data in tables: ${staleTables.join(', ')}`);
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
   * Get tier distribution
   */
  async getTierDistribution(): Promise<{
    tier1: number;
    tier2: number;
    tier3: number;
    unassigned: number;
  }> {
    try {
      const [tier1, tier2, tier3, total] = await Promise.all([
        this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM repo_tiers WHERE tier = 1"
        ).first<{ count: number }>(),
        this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM repo_tiers WHERE tier = 2"
        ).first<{ count: number }>(),
        this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM repo_tiers WHERE tier = 3"
        ).first<{ count: number }>(),
        this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM repositories"
        ).first<{ count: number }>(),
      ]);

      const assigned = (tier1?.count || 0) + (tier2?.count || 0) + (tier3?.count || 0);
      const unassigned = (total?.count || 0) - assigned;

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
