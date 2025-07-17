import { BaseService } from './base';
import type { Env } from '../types';

interface LogQuery {
  startTime?: string;
  endTime?: string;
  level?: 'log' | 'error' | 'warn' | 'info' | 'debug';
  outcome?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

interface LogMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorCount: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
}

interface APIUsage {
  github: {
    total: number;
    search: number;
    remaining: number;
  };
  claude: {
    opus: number;
    sonnet: number;
    haiku: number;
    estimatedCost: number;
  };
}

interface ErrorSummary {
  name: string;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

export class LogsService extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Query recent logs with filtering
   */
  async queryLogs(query: LogQuery): Promise<any[]> {
    return this.handleError(async () => {
      let sql = `
        SELECT 
          id, timestamp, script_name, outcome, request_url, request_method,
          cf_colo, cf_country, duration_ms, log_level, log_message,
          error_name, error_message, api_calls, metrics
        FROM tail_logs
        WHERE 1=1
      `;
      const params: any[] = [];

      if (query.startTime) {
        sql += ' AND timestamp >= ?';
        params.push(query.startTime);
      }

      if (query.endTime) {
        sql += ' AND timestamp <= ?';
        params.push(query.endTime);
      }

      if (query.level) {
        sql += ' AND log_level = ?';
        params.push(query.level);
      }

      if (query.outcome) {
        sql += ' AND outcome = ?';
        params.push(query.outcome);
      }

      if (query.searchTerm) {
        sql += ' AND (log_message LIKE ? OR error_message LIKE ?)';
        params.push(`%${query.searchTerm}%`, `%${query.searchTerm}%`);
      }

      sql += ' ORDER BY timestamp DESC';
      
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);
      }

      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }

      const result = await this.env.DB.prepare(sql).bind(...params).all();
      
      // Parse JSON fields
      return result.results.map(row => ({
        ...row,
        api_calls: row.api_calls ? JSON.parse(row.api_calls as string) : null,
        metrics: row.metrics ? JSON.parse(row.metrics as string) : null,
      }));
    }, 'query logs');
  }

  /**
   * Get error summary
   */
  async getErrorSummary(hours: number = 24): Promise<ErrorSummary[]> {
    return this.handleError(async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const result = await this.env.DB.prepare(`
        SELECT 
          error_name,
          error_message,
          COUNT(*) as count,
          MIN(timestamp) as first_seen,
          MAX(timestamp) as last_seen
        FROM tail_logs
        WHERE error_name IS NOT NULL
          AND timestamp >= ?
        GROUP BY error_name, error_message
        ORDER BY count DESC
        LIMIT 50
      `).bind(since).all();

      return result.results.map(row => ({
        name: row.error_name as string,
        message: row.error_message as string,
        count: row.count as number,
        firstSeen: row.first_seen as string,
        lastSeen: row.last_seen as string,
        resolved: false,
      }));
    }, 'get error summary');
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(hours: number = 24): Promise<LogMetrics> {
    return this.handleError(async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const result = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN outcome = 'ok' THEN 1 END) as successful_requests,
          COUNT(CASE WHEN outcome != 'ok' THEN 1 END) as failed_requests,
          COUNT(CASE WHEN error_name IS NOT NULL THEN 1 END) as error_count,
          AVG(duration_ms) as avg_duration,
          MAX(duration_ms) as max_duration
        FROM tail_logs
        WHERE timestamp >= ?
      `).bind(since).first();

      // Calculate percentiles (simplified - in production, use proper percentile calculation)
      const durations = await this.env.DB.prepare(`
        SELECT duration_ms
        FROM tail_logs
        WHERE timestamp >= ? AND duration_ms IS NOT NULL
        ORDER BY duration_ms
      `).bind(since).all();

      const sortedDurations = durations.results
        .map(r => r.duration_ms as number)
        .filter(d => d > 0)
        .sort((a, b) => a - b);

      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p99Index = Math.floor(sortedDurations.length * 0.99);

      return {
        totalRequests: result?.total_requests as number || 0,
        successfulRequests: result?.successful_requests as number || 0,
        failedRequests: result?.failed_requests as number || 0,
        errorCount: result?.error_count as number || 0,
        avgDuration: result?.avg_duration as number || 0,
        p95Duration: sortedDurations[p95Index] || 0,
        p99Duration: sortedDurations[p99Index] || 0,
      };
    }, 'get performance metrics');
  }

  /**
   * Get API usage statistics
   */
  async getAPIUsage(hours: number = 24): Promise<APIUsage> {
    return this.handleError(async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const logs = await this.env.DB.prepare(`
        SELECT api_calls, log_message
        FROM tail_logs
        WHERE timestamp >= ?
          AND (api_calls IS NOT NULL OR log_message LIKE '%API%')
      `).bind(since).all();

      let githubTotal = 0;
      let githubSearch = 0;
      let claudeOpus = 0;
      let claudeSonnet = 0;
      let claudeHaiku = 0;

      for (const log of logs.results) {
        if (log.api_calls) {
          const calls = JSON.parse(log.api_calls as string);
          githubTotal += calls.github || 0;
          claudeOpus += calls.claude || 0;
        }

        const message = log.log_message as string || '';
        if (message.includes('GitHub Search API')) {
          githubSearch++;
        }
        if (message.includes('claude-opus-4')) {
          claudeOpus++;
        }
        if (message.includes('claude-sonnet-4')) {
          claudeSonnet++;
        }
        if (message.includes('claude-3-5-haiku')) {
          claudeHaiku++;
        }
      }

      // Estimate costs (example rates)
      const estimatedCost = 
        (claudeOpus * 0.015) +    // $15 per 1M tokens (estimate)
        (claudeSonnet * 0.003) +  // $3 per 1M tokens (estimate)
        (claudeHaiku * 0.00025);  // $0.25 per 1M tokens (estimate)

      return {
        github: {
          total: githubTotal,
          search: githubSearch,
          remaining: 5000 - githubTotal, // Assuming 5000 requests/hour limit
        },
        claude: {
          opus: claudeOpus,
          sonnet: claudeSonnet,
          haiku: claudeHaiku,
          estimatedCost: Math.round(estimatedCost * 100) / 100,
        },
      };
    }, 'get API usage');
  }

  /**
   * Get scan activity metrics
   */
  async getScanActivity(hours: number = 24): Promise<any> {
    return this.handleError(async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const logs = await this.env.DB.prepare(`
        SELECT timestamp, metrics
        FROM tail_logs
        WHERE timestamp >= ?
          AND metrics IS NOT NULL
        ORDER BY timestamp DESC
      `).bind(since).all();

      let totalScanned = 0;
      let totalAnalyzed = 0;
      let totalAlerts = 0;
      const timeline: any[] = [];

      for (const log of logs.results) {
        const metrics = JSON.parse(log.metrics as string);
        if (metrics.repos_scanned) totalScanned += metrics.repos_scanned;
        if (metrics.repos_analyzed) totalAnalyzed += metrics.repos_analyzed;
        if (metrics.alerts_generated) totalAlerts += metrics.alerts_generated;

        timeline.push({
          timestamp: log.timestamp,
          ...metrics,
        });
      }

      return {
        summary: {
          totalScanned,
          totalAnalyzed,
          totalAlerts,
          analysisRate: totalScanned > 0 ? (totalAnalyzed / totalScanned) * 100 : 0,
        },
        timeline: timeline.slice(0, 100), // Last 100 events
      };
    }, 'get scan activity');
  }

  /**
   * Get critical alerts from logs
   */
  async getCriticalAlerts(hours: number = 24): Promise<any[]> {
    return this.handleError(async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const result = await this.env.DB.prepare(`
        SELECT *
        FROM tail_logs
        WHERE timestamp >= ?
          AND (
            error_message LIKE '%rate limit%'
            OR error_message LIKE '%API key%'
            OR error_name LIKE '%Critical%'
            OR log_message LIKE '%CRITICAL%'
            OR log_message LIKE '%ALERT%'
          )
        ORDER BY timestamp DESC
        LIMIT 50
      `).bind(since).all();

      return result.results.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        type: row.error_name || 'alert',
        message: row.error_message || row.log_message,
        requestUrl: row.request_url,
        outcome: row.outcome,
      }));
    }, 'get critical alerts');
  }

  /**
   * Aggregate metrics for dashboard
   */
  async aggregateHourlyMetrics(): Promise<void> {
    return this.handleError(async () => {
      const now = new Date();
      const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      const previousHour = new Date(currentHour.getTime() - 60 * 60 * 1000);

      const metrics = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN outcome = 'ok' THEN 1 END) as successful_requests,
          COUNT(CASE WHEN outcome != 'ok' THEN 1 END) as failed_requests,
          COUNT(CASE WHEN error_name IS NOT NULL THEN 1 END) as total_errors,
          AVG(duration_ms) as avg_duration_ms
        FROM tail_logs
        WHERE timestamp >= ? AND timestamp < ?
      `).bind(previousHour.toISOString(), currentHour.toISOString()).first();

      // Get API calls
      const apiCalls = await this.env.DB.prepare(`
        SELECT api_calls
        FROM tail_logs
        WHERE timestamp >= ? AND timestamp < ?
          AND api_calls IS NOT NULL
      `).bind(previousHour.toISOString(), currentHour.toISOString()).all();

      let githubCalls = 0;
      let claudeCalls = 0;

      for (const row of apiCalls.results) {
        const calls = JSON.parse(row.api_calls as string);
        githubCalls += calls.github || 0;
        claudeCalls += calls.claude || 0;
      }

      // Insert aggregated metrics
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO tail_metrics_hourly (
          hour, total_requests, successful_requests, failed_requests,
          total_errors, github_api_calls, claude_api_calls, avg_duration_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        previousHour.toISOString(),
        metrics?.total_requests || 0,
        metrics?.successful_requests || 0,
        metrics?.failed_requests || 0,
        metrics?.total_errors || 0,
        githubCalls,
        claudeCalls,
        metrics?.avg_duration_ms || 0
      ).run();
    }, 'aggregate hourly metrics');
  }
}
