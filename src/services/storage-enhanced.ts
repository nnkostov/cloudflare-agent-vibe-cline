import type { 
  Env, 
  CommitMetrics, 
  ReleaseMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis,
  RepoTier
} from '../types';
import { BaseService } from './base';

export class StorageEnhancedService extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Save commit metrics
   */
  async saveCommitMetrics(metrics: CommitMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    try {
      const values = metrics.map(m => 
        `('${m.repo_id}', '${m.date}', ${m.commit_count}, ${m.unique_authors}, ${m.additions}, ${m.deletions})`
      ).join(', ');

      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO commit_metrics 
        (repo_id, date, commit_count, unique_authors, additions, deletions)
        VALUES ${values}
      `).run();
    } catch (error) {
      console.error('Error in saveCommitMetrics:', error);
      throw error;
    }
  }

  /**
   * Get commit metrics for a repository
   */
  async getCommitMetrics(repoId: string, days: number = 30): Promise<CommitMetrics[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const result = await this.env.DB.prepare(`
        SELECT * FROM commit_metrics 
        WHERE repo_id = ? AND date >= ?
        ORDER BY date DESC
      `).bind(repoId, since.toISOString().split('T')[0]).all();

      return result.results as unknown as CommitMetrics[];
    } catch (error) {
      console.error('Error in getCommitMetrics:', error);
      return [];
    }
  }

  /**
   * Save release metrics
   */
  async saveReleaseMetrics(metrics: ReleaseMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    try {
      for (const m of metrics) {
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO release_history 
          (repo_id, release_id, tag_name, name, published_at, is_prerelease, is_draft, download_count, body)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          m.repo_id,
          m.release_id,
          m.tag_name,
          m.name,
          m.published_at,
          m.is_prerelease ? 1 : 0,
          m.is_draft ? 1 : 0,
          m.download_count,
          m.body
        ).run();
      }
    } catch (error) {
      console.error('Error in saveReleaseMetrics:', error);
      throw error;
    }
  }

  /**
   * Get release metrics for a repository
   */
  async getReleaseMetrics(repoId: string): Promise<ReleaseMetrics[]> {
    try {
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
    } catch (error) {
      console.error('Error in getReleaseMetrics:', error);
      return [];
    }
  }

  /**
   * Save pull request metrics
   */
  async savePullRequestMetrics(metrics: PullRequestMetrics): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO pr_metrics 
        (repo_id, period_start, period_end, total_prs, merged_prs, 
         avg_time_to_merge_hours, unique_contributors, avg_review_comments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        metrics.repo_id,
        metrics.period_start,
        metrics.period_end,
        metrics.total_prs,
        metrics.merged_prs,
        metrics.avg_time_to_merge_hours,
        metrics.unique_contributors,
        metrics.avg_review_comments
      ).run();
    } catch (error) {
      console.error('Error in savePullRequestMetrics:', error);
      throw error;
    }
  }

  /**
   * Get latest pull request metrics
   */
  async getLatestPullRequestMetrics(repoId: string): Promise<PullRequestMetrics | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM pr_metrics 
        WHERE repo_id = ?
        ORDER BY period_end DESC
        LIMIT 1
      `).bind(repoId).first();

      return result as unknown as PullRequestMetrics | null;
    } catch (error) {
      console.error('Error in getLatestPullRequestMetrics:', error);
      return null;
    }
  }

  /**
   * Save issue metrics
   */
  async saveIssueMetrics(metrics: IssueMetrics): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO issue_metrics 
        (repo_id, period_start, period_end, total_issues, closed_issues,
         avg_time_to_close_hours, avg_time_to_first_response_hours, 
         bug_issues, feature_issues)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        metrics.repo_id,
        metrics.period_start,
        metrics.period_end,
        metrics.total_issues,
        metrics.closed_issues,
        metrics.avg_time_to_close_hours,
        metrics.avg_time_to_first_response_hours,
        metrics.bug_issues,
        metrics.feature_issues
      ).run();
    } catch (error) {
      console.error('Error in saveIssueMetrics:', error);
      throw error;
    }
  }

  /**
   * Get latest issue metrics
   */
  async getLatestIssueMetrics(repoId: string): Promise<IssueMetrics | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM issue_metrics 
        WHERE repo_id = ?
        ORDER BY period_end DESC
        LIMIT 1
      `).bind(repoId).first();

      return result as unknown as IssueMetrics | null;
    } catch (error) {
      console.error('Error in getLatestIssueMetrics:', error);
      return null;
    }
  }

  /**
   * Save star history
   */
  async saveStarHistory(history: StarHistory[]): Promise<void> {
    if (history.length === 0) return;

    try {
      for (const h of history) {
        await this.env.DB.prepare(`
          INSERT OR REPLACE INTO star_history 
          (repo_id, date, star_count, daily_growth, weekly_growth_rate)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          h.repo_id,
          h.date,
          h.star_count,
          h.daily_growth,
          h.weekly_growth_rate
        ).run();
      }
    } catch (error) {
      console.error('Error in saveStarHistory:', error);
      throw error;
    }
  }

  /**
   * Get star history for a repository
   */
  async getStarHistory(repoId: string, days: number = 30): Promise<StarHistory[]> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const result = await this.env.DB.prepare(`
        SELECT * FROM star_history 
        WHERE repo_id = ? AND date >= ?
        ORDER BY date DESC
      `).bind(repoId, since.toISOString().split('T')[0]).all();

      return result.results as unknown as StarHistory[];
    } catch (error) {
      console.error('Error in getStarHistory:', error);
      return [];
    }
  }

  /**
   * Save fork analysis
   */
  async saveForkAnalysis(analysis: ForkAnalysis): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO fork_analysis 
        (repo_id, analysis_date, total_forks, active_forks, forks_ahead,
         forks_with_stars, avg_fork_stars)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        analysis.repo_id,
        analysis.analysis_date,
        analysis.total_forks,
        analysis.active_forks,
        analysis.forks_ahead,
        analysis.forks_with_stars,
        analysis.avg_fork_stars
      ).run();
    } catch (error) {
      console.error('Error in saveForkAnalysis:', error);
      throw error;
    }
  }

  /**
   * Get latest fork analysis
   */
  async getLatestForkAnalysis(repoId: string): Promise<ForkAnalysis | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM fork_analysis 
        WHERE repo_id = ?
        ORDER BY analysis_date DESC
        LIMIT 1
      `).bind(repoId).first();

      return result as unknown as ForkAnalysis | null;
    } catch (error) {
      console.error('Error in getLatestForkAnalysis:', error);
      return null;
    }
  }

  /**
   * Save or update repository tier
   */
  async saveRepoTier(tier: RepoTier): Promise<void> {
    try {
      await this.env.DB.prepare(`
        INSERT OR REPLACE INTO repo_tiers 
        (repo_id, tier, last_deep_scan, last_basic_scan, 
         growth_velocity, engagement_score, scan_priority, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        tier.repo_id,
        tier.tier,
        tier.last_deep_scan,
        tier.last_basic_scan,
        tier.growth_velocity,
        tier.engagement_score,
        tier.scan_priority
      ).run();
    } catch (error) {
      console.error('Error in saveRepoTier:', error);
      throw error;
    }
  }

  /**
   * Get repositories by tier
   */
  async getReposByTier(tier: 1 | 2 | 3, limit: number = 100): Promise<RepoTier[]> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM repo_tiers 
        WHERE tier = ?
        ORDER BY scan_priority DESC, growth_velocity DESC
        LIMIT ?
      `).bind(tier, limit).all();

      return result.results as unknown as RepoTier[];
    } catch (error) {
      console.error('Error in getReposByTier:', error);
      return [];
    }
  }

  /**
   * Get repository tier info
   */
  async getRepoTier(repoId: string): Promise<RepoTier | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM repo_tiers 
        WHERE repo_id = ?
      `).bind(repoId).first();

      return result as unknown as RepoTier | null;
    } catch (error) {
      console.error('Error in getRepoTier:', error);
      return null;
    }
  }

  /**
   * Update repository tier based on metrics
   */
  async updateRepoTier(repoId: string, metrics: {
    stars: number;
    growth_velocity: number;
    engagement_score: number;
  }): Promise<void> {
    try {
      // Determine tier based on metrics
      let tier: 1 | 2 | 3;
      if (metrics.stars >= 100 && metrics.growth_velocity > 10) {
        tier = 1; // Hot prospect
      } else if (metrics.stars >= 50) {
        tier = 2; // Rising star
      } else {
        tier = 3; // Long tail
      }

      // Calculate scan priority
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
    } catch (error) {
      console.error('Error in updateRepoTier:', error);
      throw error;
    }
  }

  /**
   * Get repositories needing scan by tier
   */
  async getReposNeedingScan(tier: 1 | 2 | 3, scanType: 'deep' | 'basic'): Promise<string[]> {
    try {
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
    } catch (error) {
      console.error('Error in getReposNeedingScan:', error);
      return [];
    }
  }

  /**
   * Mark repository as scanned
   */
  async markRepoScanned(repoId: string, scanType: 'deep' | 'basic'): Promise<void> {
    try {
      const column = scanType === 'deep' ? 'last_deep_scan' : 'last_basic_scan';
      
      await this.env.DB.prepare(`
        UPDATE repo_tiers 
        SET ${column} = CURRENT_TIMESTAMP
        WHERE repo_id = ?
      `).bind(repoId).run();
    } catch (error) {
      console.error('Error in markRepoScanned:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive metrics summary for a repository
   */
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

    return {
      commits,
      releases,
      pullRequests,
      issues,
      stars,
      forks,
      tier,
    };
  }
}
