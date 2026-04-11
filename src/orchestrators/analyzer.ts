import type {
  Repository,
  Analysis,
  BatchResult,
} from "../types";
import { CONFIG as Config } from "../types";
import type { GitHubService } from "../services/github";
import type { ClaudeService } from "../services/claude";
import type { StorageService } from "../services/storage";
import type { StorageEnhancedService } from "../services/storage-enhanced";
import type { RepoAnalyzer } from "../analyzers/repoAnalyzer";

export interface BatchState {
  batchId: string;
  type: string;
  startTime: number;
  status: "active" | "completed" | "failed";
  processed: number;
  succeeded: number;
  failed: number;
  totalRepos?: number;
  tierProgress?: {
    tier1: { processed: number; total: number };
    tier2: { processed: number; total: number };
    tier3: { processed: number; total: number };
  };
  lastUpdate: number;
  endTime?: number;
  duration?: number;
  error?: string;
  reason?: string;
  errors?: Array<{ id: string; name: string; error: string }>;
}

export interface AnalysisDeps {
  github: GitHubService;
  claude: ClaudeService;
  storage: StorageService;
  storageEnhanced: StorageEnhancedService;
  analyzer: RepoAnalyzer;
  saveBatchState: (batchId: string, state: BatchState) => Promise<void>;
}

export class AnalysisOrchestrator {
  private deps: AnalysisDeps;

  constructor(deps: AnalysisDeps) {
    this.deps = deps;
  }

  /**
   * Analyze a single repository.
   * Returns the saved analysis, or null if the repo didn't meet the score threshold.
   */
  async analyzeRepository(
    repo: Repository,
    forceAnalysis: boolean = false,
  ): Promise<Analysis | null> {
    console.log(
      `Analyzing repository: ${repo.full_name} (force: ${forceAnalysis})`,
    );

    const score = await this.deps.analyzer.analyze(repo);
    console.log(`Score for ${repo.full_name}: ${score.total}`);

    if (!forceAnalysis && !this.deps.analyzer.isHighPotential(score)) {
      console.log(
        `${repo.full_name} does not meet threshold for deep analysis (score: ${score.total})`,
      );
      return null;
    }

    const readme = await this.deps.github.getReadmeContent(
      repo.owner,
      repo.name,
    );
    const model = this.deps.analyzer.getRecommendedModel(score);

    console.log(
      `Using model ${model} for ${repo.full_name} (score: ${score.total}, growth: ${score.growth})`,
    );

    const analysis = await this.deps.claude.analyzeRepository(
      repo,
      readme,
      model,
    );

    await this.deps.storage.saveAnalysis(analysis);

    // Generate alert if needed
    if (
      analysis.scores.investment >= Config.alerts.scoreThreshold ||
      score.growth >= 90
    ) {
      await this.deps.storage.saveAlert({
        repo_id: repo.id,
        type: "investment_opportunity",
        level: analysis.scores.investment >= 90 ? "urgent" : "high",
        message: `High-potential investment opportunity: ${repo.full_name} (Score: ${analysis.scores.investment})`,
        metadata: {
          investment_score: analysis.scores.investment,
          growth_score: score.growth,
          recommendation: analysis.recommendation,
          model_used: model,
          technical_moat: analysis.scores.technical_moat,
          scalability: analysis.scores.scalability,
        },
      });
    }

    // Get contributors for high-scoring repos
    if (analysis.scores.investment >= 70) {
      try {
        const contributors = await this.deps.github.getContributors(
          repo.owner,
          repo.name,
        );
        await this.deps.storage.saveContributors(repo.id, contributors);
      } catch (error) {
        console.error(
          `Error getting contributors for ${repo.full_name}:`,
          error,
        );
      }
    }

    return await this.deps.storage.getLatestAnalysis(repo.id);
  }

  /**
   * Run a batch analysis on repositories that are stale or never analyzed.
   * Uses saveBatchState callback to persist progress in Durable Object state.
   * Returns a BatchResult with success/failure counts and error details.
   */
  async runBatch(): Promise<BatchResult> {
    console.log("Starting automated batch analysis...");

    const batchId = `auto_${Date.now()}`;
    const startTime = Date.now();
    const result: BatchResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

    try {
      await this.deps.saveBatchState(batchId, {
        batchId,
        type: "automated",
        startTime,
        status: "active",
        processed: 0,
        succeeded: 0,
        failed: 0,
        tierProgress: {
          tier1: { processed: 0, total: 0 },
          tier2: { processed: 0, total: 0 },
          tier3: { processed: 0, total: 0 },
        },
        lastUpdate: startTime,
      });

      const reposNeedingAnalysis =
        await this.deps.storageEnhanced.getReposNeedingAnalysis("all", false);

      if (reposNeedingAnalysis.length === 0) {
        console.log("No repositories need analysis at this time");
        await this.deps.saveBatchState(batchId, {
          batchId,
          type: "automated",
          startTime,
          status: "completed",
          processed: 0,
          succeeded: 0,
          failed: 0,
          reason: "No stale repositories found",
          lastUpdate: Date.now(),
        });
        return result;
      }

      result.total = Math.min(reposNeedingAnalysis.length, 200);

      console.log(
        `Automated analysis: Processing ${reposNeedingAnalysis.length} repositories`,
      );

      // Count repos per tier
      const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
      reposNeedingAnalysis.forEach((r) => {
        if (r.tier === 1) tierCounts.tier1++;
        if (r.tier === 2) tierCounts.tier2++;
        if (r.tier === 3) tierCounts.tier3++;
      });

      const tierProgress = {
        tier1: { processed: 0, total: tierCounts.tier1 },
        tier2: { processed: 0, total: tierCounts.tier2 },
        tier3: { processed: 0, total: tierCounts.tier3 },
      };

      await this.deps.saveBatchState(batchId, {
        batchId,
        type: "automated",
        startTime,
        status: "active",
        processed: 0,
        succeeded: 0,
        failed: 0,
        totalRepos: reposNeedingAnalysis.length,
        tierProgress,
        lastUpdate: Date.now(),
      });

      // Process in chunks to avoid CPU timeout
      const CHUNK_SIZE = 10;
      for (
        let i = 0;
        i < reposNeedingAnalysis.length && i < 200;
        i += CHUNK_SIZE
      ) {
        const chunk = reposNeedingAnalysis.slice(i, i + CHUNK_SIZE);

        for (const repoData of chunk) {
          try {
            const repo = await this.deps.storage.getRepository(repoData.id);
            if (!repo) {
              console.log(`Repository ${repoData.id} not found, skipping`);
              result.failed++;
              result.errors.push({
                id: repoData.id,
                name: repoData.full_name,
                error: "Repository not found in database",
              });
              continue;
            }

            await this.analyzeRepository(repo, true);
            result.succeeded++;

            // Update tier-specific progress
            if (repoData.tier === 1) tierProgress.tier1.processed++;
            if (repoData.tier === 2) tierProgress.tier2.processed++;
            if (repoData.tier === 3) tierProgress.tier3.processed++;

            await this.deps.saveBatchState(batchId, {
              batchId,
              type: "automated",
              startTime,
              status: "active",
              processed: result.succeeded + result.failed,
              succeeded: result.succeeded,
              failed: result.failed,
              totalRepos: reposNeedingAnalysis.length,
              tierProgress,
              lastUpdate: Date.now(),
            });

            console.log(
              `Automated batch progress: ${result.succeeded + result.failed}/${reposNeedingAnalysis.length} (Tier 1: ${tierProgress.tier1.processed}/${tierProgress.tier1.total}, Tier 2: ${tierProgress.tier2.processed}/${tierProgress.tier2.total}, Tier 3: ${tierProgress.tier3.processed}/${tierProgress.tier3.total})`,
            );

            // Brief pause for DO state updates (Claude rate limiter handles API pacing)
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (error) {
            console.error(`Error analyzing ${repoData.full_name}:`, error);
            result.failed++;
            result.errors.push({
              id: repoData.id,
              name: repoData.full_name,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Small delay between chunks
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Mark batch as completed — include error details (capped at 50)
      await this.deps.saveBatchState(batchId, {
        batchId,
        type: "automated",
        startTime,
        status: "completed",
        processed: result.succeeded + result.failed,
        succeeded: result.succeeded,
        failed: result.failed,
        totalRepos: reposNeedingAnalysis.length,
        tierProgress,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        lastUpdate: Date.now(),
        errors: result.errors.slice(0, 50),
      });

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `Automated batch analysis completed in ${duration}s: ${result.succeeded} succeeded, ${result.failed} failed`,
      );
    } catch (error) {
      console.error("Error in automated batch analysis:", error);

      await this.deps.saveBatchState(batchId, {
        batchId,
        type: "automated",
        startTime,
        status: "failed",
        processed: result.succeeded + result.failed,
        succeeded: result.succeeded,
        failed: result.failed,
        error: error instanceof Error ? error.message : "Unknown error",
        endTime: Date.now(),
        lastUpdate: Date.now(),
        errors: result.errors.slice(0, 50),
      });
    }

    return result;
  }
}
