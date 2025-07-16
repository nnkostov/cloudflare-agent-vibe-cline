import type { 
  Env, 
  Repository, 
  RepoMetrics, 
  Analysis, 
  Alert, 
  Contributor, 
  Trend,
  CommitMetrics, 
  ReleaseMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis,
  RepoTier
} from '../types';
import { BaseService } from './base';

export class StorageService extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  // ========== Repository Operations ==========
  
  async saveRepository(repo: Repository): Promise<void> {
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
  }

  async saveRepositoriesBatch(repos: Repository[]): Promise<void> {
    const stmt = this.env.DB.prepare(`
      INSERT OR REPLACE INTO repositories (
        id, name, owner, full_name, description, stars, forks, 
        open_issues, language, topics, created_at, updated_at, 
        pushed_at, is_archived, is_fork, html_url, clone_url, default_branch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await this.env.DB.batch(
      repos.map(repo => stmt.bind(
        repo.id, repo.name, repo.owner, repo.full_name, repo.description,
        repo.stars, repo.forks, repo.open_issues, repo.language,
        JSON.stringify(repo.topics), repo.created_at, repo.updated_at,
        repo.pushed_at, repo.is_archived ? 1 : 0, repo.is_fork ? 1 : 0,
        repo.html_url, repo.clone_url, repo.default_branch
      ))
    );
  }

  async getRepositoryCount(): Promise<number> {
    const result = await this.dbFirst<{ count: number }>(
      'SELECT COUNT(*) as count FROM repositories'
    );
    return result?.count || 0;
  }

  async getRepository(repoId: string): Promise<Repository | null> {
    const result = await this.dbFirst<any>(
      'SELECT * FROM repositories WHERE id = ?',
      repoId
    );
    return result ? this.parseRepository(result) : null;
  }

  async getRepositoriesByIds(repoIds: string[]): Promise<Repository[]> {
    if (repoIds.length === 0) return [];
    
    const results: Repository[] = [];
    const chunkSize = 100;
    
    for (let i = 0; i < repoIds.length; i += chunkSize) {
      const chunk = repoIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const chunkResults = await this.dbAll<any>(
        `SELECT * FROM repositories WHERE id IN (${placeholders})`,
        ...chunk
      );
      results.push(...chunkResults.map(this.parseRepository));
    }
    
    return results;
  }

  // ========== Metrics Operations ==========
  
  async saveMetrics(metrics: RepoMetrics): Promise<void> {
    await this.dbRun(`
      INSERT INTO repo_metrics (
        repo_id, stars, forks, open_issues, watchers, contributors, commits_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      metrics.repo_id, metrics.stars, metrics.forks, metrics.open_issues,
      metrics.watchers, metrics.contributors, metrics.commits_count
    );
  }

  async saveMetricsBatch(metricsList: RepoMetrics[]): Promise<void> {
    const stmt = this.env.DB.prepare(`
      INSERT INTO repo_metrics (
        repo_id, stars, forks, open_issues, watchers, contributors, commits_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await this.env.DB.batch(
      metricsList.map(metrics => stmt.bind(
        metrics.repo_id, metrics.stars, metrics.forks, metrics.open_issues,
        metrics.watchers, metrics.contributors, metrics.commits_count
      ))
    );
  }

  async getLatestMetrics(repoId: string): Promise<RepoMetrics | null> {
    return this.dbFirst<RepoMetrics>(
      'SELECT * FROM repo_metrics WHERE repo_id = ? ORDER BY recorded_at DESC LIMIT 1',
      repoId
    );
  }

  // ========== Enhanced Metrics Operations ==========
  
  async saveCommitMetrics(metrics: CommitMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    const values = metrics.map(m => 
      `('${m.repo_id}', '${m.date}', ${m.commit_count}, ${m.unique_authors}, ${m.additions}, ${m.deletions})`
    ).join(', ');

    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO commit_metrics 
      (repo_id, date, commit_count, unique_authors, additions, deletions)
      VALUES ${values}
    `).run();
  }

  async getCommitMetrics(repoId: string, days: number = 30): Promise<CommitMetrics[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const result = await this.env.DB.prepare(`
      SELECT * FROM commit_metrics 
      WHERE repo_id = ? AND date >= ?
      ORDER BY date DESC
    `).bind(repoId, since.toISOString().split('T')[0]).all();

    return result.results as unknown as CommitMetrics[];
  }

  async saveReleaseMetrics(metrics: ReleaseMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    for (const m of metrics) {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO release_history 
        (repo_id, release_id, tag_name, name, published_at, is_prerelease, is_draft, download_count, body)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        m.repo_id, m.release_id, m.tag_name, m.name, m.published_at,
        m.is_prerelease ? 1 : 0, m.is_draft ? 1 : 0, m.download_count, m.body
      ).run();
    }
  }

  async getReleaseMetrics(repoId: string): Promise<ReleaseMetrics[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM release_history 
      WHERE repo_id = ?
      ORDER BY published_at DESC
    `).bind(repoId).all();

    return result.results.map((r: any) => ({
      ...r,
      is_prerelease: r.is_prerelease === 1,
      is_draft: r.is_draft === 1,
    })) as unknown as ReleaseMetrics[];
  }

  async savePullRequestMetrics(metrics: PullRequestMetrics): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO pr_metrics 
      (repo_id, period_start, period_end, total_prs, merged_prs, 
       avg_time_to_merge_hours, unique_contributors, avg_review_comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metrics.repo_id, metrics.period_start, metrics.period_end,
      metrics.total_prs, metrics.merged_prs, metrics.avg_time_to_merge_hours,
      metrics.unique_contributors, metrics.avg_review_comments
    ).run();
  }

  async getLatestPullRequestMetrics(repoId: string): Promise<PullRequestMetrics | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM pr_metrics 
      WHERE repo_id = ?
      ORDER BY period_end DESC
      LIMIT 1
    `).bind(repoId).first();

    return result as unknown as PullRequestMetrics | null;
  }

  async saveIssueMetrics(metrics: IssueMetrics): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO issue_metrics 
      (repo_id, period_start, period_end, total_issues, closed_issues,
       avg_time_to_close_hours, avg_time_to_first_response_hours, 
       bug_issues, feature_issues)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metrics.repo_id, metrics.period_start, metrics.period_end,
      metrics.total_issues, metrics.closed_issues, metrics.avg_time_to_close_hours,
      metrics.avg_time_to_first_response_hours, metrics.bug_issues, metrics.feature_issues
    ).run();
  }

  async getLatestIssueMetrics(repoId: string): Promise<IssueMetrics | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM issue_metrics 
      WHERE repo_id = ?
      ORDER BY period_end DESC
      LIMIT 1
    `).bind(repoId).first();

    return result as unknown as IssueMetrics | null;
  }

  async saveStarHistory(history: StarHistory[]): Promise<void> {
    if (history.length === 0) return;

    for (const h of history) {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO star_history 
        (repo_id, date, star_count, daily_growth, weekly_growth_rate)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        h.repo_id, h.date, h.star_count, h.daily_growth, h.weekly_growth_rate
      ).run();
    }
  }

  async getStarHistory(repoId: string, days: number = 30): Promise<StarHistory[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const result = await this.env.DB.prepare(`
      SELECT * FROM star_history 
      WHERE repo_id = ? AND date >= ?
      ORDER BY date DESC
    `).bind(repoId, since.toISOString().split('T')[0]).all();

    return result.results as unknown as StarHistory[];
  }

  async saveForkAnalysis(analysis: ForkAnalysis): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO fork_analysis 
      (repo_id, analysis_date, total_forks, active_forks, forks_ahead,
       forks_with_stars, avg_fork_stars)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      analysis.repo_id, analysis.analysis_date, analysis.total_forks,
      analysis.active_forks, analysis.forks_ahead, analysis.forks_with_stars,
      analysis.avg_fork_stars
    ).run();
  }

  async getLatestForkAnalysis(repoId: string): Promise<ForkAnalysis | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM fork_analysis 
      WHERE repo_id = ?
      ORDER BY analysis_date DESC
      LIMIT 1
    `).bind(repoId).first();

    return result as unknown as ForkAnalysis | null;
  }

  // ========== Analysis Operations ==========
  
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

    // Archive to R2 if available
    if (this.env.STORAGE) {
      try {
        await this.env.STORAGE.put(
          `analyses/${analysis.repo_id}/${Date.now()}.json`, 
          JSON.stringify(analysis)
        );
      } catch (error) {
        console.error('R2 save error:', error);
      }
    }
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

  // ========== Alert Operations ==========
  
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

  // ========== Contributor Operations ==========
  
  async saveContributors(repoId: string, contributors: Contributor[]): Promise<void> {
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
  }

  // ========== Trend Operations ==========
  
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

  // ========== Tier Operations ==========
  
  async saveRepoTier(tier: RepoTier): Promise<void> {
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO repo_tiers 
      (repo_id, tier, last_deep_scan, last_basic_scan, 
       growth_velocity, engagement_score, scan_priority, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      tier.repo_id, tier.tier, tier.last_deep_scan, tier.last_basic_scan,
      tier.growth_velocity, tier.engagement_score, tier.scan_priority
    ).run();
  }

  async getReposByTier(tier: 1 | 2 | 3, limit: number = 100): Promise<RepoTier[]> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM repo_tiers 
      WHERE tier = ?
      ORDER BY scan_priority DESC, growth_velocity DESC
      LIMIT ?
    `).bind(tier, limit).all();

    return result.results as unknown as RepoTier[];
  }

  async getRepoTier(repoId: string): Promise<RepoTier | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM repo_tiers 
      WHERE repo_id = ?
    `).bind(repoId).first();

    return result as unknown as RepoTier | null;
  }

  async updateRepoTier(repoId: string, metrics: {
    stars: number;
    growth_velocity: number;
    engagement_score: number;
  }): Promise<void> {
    let tier: 1 | 2 | 3;
    if (metrics.stars >= 100 && metrics.growth_velocity > 10) {
      tier = 1;
    } else if (metrics.stars >= 50) {
      tier = 2;
    } else {
      tier = 3;
    }

    const scanPriority = Math.round(
      metrics.growth_velocity * 0.5 + 
      metrics.engagement_score * 0.3 + 
      Math.log10(metrics.stars + 1) * 0.2
    );

    await this.saveRepoTier({
      repo_id: repoId,
      tier,
      last_deep_scan: null,
      last_basic_scan: null,
      growth_velocity: metrics.growth_velocity,
      engagement_score: metrics.engagement_score,
      scan_priority: scanPriority,
    });
  }

  async getReposNeedingScan(tier: 1 | 2 | 3, scanType: 'deep' | 'basic'): Promise<string[]> {
    const hoursMap = {
      1: { deep: 6, basic: 3 },
      2: { deep: 24, basic: 12 },
      3: { deep: 168, basic: 48 },
    };

    const hours = hoursMap[tier][scanType];
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    const column = scanType === 'deep' ? 'last_deep_scan' : 'last_basic_scan';

    const result = await this.env.DB.prepare(`
      SELECT repo_id FROM repo_tiers 
      WHERE tier = ? AND (${column} IS NULL OR ${column} < ?)
      ORDER BY scan_priority DESC
      LIMIT 50
    `).bind(tier, cutoff.toISOString()).all();

    return result.results.map((r: any) => r.repo_id);
  }

  async markRepoScanned(repoId: string, scanType: 'deep' | 'basic'): Promise<void> {
    const column = scanType === 'deep' ? 'last_deep_scan' : 'last_basic_scan';
    
    await this.env.DB.prepare(`
      UPDATE repo_tiers 
      SET ${column} = CURRENT_TIMESTAMP
      WHERE repo_id = ?
    `).bind(repoId).run();
  }

  // ========== Analytics Operations ==========
  
  async getHighGrowthRepos(days: number = 30, minGrowthPercent: number = 200): Promise<Repository[]> {
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
  }

  async getDailyStats(): Promise<{
    repos_scanned: number;
    analyses_performed: number;
    alerts_sent: number;
    total_cost: number;
  }> {
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
    const [commits, releases, pullRequests, issues, stars, forks, tier] = await Promise.all([
      this.getCommitMetrics(repoId, 30),
      this.getReleaseMetrics(repoId),
      this.getLatestPullRequestMetrics(repoId),
      this.getLatestIssueMetrics(repoId),
      this.getStarHistory(repoId, 30),
      this.getLatestForkAnalysis(repoId),
      this.getRepoTier(repoId),
    ]);

    return { commits, releases, pullRequests, issues, stars, forks, tier };
  }

  // ========== Cleanup Operations ==========
  
  async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffDateStr = cutoffDate.toISOString();
    
    await this.dbRun(`DELETE FROM repo_metrics WHERE recorded_at < ?`, cutoffDateStr);
    await this.dbRun(`DELETE FROM alerts WHERE sent_at < ?`, cutoffDateStr);
    await this.dbRun(`DELETE FROM contributors WHERE repo_id NOT IN (SELECT id FROM repositories)`);
  }

  // ========== Parsing Helpers ==========
  
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
        technical_moat: row.technical_moat || 0,
        scalability: row.scalability || 0,
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
