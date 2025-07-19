import type { Env, Repository, RepoMetrics, Analysis, Alert, Contributor, Trend } from '../types';
import { BaseService } from './base';
import { BatchProcessor } from '../utils/batchProcessor';
import { PerformanceMonitor } from '../utils/performanceMonitor';

export class StorageService extends BaseService {
  private batchProcessor: BatchProcessor;
  private performanceMonitor: PerformanceMonitor;

  constructor(env: Env) {
    super(env);
    this.batchProcessor = new BatchProcessor(100, 5000);
    this.performanceMonitor = new PerformanceMonitor();
  }

  // Repository operations
  async saveRepository(repo: Repository): Promise<void> {
    return this.performanceMonitor.monitor('saveRepository', async () => {
      await this.dbRun(`
        INSERT OR REPLACE INTO repositories (
          id, name, owner, full_name, description, stars, forks, 
          open_issues, language, topics, created_at, updated_at, 
          pushed_at, is_archived, is_fork, html_url, clone_url, default_branch
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        repo.id, repo.name, repo.owner, repo.full_name, repo.description,
        repo.stars, repo.forks, repo.open_issues, repo.language,
        JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
        repo.pushed_at, repo.is_archived ? 1 : 0, repo.is_fork ? 1 : 0,
        repo.html_url, repo.clone_url, repo.default_branch
      );
    });
  }

  /**
   * Save multiple repositories in batch
   */
  async saveRepositoriesBatch(repos: Repository[]): Promise<void> {
    return this.performanceMonitor.monitor('saveRepositoriesBatch', async () => {
      const queries = repos.map(repo => ({
        sql: `
          INSERT OR REPLACE INTO repositories (
            id, name, owner, full_name, description, stars, forks, 
            open_issues, language, topics, created_at, updated_at, 
            pushed_at, is_archived, is_fork, html_url, clone_url, default_branch
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          repo.id, repo.name, repo.owner, repo.full_name, repo.description,
          repo.stars, repo.forks, repo.open_issues, repo.language,
          JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
          repo.pushed_at, repo.is_archived ? 1 : 0, repo.is_fork ? 1 : 0,
          repo.html_url, repo.clone_url, repo.default_branch
        ]
      }));

      const statements = this.prepareBatchStatements(queries);
      await this.dbBatch(statements);
    });
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    const result = await this.dbFirst<any>(
      'SELECT * FROM repositories WHERE id = ?',
      repoId
    );
    return result ? this.parseRepository(result) : null;
  }

  async getRepositoryByName(owner: string, name: string): Promise<Repository | null> {
    const result = await this.dbFirst<any>(
      'SELECT * FROM repositories WHERE owner = ? AND name = ?',
      owner, name
    );
    return result ? this.parseRepository(result) : null;
  }

  // Metrics operations
  async saveMetrics(metrics: RepoMetrics): Promise<void> {
    await this.dbRun(`
      INSERT INTO repo_metrics (
        repo_id, stars, forks, open_issues, watchers, contributors, commits_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      metrics.repo_id, metrics.stars, metrics.forks, metrics.open_issues,
      metrics.watchers, metrics.contributors, metrics.commits_count
    );
  }

  /**
   * Save multiple metrics in batch
   */
  async saveMetricsBatch(metricsList: RepoMetrics[]): Promise<void> {
    return this.performanceMonitor.monitor('saveMetricsBatch', async () => {
      const queries = metricsList.map(metrics => ({
        sql: `
          INSERT INTO repo_metrics (
            repo_id, stars, forks, open_issues, watchers, contributors, commits_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          metrics.repo_id, metrics.stars, metrics.forks, metrics.open_issues,
          metrics.watchers, metrics.contributors, metrics.commits_count
        ]
      }));

      const statements = this.prepareBatchStatements(queries);
      await this.dbBatch(statements);
    });
  }

  async getLatestMetrics(repoId: string): Promise<RepoMetrics | null> {
    return this.dbFirst<RepoMetrics>(
      'SELECT * FROM repo_metrics WHERE repo_id = ? ORDER BY recorded_at DESC LIMIT 1',
      repoId
    );
  }

  // Analysis operations
  async saveAnalysis(analysis: Analysis): Promise<void> {
    await this.dbRun(`
      INSERT INTO analyses (
        repo_id, investment_score, innovation_score, team_score, market_score,
        recommendation, summary, strengths, risks, questions, model, cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      analysis.repo_id, analysis.scores.investment, analysis.scores.innovation,
      analysis.scores.team, analysis.scores.market, analysis.recommendation,
      analysis.summary, JSON.stringify(analysis.strengths),
      JSON.stringify(analysis.risks), JSON.stringify(analysis.questions),
      analysis.metadata.model, analysis.metadata.cost
    );

    // Archive to R2
    await this.saveToR2(`analyses/${analysis.repo_id}/${Date.now()}.json`, analysis);
  }

  async getLatestAnalysis(repoId: string): Promise<Analysis | null> {
    const result = await this.dbFirst<any>(
      'SELECT * FROM analyses WHERE repo_id = ? ORDER BY created_at DESC LIMIT 1',
      repoId
    );
    return result ? this.parseAnalysis(result) : null;
  }

  async hasRecentAnalysis(repoId: string, hoursThreshold: number = 168): Promise<boolean> {
    const result = await this.dbFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM analyses 
       WHERE repo_id = ? AND created_at > datetime('now', '-' || ? || ' hours')`,
      repoId, hoursThreshold
    );
    return (result?.count || 0) > 0;
  }

  // Alert operations
  async saveAlert(alert: Alert): Promise<void> {
    await this.dbRun(`
      INSERT INTO alerts (repo_id, type, level, message, metadata)
      VALUES (?, ?, ?, ?, ?)`,
      alert.repo_id, alert.type, alert.level, alert.message,
      JSON.stringify(alert.metadata || {})
    );
  }

  async getRecentAlerts(limit: number = 10): Promise<Alert[]> {
    const results = await this.dbAll<any>(
      'SELECT * FROM alerts ORDER BY sent_at DESC LIMIT ?',
      limit
    );
    return results.map(this.parseAlert);
  }

  // Contributor operations
  async saveContributors(repoId: string, contributors: Contributor[]): Promise<void> {
    return this.performanceMonitor.monitor('saveContributors', async () => {
      const stmt = this.env.DB.prepare(`
        INSERT OR REPLACE INTO contributors (
          repo_id, username, contributions, profile_url, company,
          location, bio, followers, following, public_repos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await this.env.DB.batch(
        contributors.map(c => stmt.bind(
          repoId, c.username, c.contributions, c.profile_url, c.company,
          c.location, c.bio, c.followers, c.following, c.public_repos
        ))
      );
    });
  }

  // Trend operations
  async saveTrend(trend: Trend): Promise<void> {
    await this.dbRun(`
      INSERT OR REPLACE INTO trends (
        type, name, description, growth_rate, repo_count,
        total_stars, examples, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      trend.type, trend.name, trend.description, trend.growth_rate,
      trend.repo_count, trend.total_stars, JSON.stringify(trend.examples)
    );
  }

  async getRecentTrends(type?: string, limit: number = 10): Promise<Trend[]> {
    const query = type
      ? 'SELECT * FROM trends WHERE type = ? ORDER BY growth_rate DESC LIMIT ?'
      : 'SELECT * FROM trends ORDER BY growth_rate DESC LIMIT ?';
    const params = type ? [type, limit] : [limit];
    
    const results = await this.dbAll<any>(query, ...params);
    return results.map(this.parseTrend);
  }

  // High growth repos
  async getHighGrowthRepos(days: number = 30, minGrowthPercent: number = 200): Promise<Repository[]> {
    return this.performanceMonitor.monitor('getHighGrowthRepos', async () => {
      const results = await this.dbAll<any>(`
        WITH growth_calc AS (
          SELECT r.*, 
            CAST((m1.stars - m2.stars) AS REAL) / NULLIF(m2.stars, 0) * 100 as growth_percent
          FROM repositories r
          JOIN repo_metrics m1 ON r.id = m1.repo_id
          JOIN repo_metrics m2 ON r.id = m2.repo_id
          WHERE m1.recorded_at = (SELECT MAX(recorded_at) FROM repo_metrics WHERE repo_id = r.id)
            AND m2.recorded_at = (
              SELECT MIN(recorded_at) FROM repo_metrics 
              WHERE repo_id = r.id AND recorded_at >= datetime('now', '-' || ? || ' days')
            )
        )
        SELECT * FROM growth_calc WHERE growth_percent >= ? 
        ORDER BY growth_percent DESC LIMIT 50`,
        days, minGrowthPercent
      );
      return results.map(this.parseRepository);
    });
  }

  /**
   * Get repositories by IDs in batch
   */
  async getRepositoriesByIds(repoIds: string[]): Promise<Repository[]> {
    if (repoIds.length === 0) return [];
    
    return this.performanceMonitor.monitor('getRepositoriesByIds', async () => {
      // Process in chunks to avoid query size limits
      const chunks = [];
      const chunkSize = 100;
      
      for (let i = 0; i < repoIds.length; i += chunkSize) {
        chunks.push(repoIds.slice(i, i + chunkSize));
      }
      
      const results: Repository[] = [];
      
      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        const chunkResults = await this.dbAll<any>(
          `SELECT * FROM repositories WHERE id IN (${placeholders})`,
          ...chunk
        );
        results.push(...chunkResults.map(this.parseRepository));
      }
      
      return results;
    });
  }

  /**
   * Bulk update repository metrics
   */
  async updateRepositoryMetricsBatch(updates: Array<{ repoId: string; stars: number; forks: number }>) {
    return this.performanceMonitor.monitor('updateRepositoryMetricsBatch', async () => {
      const queries = updates.map(update => ({
        sql: `UPDATE repositories SET stars = ?, forks = ? WHERE id = ?`,
        params: [update.stars, update.forks, update.repoId]
      }));
      
      const statements = this.prepareBatchStatements(queries);
      await this.dbBatch(statements);
    });
  }

  // Analytics
  async getDailyStats(): Promise<{
    repos_scanned: number;
    analyses_performed: number;
    alerts_sent: number;
    total_cost: number;
  }> {
    return this.performanceMonitor.monitor('getDailyStats', async () => {
      const today = new Date().toISOString().split('T')[0];
      const [repos, analyses, alerts] = await Promise.all([
        this.dbFirst<{ count: number }>(
          "SELECT COUNT(*) as count FROM repositories WHERE DATE(discovered_at) = ?", today
        ),
        this.dbFirst<{ count: number; total_cost: number }>(
          "SELECT COUNT(*) as count, SUM(cost) as total_cost FROM analyses WHERE DATE(created_at) = ?", today
        ),
        this.dbFirst<{ count: number }>(
          "SELECT COUNT(*) as count FROM alerts WHERE DATE(sent_at) = ?", today
        ),
      ]);

      return {
        repos_scanned: repos?.count || 0,
        analyses_performed: analyses?.count || 0,
        alerts_sent: alerts?.count || 0,
        total_cost: analyses?.total_cost || 0,
      };
    });
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    return this.performanceMonitor.monitor('cleanupOldData', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString();
      
      // Clean up old metrics
      await this.dbRun(
        `DELETE FROM repo_metrics WHERE recorded_at < ?`,
        cutoffDateStr
      );
      
      // Clean up old alerts
      await this.dbRun(
        `DELETE FROM alerts WHERE sent_at < ?`,
        cutoffDateStr
      );
      
      // Clean up orphaned contributors
      await this.dbRun(`
        DELETE FROM contributors 
        WHERE repo_id NOT IN (SELECT id FROM repositories)
      `);
    });
  }

  // R2 operations
  private async saveToR2(key: string, data: any): Promise<void> {
    try {
      await this.env.STORAGE.put(key, JSON.stringify(data));
    } catch (error) {
      console.error('R2 save error:', error);
    }
  }

  // Parsing helpers
  private parseRepository(row: any): Repository {
    return {
      ...row,
      topics: JSON.parse(row.topics || '[]'),
      is_archived: Boolean(row.is_archived),
      is_fork: Boolean(row.is_fork),
    };
  }

  private parseAnalysis(row: any): Analysis {
    return {
      repo_id: row.repo_id,
      scores: {
        investment: row.investment_score,
        innovation: row.innovation_score,
        team: row.team_score,
        market: row.market_score,
      },
      recommendation: row.recommendation,
      summary: row.summary,
      strengths: JSON.parse(row.strengths || '[]'),
      risks: JSON.parse(row.risks || '[]'),
      questions: JSON.parse(row.questions || '[]'),
      metadata: {
        model: row.model,
        cost: row.cost,
        timestamp: row.created_at,
      },
    };
  }

  private parseAlert(row: any): Alert {
    return {
      ...row,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }

  private parseTrend(row: any): Trend {
    return {
      ...row,
      examples: JSON.parse(row.examples || '[]'),
    };
  }
}
