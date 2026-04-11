import type { Env, Repository, BatchResult } from "../types";
import { CONFIG as Config } from "../types";
import { GitHubService } from "../services/github";
import { GitHubEnhancedService } from "../services/github-enhanced";
import { ClaudeService } from "../services/claude";
import { StorageService } from "../services/storage";
import { StorageEnhancedService } from "../services/storage-enhanced";
import { RepoAnalyzer } from "../analyzers/repoAnalyzer";
import { RepoAnalyzerEnhanced } from "../analyzers/repoAnalyzer-enhanced";
import { ScanOrchestrator } from "../orchestrators/scanner";
import { AnalysisOrchestrator } from "../orchestrators/analyzer";
import type { BatchState } from "../orchestrators/analyzer";

export class GitHubAgent {
  private state: DurableObjectState;
  private env: Env;
  private github: GitHubService;
  private storage: StorageService;
  private storageEnhanced: StorageEnhancedService;
  private scanner: ScanOrchestrator;
  private analysisOrchestrator: AnalysisOrchestrator;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    const github = new GitHubService(env);
    const githubEnhanced = new GitHubEnhancedService(env);
    const claude = new ClaudeService(env);
    const storage = new StorageService(env);
    const storageEnhanced = new StorageEnhancedService(env);
    const analyzer = new RepoAnalyzer(env);
    const analyzerEnhanced = new RepoAnalyzerEnhanced(env);

    this.github = github;
    this.storage = storage;
    this.storageEnhanced = storageEnhanced;

    // Create analysis orchestrator first (scanner's callback references it)
    this.analysisOrchestrator = new AnalysisOrchestrator({
      github,
      claude,
      storage,
      storageEnhanced,
      analyzer,
      saveBatchState: (batchId: string, batchState: BatchState) =>
        this.state.storage.put(`batch:${batchId}`, batchState),
    });

    this.scanner = new ScanOrchestrator({
      github,
      githubEnhanced,
      storage,
      storageEnhanced,
      analyzerEnhanced,
      analyzeRepo: (repo, force) =>
        this.analysisOrchestrator.analyzeRepository(repo, force),
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async saveSystemAlert(
    operation: string,
    result: BatchResult,
  ): Promise<void> {
    await this.storage.saveAlert({
      repo_id: "system",
      type: "system",
      level: result.failed > 10 ? "urgent" : "medium",
      message: `${operation}: ${result.failed}/${result.total} repos failed`,
      metadata: {
        operation,
        total: result.total,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors.slice(0, 20),
      },
    });
  }

  private transformAnalysisForFrontend(analysis: any): any {
    if (!analysis) return null;
    return {
      repo_id: analysis.repo_id,
      investment_score: analysis.scores?.investment || 0,
      innovation_score: analysis.scores?.innovation || 0,
      team_score: analysis.scores?.team || 0,
      market_score: analysis.scores?.market || 0,
      analyzed_at: analysis.metadata?.timestamp || analysis.created_at,
      recommendation: analysis.recommendation,
      summary: analysis.summary,
      strengths: analysis.strengths,
      risks: analysis.risks,
      questions: analysis.questions,
      technical_moat: analysis.scores?.technical_moat,
      scalability: analysis.scores?.scalability,
      growth_prediction: analysis.scores?.growth_prediction,
      model_used: analysis.metadata?.model,
      cost: analysis.metadata?.cost,
    };
  }

  // ---------------------------------------------------------------------------
  // HTTP routing
  // ---------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Dynamic route: /analyze/:owner/:repo
      const analyzeMatch = url.pathname.match(
        /^\/analyze\/([^\/]+)\/([^\/]+)$/,
      );
      if (analyzeMatch) {
        return this.handleAnalyzeByPath(analyzeMatch[1], analyzeMatch[2]);
      }

      const handlers: Record<string, () => Promise<Response>> = {
        "/scan": () => this.handleScan(request),
        "/scan/comprehensive": () => this.handleComprehensiveScan(),
        "/analyze": () => this.handleAnalyze(request),
        "/status": () => this.handleStatus(),
        "/report": () => this.handleReport(),
        "/init": () => this.handleInit(),
        "/scheduled": () => this.handleScheduled(request),
        "/metrics": () => this.handleMetrics(request),
        "/tiers": () => this.handleTiers(request),
        "/batch/active": () => this.handleGetActiveBatch(),
        "/batch/status": () => this.handleGetBatchStatus(request),
        "/batch/history": () => this.handleGetBatchHistory(),
      };

      const handler = handlers[url.pathname];
      return handler
        ? await handler()
        : new Response("Not found", { status: 404 });
    } catch (error) {
      console.error("Error in GitHubAgent:", error);
      return this.jsonResponse(
        { error: error instanceof Error ? error.message : "Unknown error" },
        500,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  private async handleInit(): Promise<Response> {
    const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
    await this.state.storage.setAlarm(nextRun);
    return this.jsonResponse({
      message: "Agent initialized",
      nextRun: new Date(nextRun).toISOString(),
    });
  }

  async alarm(): Promise<void> {
    console.log("=== Running automated scheduled operations ===");

    try {
      console.log("Phase 1: Scanning for new repositories...");
      const scanResult = await this.scanner.comprehensiveScan();

      console.log("Phase 2: Running automated batch analysis...");
      const batchResult = await this.analysisOrchestrator.runBatch();

      if (scanResult.failed > 0) {
        console.warn(
          `Scheduled scan: ${scanResult.failed}/${scanResult.total} failed`,
        );
        await this.saveSystemAlert("scan", scanResult);
      }
      if (batchResult.failed > 0) {
        console.warn(
          `Scheduled analysis: ${batchResult.failed}/${batchResult.total} failed`,
        );
        await this.saveSystemAlert("analysis", batchResult);
      }

      console.log("=== Scheduled operations completed ===");
    } catch (error) {
      console.error("Fatal error in scheduled operations:", error);
    }

    // Schedule next run
    const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
    await this.state.storage.setAlarm(nextRun);
    console.log(`Next scheduled run: ${new Date(nextRun).toISOString()}`);
  }

  /**
   * Handle cron-triggered scheduled operations.
   * Routes by cron pattern:
   *   "15,45 * * * *"  -> analysis-only (every 30 min)
   *   "0 2,14 * * *"   -> full sweep: scan + analysis (twice daily)
   *   "0 * * * *"      -> scan only (hourly)
   */
  private async handleScheduled(request?: Request): Promise<Response> {
    let cron = "";
    try {
      if (request) {
        const body = (await request.json()) as any;
        cron = body?.cron || "";
      }
    } catch {
      // Empty or invalid body — default to full sweep
    }

    console.log(
      `=== Running cron-triggered operations (cron: ${cron || "unknown"}) ===`,
    );

    try {
      if (cron === "15,45 * * * *") {
        console.log("Mode: analysis-only batch run");
        const result = await this.analysisOrchestrator.runBatch();
        if (result.failed > 0) {
          await this.saveSystemAlert("analysis", result);
        }
      } else if (cron === "0 2,14 * * *") {
        console.log("Mode: full sweep (scan + analysis)");
        const scanResult = await this.scanner.comprehensiveScan();
        const batchResult = await this.analysisOrchestrator.runBatch();
        if (scanResult.failed > 0) {
          await this.saveSystemAlert("scan", scanResult);
        }
        if (batchResult.failed > 0) {
          await this.saveSystemAlert("analysis", batchResult);
        }
      } else {
        console.log("Mode: scan only");
        const result = await this.scanner.comprehensiveScan();
        if (result.failed > 0) {
          await this.saveSystemAlert("scan", result);
        }
      }

      console.log("=== Cron-triggered operations completed ===");
      return this.jsonResponse({ status: "completed", cron });
    } catch (error) {
      console.error("Error in cron-triggered operations:", error);
      return this.jsonResponse(
        {
          status: "failed",
          cron,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Scan / Analyze handlers
  // ---------------------------------------------------------------------------

  private async handleScan(request: Request): Promise<Response> {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty or invalid body — use defaults
    }
    const topics = body.topics || Config.github.topics;
    const minStars = body.minStars || Config.github.minStars;

    const repos = await this.scanGitHub(topics, minStars);

    return this.jsonResponse({
      message: "Scan completed",
      repositoriesFound: repos.length,
      repositories: repos.slice(0, 10),
    });
  }

  private async handleComprehensiveScan(): Promise<Response> {
    console.log("Starting manual comprehensive scan...");

    try {
      const startTime = Date.now();
      const result = await this.scanner.comprehensiveScan();
      const duration = Date.now() - startTime;

      return this.jsonResponse({
        message: "Comprehensive scan completed",
        duration: `${Math.round(duration / 1000)}s`,
        result: {
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
          errors: result.errors.slice(0, 20),
        },
        tiers: {
          tier1: await this.storageEnhanced.getReposByTier(1, 10),
          tier2: await this.storageEnhanced.getReposByTier(2, 10),
          tier3: await this.storageEnhanced.getReposByTier(3, 10),
        },
      });
    } catch (error) {
      console.error("Error in comprehensive scan:", error);
      return this.jsonResponse(
        { error: error instanceof Error ? error.message : "Scan failed" },
        500,
      );
    }
  }

  private async handleAnalyzeByPath(
    owner: string,
    name: string,
  ): Promise<Response> {
    let repo = await this.storage.getRepositoryByName(owner, name);

    if (!repo) {
      try {
        repo = await this.github.getRepoDetails(owner, name);
        await this.storage.saveRepository(repo);
        console.log(
          `Repository ${owner}/${name} fetched from GitHub and saved`,
        );
      } catch (error) {
        return this.jsonResponse(
          {
            error: `Repository ${owner}/${name} not found: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
          404,
        );
      }
    }

    // Check for recent analysis
    const analysisWithRepo = await this.storage.getLatestAnalysisWithRepo(
      repo.id,
    );
    if (analysisWithRepo) {
      return this.jsonResponse({
        analysis: this.transformAnalysisForFrontend(analysisWithRepo.analysis),
        repository: analysisWithRepo.repository,
      });
    }

    // Perform analysis
    try {
      await this.analysisOrchestrator.analyzeRepository(repo);

      const newAnalysisWithRepo = await this.storage.getLatestAnalysisWithRepo(
        repo.id,
      );
      if (newAnalysisWithRepo) {
        return this.jsonResponse({
          analysis: this.transformAnalysisForFrontend(
            newAnalysisWithRepo.analysis,
          ),
          repository: newAnalysisWithRepo.repository,
        });
      } else {
        return this.jsonResponse({ analysis: null, repository: repo });
      }
    } catch (error) {
      console.error(`Error analyzing ${repo.full_name}:`, error);
      return this.jsonResponse({
        analysis: null,
        repository: repo,
        error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  private async handleAnalyze(request: Request): Promise<Response> {
    const body = (await request.json()) as any;
    const { repoId, repoOwner, repoName, force } = body;

    if (!repoId && (!repoOwner || !repoName)) {
      return this.jsonResponse(
        {
          error:
            "Missing required parameters: need either repoId or repoOwner+repoName",
        },
        400,
      );
    }

    let repo: Repository;
    if (repoId) {
      const stored = await this.storage.getRepository(repoId);
      if (!stored) {
        return this.jsonResponse({ error: "Repository not found by ID" }, 404);
      }
      repo = stored;
    } else {
      let stored = await this.storage.getRepositoryByName(repoOwner, repoName);
      if (stored) {
        repo = stored;
      } else {
        try {
          repo = await this.github.getRepoDetails(repoOwner, repoName);
          await this.storage.saveRepository(repo);
          console.log(
            `Repository ${repoOwner}/${repoName} fetched from GitHub and saved`,
          );
        } catch (error) {
          return this.jsonResponse(
            {
              error: `Repository ${repoOwner}/${repoName} not found on GitHub: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
            404,
          );
        }
      }
    }

    // Check cache
    if (!force && (await this.storage.hasRecentAnalysis(repo.id))) {
      const analysisWithRepo = await this.storage.getLatestAnalysisWithRepo(
        repo.id,
      );
      if (analysisWithRepo) {
        return this.jsonResponse({
          message: "Using cached analysis",
          analysis: this.transformAnalysisForFrontend(
            analysisWithRepo.analysis,
          ),
          repository: analysisWithRepo.repository,
        });
      }
    }

    try {
      const analysis = await this.analysisOrchestrator.analyzeRepository(
        repo,
        force || false,
      );

      const analysisWithRepo = await this.storage.getLatestAnalysisWithRepo(
        repo.id,
      );
      if (analysisWithRepo) {
        return this.jsonResponse({
          message: "Analysis completed",
          analysis: this.transformAnalysisForFrontend(
            analysisWithRepo.analysis,
          ),
          repository: analysisWithRepo.repository,
        });
      } else {
        return this.jsonResponse({
          message: "Analysis completed",
          analysis,
          repository: repo,
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${repo.full_name}:`, error);
      return this.jsonResponse(
        {
          error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
        500,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Manual scan helpers (simple single-topic path, not the comprehensive scan)
  // ---------------------------------------------------------------------------

  private async scanGitHub(
    topics: string[] = Config.github.topics,
    minStars: number = Config.github.minStars,
  ): Promise<Repository[]> {
    console.log(`Scanning GitHub for topics: ${topics.join(", ")}`);

    const repos = await this.github.searchTrendingRepos(topics, minStars);

    for (const repo of repos) {
      await this.storage.saveRepository(repo);
      await this.storage.saveMetrics({
        repo_id: repo.id,
        stars: repo.stars,
        forks: repo.forks,
        open_issues: repo.open_issues,
        watchers: repo.stars,
        contributors: Math.ceil(repo.forks * 0.1),
        commits_count: 0,
        recorded_at: new Date().toISOString(),
      });
    }

    console.log(`Found ${repos.length} repositories`);
    return repos;
  }

  // ---------------------------------------------------------------------------
  // Read-only query handlers
  // ---------------------------------------------------------------------------

  private async handleStatus(): Promise<Response> {
    const [stats, rateLimit] = await Promise.all([
      this.storage.getDailyStats(),
      this.github.checkRateLimit(),
    ]);

    return this.jsonResponse({
      status: "active",
      dailyStats: stats,
      githubRateLimit: rateLimit,
      nextScheduledRun: new Date(
        Date.now() + Config.github.scanInterval * 60 * 60 * 1000,
      ).toISOString(),
    });
  }

  private async handleReport(): Promise<Response> {
    const [highGrowthRepos, recentAlerts, trends] = await Promise.all([
      this.storage.getHighGrowthRepos(30, 200),
      this.storage.getRecentAlerts(10),
      this.storage.getRecentTrends(),
    ]);

    const stats = await this.storage.getDailyStats();

    return this.jsonResponse({
      date: new Date().toISOString(),
      highGrowthRepos: highGrowthRepos.slice(0, 10),
      recentAlerts,
      trends,
      metrics: stats,
    });
  }

  private async handleMetrics(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const repoId = url.searchParams.get("repo_id");

    if (!repoId) {
      return this.jsonResponse({ error: "repo_id required" }, 400);
    }

    const metrics =
      await this.storageEnhanced.getComprehensiveMetrics(repoId);
    return this.jsonResponse(metrics);
  }

  private async handleTiers(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tier = parseInt(url.searchParams.get("tier") || "1");

    if (![1, 2, 3].includes(tier)) {
      return this.jsonResponse(
        { error: "Invalid tier. Must be 1, 2, or 3" },
        400,
      );
    }

    const repos = await this.storageEnhanced.getReposByTier(tier as 1 | 2 | 3);
    return this.jsonResponse({
      tier,
      count: repos.length,
      repos: repos.slice(0, 100),
    });
  }

  // ---------------------------------------------------------------------------
  // Batch state queries (read from Durable Object state)
  // ---------------------------------------------------------------------------

  private async handleGetActiveBatch(): Promise<Response> {
    const allKeys = await this.state.storage.list({ prefix: "batch:" });

    for (const [key, value] of allKeys.entries()) {
      const batch = value as any;
      if (batch.status === "active") {
        const lastUpdate = batch.lastUpdate || batch.startTime;
        const isBatchStale = Date.now() - lastUpdate > 5 * 60 * 1000;

        return this.jsonResponse({
          batchId: batch.batchId,
          type: batch.type,
          status: isBatchStale ? "stale" : "active",
          progress: {
            processed: batch.processed || 0,
            total: batch.totalRepos || 0,
            succeeded: batch.succeeded || 0,
            failed: batch.failed || 0,
            tierProgress: batch.tierProgress || null,
          },
          startTime: batch.startTime,
          lastUpdate: batch.lastUpdate,
          isStale: isBatchStale,
        });
      }
    }

    return this.jsonResponse({ batchId: null, message: "No active batch" });
  }

  private async handleGetBatchStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const batchId = url.searchParams.get("batchId");

    if (!batchId) {
      return this.jsonResponse({ error: "batchId parameter required" }, 400);
    }

    const batch = (await this.state.storage.get(`batch:${batchId}`)) as any;
    if (!batch) {
      return this.jsonResponse({ error: "Batch not found", batchId }, 404);
    }

    return this.jsonResponse({
      batchId: batch.batchId,
      type: batch.type,
      status: batch.status,
      progress: {
        processed: batch.processed || 0,
        total: batch.totalRepos || 0,
        succeeded: batch.succeeded || 0,
        failed: batch.failed || 0,
        tierProgress: batch.tierProgress || null,
      },
      startTime: batch.startTime,
      endTime: batch.endTime,
      duration: batch.duration,
      lastUpdate: batch.lastUpdate,
      error: batch.error,
      reason: batch.reason,
    });
  }

  private async handleGetBatchHistory(): Promise<Response> {
    const allKeys = await this.state.storage.list({ prefix: "batch:" });
    const batches = [];

    for (const [key, value] of allKeys.entries()) {
      batches.push(value);
    }

    batches.sort((a: any, b: any) => b.startTime - a.startTime);

    return this.jsonResponse({
      batches: batches.slice(0, 10).map((b: any) => ({
        batchId: b.batchId,
        type: b.type,
        status: b.status,
        processed: b.processed || 0,
        succeeded: b.succeeded || 0,
        failed: b.failed || 0,
        startTime: b.startTime,
        endTime: b.endTime,
        duration: b.duration,
      })),
    });
  }
}

export default GitHubAgent;
