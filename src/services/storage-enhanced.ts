import type {
  Env,
  CommitMetrics,
  ReleaseMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis,
  RepoTier,
} from "../types";
import { BaseService } from "./base";

export class StorageEnhancedService extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Save commit metrics
   */
  async saveCommitMetrics(metrics: CommitMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    const stmt = this.env.DB.prepare(`
      INSERT OR REPLACE INTO commit_metrics
      (repo_id, date, commit_count, unique_authors, additions, deletions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    await this.dbBatch(
      metrics.map((m) =>
        stmt.bind(
          m.repo_id,
          m.date,
          m.commit_count,
          m.unique_authors,
          m.additions,
          m.deletions,
        ),
      ),
    );
  }

  /**
   * Get commit metrics for a repository
   */
  async getCommitMetrics(
    repoId: string,
    days: number = 30,
  ): Promise<CommitMetrics[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.dbAll<CommitMetrics>(
      `SELECT * FROM commit_metrics
       WHERE repo_id = ? AND date >= ?
       ORDER BY date DESC`,
      repoId,
      since.toISOString().split("T")[0],
    );
  }

  /**
   * Save release metrics
   */
  async saveReleaseMetrics(metrics: ReleaseMetrics[]): Promise<void> {
    if (metrics.length === 0) return;

    const stmt = this.env.DB.prepare(`
      INSERT OR REPLACE INTO release_history
      (repo_id, release_id, tag_name, name, published_at, is_prerelease, is_draft, download_count, body)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await this.dbBatch(
      metrics.map((m) =>
        stmt.bind(
          m.repo_id,
          m.release_id,
          m.tag_name,
          m.name,
          m.published_at,
          m.is_prerelease ? 1 : 0,
          m.is_draft ? 1 : 0,
          m.download_count,
          m.body,
        ),
      ),
    );
  }

  /**
   * Get release metrics for a repository
   */
  async getReleaseMetrics(repoId: string): Promise<ReleaseMetrics[]> {
    const results = await this.dbAll<any>(
      `SELECT * FROM release_history
       WHERE repo_id = ?
       ORDER BY published_at DESC`,
      repoId,
    );

    return results.map((r) => ({
      ...r,
      is_prerelease: r.is_prerelease === 1,
      is_draft: r.is_draft === 1,
    })) as ReleaseMetrics[];
  }

  /**
   * Save pull request metrics
   */
  async savePullRequestMetrics(metrics: PullRequestMetrics): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO pr_metrics
       (repo_id, period_start, period_end, total_prs, merged_prs,
        avg_time_to_merge_hours, unique_contributors, avg_review_comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      metrics.repo_id,
      metrics.period_start,
      metrics.period_end,
      metrics.total_prs,
      metrics.merged_prs,
      metrics.avg_time_to_merge_hours,
      metrics.unique_contributors,
      metrics.avg_review_comments,
    );
  }

  /**
   * Get latest pull request metrics
   */
  async getLatestPullRequestMetrics(
    repoId: string,
  ): Promise<PullRequestMetrics | null> {
    return this.dbFirst<PullRequestMetrics>(
      `SELECT * FROM pr_metrics
       WHERE repo_id = ?
       ORDER BY period_end DESC
       LIMIT 1`,
      repoId,
    );
  }

  /**
   * Save issue metrics
   */
  async saveIssueMetrics(metrics: IssueMetrics): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO issue_metrics
       (repo_id, period_start, period_end, total_issues, closed_issues,
        avg_time_to_close_hours, avg_time_to_first_response_hours,
        bug_issues, feature_issues)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      metrics.repo_id,
      metrics.period_start,
      metrics.period_end,
      metrics.total_issues,
      metrics.closed_issues,
      metrics.avg_time_to_close_hours,
      metrics.avg_time_to_first_response_hours,
      metrics.bug_issues,
      metrics.feature_issues,
    );
  }

  /**
   * Get latest issue metrics
   */
  async getLatestIssueMetrics(repoId: string): Promise<IssueMetrics | null> {
    return this.dbFirst<IssueMetrics>(
      `SELECT * FROM issue_metrics
       WHERE repo_id = ?
       ORDER BY period_end DESC
       LIMIT 1`,
      repoId,
    );
  }

  /**
   * Save star history
   */
  async saveStarHistory(history: StarHistory[]): Promise<void> {
    if (history.length === 0) return;

    const stmt = this.env.DB.prepare(`
      INSERT OR REPLACE INTO star_history
      (repo_id, date, star_count, daily_growth, weekly_growth_rate)
      VALUES (?, ?, ?, ?, ?)
    `);

    await this.dbBatch(
      history.map((h) =>
        stmt.bind(
          h.repo_id,
          h.date,
          h.star_count,
          h.daily_growth,
          h.weekly_growth_rate,
        ),
      ),
    );
  }

  /**
   * Get star history for a repository
   */
  async getStarHistory(
    repoId: string,
    days: number = 30,
  ): Promise<StarHistory[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.dbAll<StarHistory>(
      `SELECT * FROM star_history
       WHERE repo_id = ? AND date >= ?
       ORDER BY date DESC`,
      repoId,
      since.toISOString().split("T")[0],
    );
  }

  /**
   * Save fork analysis
   */
  async saveForkAnalysis(analysis: ForkAnalysis): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO fork_analysis
       (repo_id, analysis_date, total_forks, active_forks, forks_ahead,
        forks_with_stars, avg_fork_stars)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      analysis.repo_id,
      analysis.analysis_date,
      analysis.total_forks,
      analysis.active_forks,
      analysis.forks_ahead,
      analysis.forks_with_stars,
      analysis.avg_fork_stars,
    );
  }

  /**
   * Get latest fork analysis
   */
  async getLatestForkAnalysis(repoId: string): Promise<ForkAnalysis | null> {
    return this.dbFirst<ForkAnalysis>(
      `SELECT * FROM fork_analysis
       WHERE repo_id = ?
       ORDER BY analysis_date DESC
       LIMIT 1`,
      repoId,
    );
  }

  /**
   * Save or update repository tier.
   * Note: stars is denormalized from repositories.stars for query performance.
   * Always call this after updating the repository to keep in sync.
   */
  async saveRepoTier(tier: RepoTier): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO repo_tiers
       (repo_id, tier, stars, last_deep_scan, last_basic_scan,
        growth_velocity, engagement_score, scan_priority, next_scan_due, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      tier.repo_id,
      tier.tier,
      tier.stars,
      tier.last_deep_scan,
      tier.last_basic_scan,
      tier.growth_velocity,
      tier.engagement_score,
      tier.scan_priority,
      tier.next_scan_due,
    );
  }

  /**
   * Get repositories by tier
   */
  async getReposByTier(
    tier: 1 | 2 | 3,
    limit: number = 100,
  ): Promise<RepoTier[]> {
    return this.dbAll<RepoTier>(
      `SELECT * FROM repo_tiers
       WHERE tier = ?
       ORDER BY scan_priority DESC, growth_velocity DESC
       LIMIT ?`,
      tier,
      limit,
    );
  }

  /**
   * Get repository tier info
   */
  async getRepoTier(repoId: string): Promise<RepoTier | null> {
    return this.dbFirst<RepoTier>(
      `SELECT * FROM repo_tiers WHERE repo_id = ?`,
      repoId,
    );
  }

  /**
   * Update repository tier based on metrics
   */
  async updateRepoTier(
    repoId: string,
    metrics: {
      stars: number;
      growth_velocity: number;
      engagement_score: number;
    },
  ): Promise<void> {
    // Determine tier based on metrics - PROPER LOGIC for balanced distribution
    let tier: 1 | 2 | 3;

    // Tier 1: Top 15% of repositories (elite performers)
    if (
      metrics.stars >= 50000 ||
      (metrics.stars >= 20000 && metrics.growth_velocity > 10)
    ) {
      tier = 1;
    }
    // Tier 2: Next 20-25% of repositories (solid performers)
    else if (
      metrics.stars >= 15000 ||
      (metrics.stars >= 5000 && metrics.growth_velocity > 5)
    ) {
      tier = 2;
    }
    // Tier 3: Remaining 60-70% of repositories
    else {
      tier = 3;
    }

    const scanPriority = Math.round(
      metrics.growth_velocity * 0.5 +
        metrics.engagement_score * 0.3 +
        Math.log10(metrics.stars + 1) * 0.2,
    );

    const hoursUntilNextScan = { 1: 1, 2: 24, 3: 168 } as const;
    const nextScanDue = new Date();
    nextScanDue.setHours(nextScanDue.getHours() + hoursUntilNextScan[tier]);

    await this.saveRepoTier({
      repo_id: repoId,
      tier,
      stars: metrics.stars,
      last_deep_scan: null,
      last_basic_scan: null,
      growth_velocity: metrics.growth_velocity,
      engagement_score: metrics.engagement_score,
      scan_priority: scanPriority,
      next_scan_due: nextScanDue.toISOString(),
    });
  }

  /**
   * Get repositories needing scan by tier
   */
  async getReposNeedingScan(
    tier: 1 | 2 | 3,
    scanType: "deep" | "basic",
    force: boolean = false,
  ): Promise<string[]> {
    if (force) {
      const results = await this.dbAll<{ repo_id: string }>(
        `SELECT repo_id FROM repo_tiers
         WHERE tier = ?
         ORDER BY scan_priority DESC, stars DESC
         LIMIT 100`,
        tier,
      );
      return results.map((r) => r.repo_id);
    }

    const hoursMap = {
      1: { deep: 6, basic: 3 },
      2: { deep: 24, basic: 12 },
      3: { deep: 168, basic: 48 },
    } as const;

    const hours = hoursMap[tier][scanType];
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    // Column name is from a controlled union type, not user input
    const column = scanType === "deep" ? "last_deep_scan" : "last_basic_scan";

    const results = await this.dbAll<{ repo_id: string }>(
      `SELECT repo_id FROM repo_tiers
       WHERE tier = ? AND (${column} IS NULL OR ${column} < ?)
       ORDER BY scan_priority DESC
       LIMIT 50`,
      tier,
      cutoff.toISOString(),
    );
    return results.map((r) => r.repo_id);
  }

  /**
   * Mark repository as scanned
   */
  async markRepoScanned(
    repoId: string,
    scanType: "deep" | "basic",
  ): Promise<void> {
    // Column name is from a controlled union type, not user input
    const column = scanType === "deep" ? "last_deep_scan" : "last_basic_scan";

    await this.dbRun(
      `UPDATE repo_tiers
       SET ${column} = CURRENT_TIMESTAMP
       WHERE repo_id = ?`,
      repoId,
    );
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
    const [commits, releases, pullRequests, issues, stars, forks, tier] =
      await Promise.all([
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

  /**
   * Get the latest recorded_at timestamp per enhanced metric type for a repo.
   * Returns a map like { commits: "2024-...", releases: null, ... }.
   * Used to decide which metrics need re-fetching from GitHub.
   */
  async getMetricsFreshness(
    repoId: string,
  ): Promise<Record<string, string | null>> {
    const rows = await this.dbAll<{
      metric_type: string;
      latest: string | null;
    }>(
      `SELECT 'commits' as metric_type, MAX(recorded_at) as latest FROM commit_metrics WHERE repo_id = ?
       UNION ALL SELECT 'releases', MAX(recorded_at) FROM release_history WHERE repo_id = ?
       UNION ALL SELECT 'prs', MAX(recorded_at) FROM pr_metrics WHERE repo_id = ?
       UNION ALL SELECT 'issues', MAX(recorded_at) FROM issue_metrics WHERE repo_id = ?
       UNION ALL SELECT 'stars', MAX(recorded_at) FROM star_history WHERE repo_id = ?
       UNION ALL SELECT 'forks', MAX(recorded_at) FROM fork_analysis WHERE repo_id = ?`,
      repoId,
      repoId,
      repoId,
      repoId,
      repoId,
      repoId,
    );
    const map: Record<string, string | null> = {};
    for (const row of rows) map[row.metric_type] = row.latest;
    return map;
  }
}
