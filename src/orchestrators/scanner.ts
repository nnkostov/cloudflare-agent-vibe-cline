import type { Repository, Analysis, BatchResult } from "../types";
import { CONFIG as Config } from "../types";
import { isStale } from "../utils/isStale";
import type { GitHubService } from "../services/github";
import type { GitHubEnhancedService } from "../services/github-enhanced";
import type { StorageService } from "../services/storage";
import type { StorageEnhancedService } from "../services/storage-enhanced";
import type { RepoAnalyzerEnhanced } from "../analyzers/repoAnalyzer-enhanced";

export interface ScanDeps {
  github: GitHubService;
  githubEnhanced: GitHubEnhancedService;
  storage: StorageService;
  storageEnhanced: StorageEnhancedService;
  analyzerEnhanced: RepoAnalyzerEnhanced;
  analyzeRepo: (repo: Repository, force: boolean) => Promise<Analysis | null>;
}

function mergeBatchResults(...results: BatchResult[]): BatchResult {
  return {
    total: results.reduce((s, r) => s + r.total, 0),
    succeeded: results.reduce((s, r) => s + r.succeeded, 0),
    failed: results.reduce((s, r) => s + r.failed, 0),
    errors: results.flatMap((r) => r.errors),
  };
}

export class ScanOrchestrator {
  private deps: ScanDeps;

  constructor(deps: ScanDeps) {
    this.deps = deps;
  }

  /**
   * Full scan: discover repos, assign tiers, process all tiers.
   * Returns aggregated BatchResult across all tier processing.
   */
  async comprehensiveScan(): Promise<BatchResult> {
    console.log("Starting comprehensive repository scan...");

    // 1. Discover repositories using dynamic search strategies
    const strategies = this.buildSearchStrategies();
    const allRepos = await this.deps.githubEnhanced.searchComprehensive(
      strategies,
      Config.limits.reposPerScan,
    );

    console.log(`Found ${allRepos.length} repositories across all strategies`);

    // 2. Save only NEW repositories — known repos are updated by tier processing
    const knownIds = await this.deps.storage.getKnownRepoIds();
    const knownSet = new Set(knownIds);

    const recentRows =
      await this.deps.storage.getRepoIdsWithRecentMetrics(24);
    const recentlySnapshotted = new Set(recentRows.map((r) => r.repo_id));

    let newCount = 0;
    for (const repo of allRepos) {
      if (knownSet.has(repo.id)) {
        await this.deps.storage.saveRepository(repo);
        continue;
      }
      newCount++;

      await this.deps.storage.saveRepository(repo);

      if (!recentlySnapshotted.has(repo.id)) {
        await this.deps.storage.saveMetrics({
          repo_id: repo.id,
          stars: repo.stars,
          forks: repo.forks,
          open_issues: repo.open_issues,
          watchers: repo.stars,
          contributors: 0,
          commits_count: 0,
          recorded_at: new Date().toISOString(),
        });
      }

      // Calculate initial tier assignment
      const growthVelocity =
        repo.stars /
        Math.max(
          1,
          (Date.now() - new Date(repo.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        );

      await this.deps.storageEnhanced.updateRepoTier(repo.id, {
        stars: repo.stars,
        growth_velocity: growthVelocity,
        engagement_score: 50,
      });
    }

    console.log(
      `Discovered ${newCount} new repositories, skipped ${allRepos.length - newCount} already known`,
    );

    // 3. Backfill repo_tiers for any repos missing tier assignments
    await this.backfillRepoTiers();

    // 4. Process each tier
    const t1 = await this.processTier1Repos();
    const t2 = await this.processTier2Repos();
    const t3 = await this.processTier3Repos();

    return mergeBatchResults(t1, t2, t3);
  }

  /**
   * Build dynamic search strategies with relative date filters.
   */
  private buildSearchStrategies(): Array<{ type: string; query: string }> {
    const now = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString().split("T")[0];
    };

    return [
      { type: "topic", query: "topic:ai stars:>500" },
      { type: "topic", query: "topic:llm stars:>500" },
      { type: "recent", query: `created:>${daysAgo(30)} topic:ai stars:>5` },
      { type: "recent", query: `created:>${daysAgo(30)} topic:llm stars:>5` },
      {
        type: "trending",
        query: `pushed:>${daysAgo(7)} topic:ai stars:>20`,
      },
      {
        type: "trending",
        query: `pushed:>${daysAgo(7)} topic:machine-learning stars:>20`,
      },
      {
        type: "trending",
        query: `pushed:>${daysAgo(7)} language:python topic:ai stars:>10`,
      },
    ];
  }

  /**
   * Assign tier rows to repos that exist in repositories but have no repo_tiers entry.
   */
  private async backfillRepoTiers(): Promise<void> {
    const orphans = await this.deps.storage.getReposWithoutTiers();
    if (orphans.length === 0) return;

    console.log(
      `Backfilling tier assignments for ${orphans.length} orphaned repos`,
    );

    for (const repo of orphans) {
      const growthVelocity =
        repo.stars /
        Math.max(
          1,
          (Date.now() - new Date(repo.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        );

      await this.deps.storageEnhanced.updateRepoTier(repo.id, {
        stars: repo.stars,
        growth_velocity: growthVelocity,
        engagement_score: 50,
      });
    }
  }

  /**
   * Process Tier 1 repositories (deep scan + Claude analysis).
   */
  async processTier1Repos(): Promise<BatchResult> {
    console.log("Processing Tier 1 repositories...");
    const tier1Repos = await this.deps.storageEnhanced.getReposNeedingScan(
      1,
      "deep",
    );
    console.log(`Found ${tier1Repos.length} Tier 1 repos needing scan`);

    const result: BatchResult = {
      total: tier1Repos.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const BATCH_SIZE = 20;

    for (let i = 0; i < tier1Repos.length; i += BATCH_SIZE) {
      const batch = tier1Repos.slice(i, i + BATCH_SIZE);

      for (const repoId of batch) {
        let repo = await this.deps.storage.getRepository(repoId);
        if (!repo) continue;

        try {
          // Refresh repo data from GitHub API
          try {
            const fresh = await this.deps.github.getRepoDetails(
              repo.owner,
              repo.name,
            );
            await this.deps.storage.saveRepository(fresh);
            repo = fresh;
          } catch (err) {
            console.warn(
              `Could not refresh ${repo.full_name}, using cached data`,
            );
          }

          // Check per-metric freshness — only fetch stale metrics
          const freshness =
            await this.deps.storageEnhanced.getMetricsFreshness(repoId);

          const [commits, releases, prs, issues, stars, forks] =
            await Promise.all([
              isStale(freshness.commits, 6)
                ? this.deps.githubEnhanced.getCommitActivity(
                    repo.owner,
                    repo.name,
                  )
                : null,
              isStale(freshness.releases, 24)
                ? this.deps.githubEnhanced.getReleaseMetrics(
                    repo.owner,
                    repo.name,
                  )
                : null,
              isStale(freshness.prs, 12)
                ? this.deps.githubEnhanced.getPullRequestMetrics(
                    repo.owner,
                    repo.name,
                  )
                : null,
              isStale(freshness.issues, 12)
                ? this.deps.githubEnhanced.getIssueMetrics(
                    repo.owner,
                    repo.name,
                  )
                : null,
              isStale(freshness.stars, 12)
                ? this.deps.githubEnhanced.getStarHistory(
                    repo.owner,
                    repo.name,
                  )
                : null,
              isStale(freshness.forks, 24)
                ? this.deps.githubEnhanced.analyzeForkNetwork(
                    repo.owner,
                    repo.name,
                  )
                : null,
            ]);

          await this.saveMetricsWithRepoId(repoId, {
            commits: commits ?? undefined,
            releases: releases ?? undefined,
            prs: prs ?? undefined,
            issues: issues ?? undefined,
            stars: stars ?? undefined,
            forks: forks ?? undefined,
          });

          // Read all metrics from D1 for scoring
          const cached =
            await this.deps.storageEnhanced.getComprehensiveMetrics(repoId);

          const score = await this.deps.analyzerEnhanced.analyzeWithMetrics(
            repo,
            {
              commits: cached.commits,
              releases: cached.releases,
              pullRequests: cached.pullRequests,
              issues: cached.issues,
              stars: cached.stars,
              forks: cached.forks,
            },
          );

          // Update tier based on new score
          const growthVelocity =
            this.deps.analyzerEnhanced.calculateGrowthVelocity(
              repo.stars,
              cached.stars,
            );
          const engagementScore =
            this.deps.analyzerEnhanced.calculateEngagementScoreForTier({
              forks: repo.forks,
              issues: repo.open_issues,
              prActivity: cached.pullRequests?.total_prs,
              contributors: cached.pullRequests?.unique_contributors,
            });

          await this.deps.storageEnhanced.updateRepoTier(repoId, {
            stars: repo.stars,
            growth_velocity: growthVelocity,
            engagement_score: engagementScore,
          });

          await this.deps.storageEnhanced.markRepoScanned(repoId, "deep");

          // All Tier 1 ("hot prospects") repos get Claude analysis
          await this.deps.analyzeRepo(repo, true);

          result.succeeded++;

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: repoId,
            name: repo.full_name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }

  /**
   * Process Tier 2 repositories (basic scan, promotion check).
   */
  async processTier2Repos(): Promise<BatchResult> {
    console.log("Processing Tier 2 repositories...");
    const tier2Repos = await this.deps.storageEnhanced.getReposNeedingScan(
      2,
      "basic",
    );
    console.log(`Found ${tier2Repos.length} Tier 2 repos needing scan`);

    const result: BatchResult = {
      total: tier2Repos.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const BATCH_SIZE = 50;

    for (let i = 0; i < tier2Repos.length; i += BATCH_SIZE) {
      const batch = tier2Repos.slice(i, i + BATCH_SIZE);

      for (const repoId of batch) {
        let repo = await this.deps.storage.getRepository(repoId);
        if (!repo) continue;

        try {
          // Refresh repo data from GitHub API
          try {
            const fresh = await this.deps.github.getRepoDetails(
              repo.owner,
              repo.name,
            );
            await this.deps.storage.saveRepository(fresh);
            repo = fresh;
          } catch (err) {
            console.warn(
              `Could not refresh ${repo.full_name}, using cached data`,
            );
          }

          // Check per-metric freshness — only fetch stale metrics
          const freshness =
            await this.deps.storageEnhanced.getMetricsFreshness(repoId);

          const [stars, issues] = await Promise.all([
            isStale(freshness.stars, 12)
              ? this.deps.githubEnhanced.getStarHistory(
                  repo.owner,
                  repo.name,
                  7,
                )
              : null,
            isStale(freshness.issues, 12)
              ? this.deps.githubEnhanced.getIssueMetrics(
                  repo.owner,
                  repo.name,
                  7,
                )
              : null,
          ]);

          if (stars) {
            await this.deps.storageEnhanced.saveStarHistory(
              stars.map((s) => ({ ...s, repo_id: repoId })),
            );
          }
          if (issues) {
            await this.deps.storageEnhanced.saveIssueMetrics({
              ...issues,
              repo_id: repoId,
            });
          }

          // Read from D1 for growth velocity calc
          const cached =
            await this.deps.storageEnhanced.getComprehensiveMetrics(repoId);

          // Check for promotion to Tier 1
          const growthVelocity =
            this.deps.analyzerEnhanced.calculateGrowthVelocity(
              repo.stars,
              cached.stars,
            );
          if (growthVelocity > 10 || repo.stars >= 100) {
            await this.deps.storageEnhanced.updateRepoTier(repoId, {
              stars: repo.stars,
              growth_velocity: growthVelocity,
              engagement_score: 50,
            });
          }

          await this.deps.storageEnhanced.markRepoScanned(repoId, "basic");

          result.succeeded++;

          // Lighter rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: repoId,
            name: repo?.full_name ?? repoId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }

  /**
   * Process Tier 3 repositories (minimal scan, promotion check).
   */
  async processTier3Repos(): Promise<BatchResult> {
    console.log("Processing Tier 3 repositories...");
    const tier3Repos = await this.deps.storageEnhanced.getReposNeedingScan(
      3,
      "basic",
    );
    console.log(`Found ${tier3Repos.length} Tier 3 repos needing scan`);

    const result: BatchResult = {
      total: tier3Repos.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const batchSize = 50;
    for (let i = 0; i < tier3Repos.length; i += batchSize) {
      const batch = tier3Repos.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (repoId) => {
          const repo = await this.deps.storage.getRepository(repoId);
          if (!repo) return;

          try {
            await this.deps.storage.saveMetrics({
              repo_id: repoId,
              stars: repo.stars,
              forks: repo.forks,
              open_issues: repo.open_issues,
              watchers: repo.stars,
              contributors: Math.ceil(repo.forks * 0.1),
              commits_count: 0,
              recorded_at: new Date().toISOString(),
            });

            if (repo.stars >= 50) {
              await this.deps.storageEnhanced.updateRepoTier(repoId, {
                stars: repo.stars,
                growth_velocity: 0,
                engagement_score: 30,
              });
            }

            await this.deps.storageEnhanced.markRepoScanned(repoId, "basic");

            result.succeeded++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              id: repoId,
              name: repo.full_name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );

      // Rate limiting between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return result;
  }

  /**
   * Save metrics keyed by repo_id, skipping undefined entries.
   */
  private async saveMetricsWithRepoId(
    repoId: string,
    metrics: {
      commits?: any[];
      releases?: any[];
      prs?: any;
      issues?: any;
      stars?: any[];
      forks?: any;
    },
  ): Promise<void> {
    if (metrics.commits) {
      await this.deps.storageEnhanced.saveCommitMetrics(
        metrics.commits.map((c) => ({ ...c, repo_id: repoId })),
      );
    }
    if (metrics.releases) {
      await this.deps.storageEnhanced.saveReleaseMetrics(
        metrics.releases.map((r) => ({ ...r, repo_id: repoId })),
      );
    }
    if (metrics.prs) {
      await this.deps.storageEnhanced.savePullRequestMetrics({
        ...metrics.prs,
        repo_id: repoId,
      });
    }
    if (metrics.issues) {
      await this.deps.storageEnhanced.saveIssueMetrics({
        ...metrics.issues,
        repo_id: repoId,
      });
    }
    if (metrics.stars) {
      await this.deps.storageEnhanced.saveStarHistory(
        metrics.stars.map((s) => ({ ...s, repo_id: repoId })),
      );
    }
    if (metrics.forks) {
      await this.deps.storageEnhanced.saveForkAnalysis({
        ...metrics.forks,
        repo_id: repoId,
      });
    }
  }
}
