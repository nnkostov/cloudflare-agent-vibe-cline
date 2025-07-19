import type { 
  Env, Repository, RepoMetrics, Analysis, Alert, Contributor, Trend,
  CommitMetrics, ReleaseMetrics, PullRequestMetrics, IssueMetrics,
  StarHistory, ForkAnalysis, RepoTier
} from '../types';
import { BaseService } from './base';
import { BatchProcessor } from '../utils/batchProcessor';
import { PerformanceMonitor } from '../utils/performanceMonitor';
import { StorageEnhancedService } from './storage-enhanced';

export class StorageUnifiedService extends BaseService {
  private batchProcessor: BatchProcessor;
  private performanceMonitor: PerformanceMonitor;
  private enhancedService: StorageEnhancedService;

  constructor(env: Env) {
    super(env);
    this.batchProcessor = new BatchProcessor(100, 5000);
    this.performanceMonitor = new PerformanceMonitor();
    this.enhancedService = new StorageEnhancedService(env);
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

  async getLatestAnalysis(repoId: string): Promise<any | null> {
    const result = await this.dbFirst<any>(
      'SELECT * FROM analyses WHERE repo_id = ? ORDER BY created_at DESC LIMIT 1',
      repoId
    );
    return result ? this.parseAnalysisForFrontend(result) : null;
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

  // High growth repos with tier information
  async getHighGrowthRepos(days: number = 30, minGrowthPercent: number = 200): Promise<any[]> {
    return this.performanceMonitor.monitor('getHighGrowthRepos', async () => {
      // First try to get repos with growth metrics
      let results = await this.dbAll<any>(`
        WITH growth_calc AS (
          SELECT r.*, 
            rt.tier,
            CAST((m1.stars - m2.stars) AS REAL) / NULLIF(m2.stars, 0) * 100 as growth_percent
          FROM repositories r
          LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
          JOIN repo_metrics m1 ON r.id = m1.repo_id
          JOIN repo_metrics m2 ON r.id = m2.repo_id
          WHERE m1.recorded_at = (SELECT MAX(recorded_at) FROM repo_metrics WHERE repo_id = r.id)
            AND m2.recorded_at = (
              SELECT MIN(recorded_at) FROM repo_metrics 
              WHERE repo_id = r.id AND recorded_at >= datetime('now', '-' || ? || ' days')
            )
        )
        SELECT * FROM growth_calc WHERE growth_percent >= ? 
        ORDER BY growth_percent DESC LIMIT 200`,
        days, minGrowthPercent
      );

      // If no growth repos found, use hybrid trending approach
      if (results.length === 0) {
        console.log('No historical growth data available, using hybrid trending approach');
        return this.getHybridTrendingRepos(200);
      }

      return results.map(this.parseRepositoryWithTier);
    });
  }

  /**
   * Get trending repositories using a hybrid approach
   * Combines historical metrics (when available) with GitHub API activity indicators
   */
  async getHybridTrendingRepos(limit: number = 50): Promise<any[]> {
    return this.performanceMonitor.monitor('getHybridTrendingRepos', async () => {
      // Get active repositories with calculated trending score in the query
      const repos = await this.dbAll<any>(`
        SELECT r.*, rt.tier,
          julianday('now') - julianday(r.pushed_at) as days_since_push,
          julianday('now') - julianday(r.updated_at) as days_since_update,
          julianday(r.pushed_at) - julianday(r.created_at) as days_active,
          -- Calculate trending score directly in SQL
          (
            -- Recent activity score (40%)
            CASE 
              WHEN julianday('now') - julianday(r.pushed_at) < 7 THEN 40
              WHEN julianday('now') - julianday(r.pushed_at) < 30 THEN 30
              WHEN julianday('now') - julianday(r.pushed_at) < 90 THEN 20
              ELSE 10
            END +
            -- Star velocity estimate (30%)
            CASE
              WHEN r.stars > 10000 AND julianday(r.pushed_at) - julianday(r.created_at) < 365 THEN 30
              WHEN r.stars > 5000 AND julianday(r.pushed_at) - julianday(r.created_at) < 365 THEN 25
              WHEN r.stars > 1000 AND julianday(r.pushed_at) - julianday(r.created_at) < 180 THEN 20
              WHEN r.stars > 500 AND julianday(r.pushed_at) - julianday(r.created_at) < 90 THEN 15
              ELSE 10
            END +
            -- Fork ratio score (20%)
            CASE
              WHEN r.stars > 0 AND CAST(r.forks AS REAL) / r.stars > 0.3 THEN 20
              WHEN r.stars > 0 AND CAST(r.forks AS REAL) / r.stars > 0.2 THEN 15
              WHEN r.stars > 0 AND CAST(r.forks AS REAL) / r.stars > 0.1 THEN 10
              ELSE 5
            END +
            -- Popularity bonus (10%)
            CASE
              WHEN r.stars > 50000 THEN 10
              WHEN r.stars > 10000 THEN 8
              WHEN r.stars > 5000 THEN 6
              WHEN r.stars > 1000 THEN 4
              ELSE 2
            END
          ) as trending_score
        FROM repositories r
        LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
        WHERE r.is_archived = 0 AND r.is_fork = 0
          AND r.stars > 100  -- Only consider repos with at least 100 stars
          AND julianday('now') - julianday(r.pushed_at) < 180  -- Active in last 6 months
        ORDER BY trending_score DESC, r.stars DESC
        LIMIT ?
      `, limit);

      // Parse and return results with simplified trending factors
      return repos.map(repo => {
        const parsed = this.parseRepositoryWithTier(repo);
        return {
          ...parsed,
          trending_score: repo.trending_score,
          trending_factors: {
            recentActivity: repo.days_since_push < 7 ? 100 : repo.days_since_push < 30 ? 75 : 50,
            starVelocity: repo.stars / Math.max(1, repo.days_active || 365) * 365,
            popularity: Math.min(100, Math.log10(repo.stars + 1) * 20),
            forkActivity: repo.stars > 0 ? (repo.forks / repo.stars) * 100 : 0
          }
        };
      });
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
          `SELECT r.*, rt.tier 
           FROM repositories r
           LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
           WHERE r.id IN (${placeholders})`,
          ...chunk
        );
        results.push(...chunkResults.map(this.parseRepositoryWithTier));
      }
      
      return results;
    });
  }

  /**
   * Get repositories by tier
   */
  async getReposByTier(tier: 1 | 2 | 3, limit?: number): Promise<any[]> {
    const query = limit 
      ? `SELECT r.*, rt.tier
         FROM repositories r
         INNER JOIN repo_tiers rt ON r.id = rt.repo_id
         WHERE rt.tier = ? AND r.is_archived = 0 AND r.is_fork = 0
         ORDER BY r.stars DESC
         LIMIT ?`
      : `SELECT r.*, rt.tier
         FROM repositories r
         INNER JOIN repo_tiers rt ON r.id = rt.repo_id
         WHERE rt.tier = ? AND r.is_archived = 0 AND r.is_fork = 0
         ORDER BY r.stars DESC`;
    
    const params = limit ? [tier, limit] : [tier];
    const results = await this.dbAll<any>(query, ...params);
    
    return results.map(this.parseRepositoryWithTier);
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
   * Get repository count
   */
  async getRepositoryCount(): Promise<number> {
    const result = await this.dbFirst<{ count: number }>(`
      SELECT COUNT(*) as count FROM repositories 
      WHERE is_archived = 0 AND is_fork = 0
    `);
    return result?.count || 0;
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
      topics: Array.isArray(row.topics) ? row.topics : JSON.parse(row.topics || '[]'),
      is_archived: Boolean(row.is_archived),
      is_fork: Boolean(row.is_fork),
    };
  }

  private parseRepositoryWithTier(row: any): any {
    return {
      ...row,
      topics: Array.isArray(row.topics) ? row.topics : JSON.parse(row.topics || '[]'),
      is_archived: Boolean(row.is_archived),
      is_fork: Boolean(row.is_fork),
      tier: row.tier || null,
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

  // Parse analysis for frontend consumption
  private parseAnalysisForFrontend(row: any): any {
    const strengths = JSON.parse(row.strengths || '[]');
    const risks = JSON.parse(row.risks || '[]');
    const questions = JSON.parse(row.questions || '[]');
    
    // Extract enhanced fields if they exist in the strengths/risks
    let technical_moat = null;
    let scalability_assessment = null;
    let developer_adoption_potential = null;
    let growth_prediction = null;
    
    // Check if model is Opus-4 which includes enhanced analysis
    if (row.model === 'claude-opus-4') {
      // These might be in the summary or as part of strengths
      // For now, we'll leave them null unless they're explicitly stored
    }
    
    return {
      repo_id: row.repo_id,
      investment_score: row.investment_score,
      innovation_score: row.innovation_score,
      team_score: row.team_score,
      market_score: row.market_score,
      recommendation: row.recommendation,
      summary: row.summary,
      strengths: strengths,
      risks: risks,
      key_questions: questions,
      model_used: row.model,
      analyzed_at: row.created_at,
      technical_moat,
      scalability_assessment,
      developer_adoption_potential,
      growth_prediction,
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

  // Delegate enhanced methods to StorageEnhancedService
  async saveCommitMetrics(metrics: CommitMetrics[]): Promise<void> {
    return this.enhancedService.saveCommitMetrics(metrics);
  }

  async getCommitMetrics(repoId: string, days?: number): Promise<CommitMetrics[]> {
    return this.enhancedService.getCommitMetrics(repoId, days);
  }

  async saveReleaseMetrics(metrics: ReleaseMetrics[]): Promise<void> {
    return this.enhancedService.saveReleaseMetrics(metrics);
  }

  async getReleaseMetrics(repoId: string): Promise<ReleaseMetrics[]> {
    return this.enhancedService.getReleaseMetrics(repoId);
  }

  async savePullRequestMetrics(metrics: PullRequestMetrics): Promise<void> {
    return this.enhancedService.savePullRequestMetrics(metrics);
  }

  async getLatestPullRequestMetrics(repoId: string): Promise<PullRequestMetrics | null> {
    return this.enhancedService.getLatestPullRequestMetrics(repoId);
  }

  async saveIssueMetrics(metrics: IssueMetrics): Promise<void> {
    return this.enhancedService.saveIssueMetrics(metrics);
  }

  async getLatestIssueMetrics(repoId: string): Promise<IssueMetrics | null> {
    return this.enhancedService.getLatestIssueMetrics(repoId);
  }

  async saveStarHistory(history: StarHistory[]): Promise<void> {
    return this.enhancedService.saveStarHistory(history);
  }

  async getStarHistory(repoId: string, days?: number): Promise<StarHistory[]> {
    return this.enhancedService.getStarHistory(repoId, days);
  }

  async saveForkAnalysis(analysis: ForkAnalysis): Promise<void> {
    return this.enhancedService.saveForkAnalysis(analysis);
  }

  async getLatestForkAnalysis(repoId: string): Promise<ForkAnalysis | null> {
    return this.enhancedService.getLatestForkAnalysis(repoId);
  }

  async saveRepoTier(tier: RepoTier): Promise<void> {
    return this.enhancedService.saveRepoTier(tier);
  }

  async getRepoTier(repoId: string): Promise<RepoTier | null> {
    return this.enhancedService.getRepoTier(repoId);
  }

  async updateRepoTier(repoId: string, metrics: {
    stars: number;
    growth_velocity: number;
    engagement_score: number;
  }): Promise<void> {
    return this.enhancedService.updateRepoTier(repoId, metrics);
  }

  async getReposNeedingScan(tier: 1 | 2 | 3, scanType: 'deep' | 'basic', force: boolean = false): Promise<string[]> {
    return this.enhancedService.getReposNeedingScan(tier, scanType, force);
  }

  async markRepoScanned(repoId: string, scanType: 'deep' | 'basic'): Promise<void> {
    return this.enhancedService.markRepoScanned(repoId, scanType);
  }

  async getComprehensiveMetrics(repoId: string): Promise<{
    commits: CommitMetrics[];
    releases: ReleaseMetrics[];
    pullRequests: PullRequestMetrics | null;
    issues: IssueMetrics | null;
    stars: StarHistory[];
    forks: ForkAnalysis | null;
    tier: RepoTier | null;
  }> {
    return this.enhancedService.getComprehensiveMetrics(repoId);
  }
}

// Export alias for backward compatibility
export { StorageUnifiedService as StorageService };
