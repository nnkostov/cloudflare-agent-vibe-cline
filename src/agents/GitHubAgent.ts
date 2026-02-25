import type { Env, Repository, Score, CONFIG } from "../types";
import { GitHubService } from "../services/github";
import { GitHubEnhancedService } from "../services/github-enhanced";
import { ClaudeService } from "../services/claude";
import { StorageService } from "../services/storage";
import { StorageEnhancedService } from "../services/storage-enhanced";
import { RepoAnalyzer } from "../analyzers/repoAnalyzer";
import { RepoAnalyzerEnhanced } from "../analyzers/repoAnalyzer-enhanced";
import { CONFIG as Config } from "../types";

/** Check if a metric timestamp is older than maxAgeHours (or missing). */
function isStale(timestamp: string | null, maxAgeHours: number): boolean {
  if (!timestamp) return true;
  const age = Date.now() - new Date(timestamp).getTime();
  return age > maxAgeHours * 60 * 60 * 1000;
}

export class GitHubAgent {
  private state: DurableObjectState;
  private env: Env;
  private github: GitHubService;
  private githubEnhanced: GitHubEnhancedService;
  private claude: ClaudeService;
  private storage: StorageService;
  private storageEnhanced: StorageEnhancedService;
  private analyzer: RepoAnalyzer;
  private analyzerEnhanced: RepoAnalyzerEnhanced;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.github = new GitHubService(env);
    this.githubEnhanced = new GitHubEnhancedService(env);
    this.claude = new ClaudeService(env);
    this.storage = new StorageService(env);
    this.storageEnhanced = new StorageEnhancedService(env);
    this.analyzer = new RepoAnalyzer(env);
    this.analyzerEnhanced = new RepoAnalyzerEnhanced(env);
  }

  /**
   * Helper method to create JSON responses
   */
  private jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Transform analysis data from nested structure to flat structure for frontend
   */
  private transformAnalysisForFrontend(analysis: any): any {
    if (!analysis) return null;

    return {
      repo_id: analysis.repo_id,
      // Flatten scores
      investment_score: analysis.scores?.investment || 0,
      innovation_score: analysis.scores?.innovation || 0,
      team_score: analysis.scores?.team || 0,
      market_score: analysis.scores?.market || 0,
      // Map metadata.timestamp to analyzed_at
      analyzed_at: analysis.metadata?.timestamp || analysis.created_at,
      // Keep other fields as is
      recommendation: analysis.recommendation,
      summary: analysis.summary,
      strengths: analysis.strengths,
      risks: analysis.risks,
      questions: analysis.questions,
      // Include enhanced fields if available
      technical_moat: analysis.scores?.technical_moat,
      scalability: analysis.scores?.scalability,
      growth_prediction: analysis.scores?.growth_prediction,
      // Include metadata
      model_used: analysis.metadata?.model,
      cost: analysis.metadata?.cost,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // Check for dynamic routes first
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
        "/scheduled": () => this.handleScheduled(),
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
        {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  }

  /**
   * Initialize agent with scheduled scanning
   */
  private async handleInit(): Promise<Response> {
    const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
    await this.state.storage.setAlarm(nextRun);

    return this.jsonResponse({
      message: "Agent initialized",
      nextRun: new Date(nextRun).toISOString(),
    });
  }

  /**
   * Handle scheduled alarm
   */
  async alarm(): Promise<void> {
    console.log("=== Running automated scheduled operations ===");

    try {
      // Phase 1: Comprehensive repository scan (0-2 minutes)
      console.log("Phase 1: Scanning for new repositories...");
      await this.comprehensiveScan();

      // Phase 2: Automated batch analysis (2-10 minutes)
      console.log("Phase 2: Running automated batch analysis...");
      await this.runAutomatedBatchAnalysis();

      console.log("=== Scheduled operations completed ===");
    } catch (error) {
      console.error("Error in scheduled operations:", error);
    }

    // Schedule next run
    const nextRun = Date.now() + Config.github.scanInterval * 60 * 60 * 1000;
    await this.state.storage.setAlarm(nextRun);
    console.log(`Next scheduled run: ${new Date(nextRun).toISOString()}`);
  }

  /**
   * Handle cron-triggered scheduled scan (does not reschedule alarm)
   */
  private async handleScheduled(): Promise<Response> {
    console.log("=== Running cron-triggered scheduled operations ===");
    try {
      await this.comprehensiveScan();
      await this.runAutomatedBatchAnalysis();
      console.log("=== Cron-triggered operations completed ===");
      return this.jsonResponse({ status: "completed" });
    } catch (error) {
      console.error("Error in cron-triggered operations:", error);
      return this.jsonResponse(
        { status: "failed", error: error instanceof Error ? error.message : "Unknown error" },
        500,
      );
    }
  }

  /**
   * Handle manual scan request
   */
  private async handleScan(request: Request): Promise<Response> {
    const body = (await request.json()) as any;
    const topics = body.topics || Config.github.topics;
    const minStars = body.minStars || Config.github.minStars;

    const repos = await this.scanGitHub(topics, minStars);

    return this.jsonResponse({
      message: "Scan completed",
      repositoriesFound: repos.length,
      repositories: repos.slice(0, 10),
    });
  }

  /**
   * Handle analyze request by path (GET /analyze/:owner/:repo)
   */
  private async handleAnalyzeByPath(
    owner: string,
    name: string,
  ): Promise<Response> {
    // First try to find in database
    let repo = await this.storage.getRepositoryByName(owner, name);

    if (!repo) {
      // If not found, fetch from GitHub and save
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

    // Check if we have a recent analysis
    const analysisWithRepo = await this.storage.getLatestAnalysisWithRepo(
      repo.id,
    );
    if (analysisWithRepo) {
      return this.jsonResponse({
        analysis: this.transformAnalysisForFrontend(analysisWithRepo.analysis),
        repository: analysisWithRepo.repository,
      });
    }

    // If no analysis exists, perform one
    try {
      await this.analyzeRepository(repo);

      // Get the complete analysis with repository data
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
        // Fallback if something went wrong
        return this.jsonResponse({
          analysis: null,
          repository: repo,
        });
      }
    } catch (error) {
      console.error(`Error analyzing ${repo.full_name}:`, error);
      // Return repository data even if analysis failed
      return this.jsonResponse({
        analysis: null,
        repository: repo,
        error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  /**
   * Handle analyze request
   */
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

    // Get repository
    let repo: Repository;
    if (repoId) {
      const stored = await this.storage.getRepository(repoId);
      if (!stored) {
        return this.jsonResponse({ error: "Repository not found by ID" }, 404);
      }
      repo = stored;
    } else {
      // First try to find in database
      let stored = await this.storage.getRepositoryByName(repoOwner, repoName);
      if (stored) {
        repo = stored;
      } else {
        // If not found, fetch from GitHub and save
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

    // Perform analysis (pass force parameter to bypass score check)
    try {
      const analysis = await this.analyzeRepository(repo, force || false);

      // Get the complete analysis with repository data
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
        // Fallback if something went wrong
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

  /**
   * Handle status request
   */
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

  /**
   * Handle report generation
   */
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

  /**
   * Scan GitHub for trending repositories
   */
  private async scanGitHub(
    topics: string[] = Config.github.topics,
    minStars: number = Config.github.minStars,
  ): Promise<Repository[]> {
    console.log(`Scanning GitHub for topics: ${topics.join(", ")}`);

    const repos = await this.github.searchTrendingRepos(topics, minStars);

    // Save repositories and metrics
    for (const repo of repos) {
      await this.storage.saveRepository(repo);

      // Save basic metrics without additional API calls to avoid subrequest limits
      await this.storage.saveMetrics({
        repo_id: repo.id,
        stars: repo.stars,
        forks: repo.forks,
        open_issues: repo.open_issues,
        watchers: repo.stars, // Use stars as approximation for watchers
        contributors: Math.ceil(repo.forks * 0.1), // Estimate contributors
        commits_count: 0,
        recorded_at: new Date().toISOString(),
      });
    }

    console.log(`Found ${repos.length} repositories`);
    return repos;
  }

  /**
   * Analyze high-potential repositories
   */
  private async analyzeHighPotentialRepos(repos?: Repository[]): Promise<void> {
    const highGrowthRepos =
      repos || (await this.storage.getHighGrowthRepos(30, 200));
    console.log(`Analyzing ${highGrowthRepos.length} repositories`);

    for (const repo of highGrowthRepos.slice(0, 10)) {
      try {
        if (await this.storage.hasRecentAnalysis(repo.id)) {
          console.log(`Skipping ${repo.full_name} - recent analysis exists`);
          continue;
        }

        await this.analyzeRepository(repo);
        // Reduced delay - frontend handles parallel processing with rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error analyzing ${repo.full_name}:`, error);
      }
    }
  }

  /**
   * Analyze a single repository
   */
  private async analyzeRepository(
    repo: Repository,
    forceAnalysis: boolean = false,
  ) {
    console.log(
      `Analyzing repository: ${repo.full_name} (force: ${forceAnalysis})`,
    );

    // Get initial score
    const score = await this.analyzer.analyze(repo);
    console.log(`Score for ${repo.full_name}: ${score.total}`);

    // Check if worth deep analysis (unless forced)
    if (!forceAnalysis && !this.analyzer.isHighPotential(score)) {
      console.log(
        `${repo.full_name} does not meet threshold for deep analysis (score: ${score.total})`,
      );
      return null;
    }

    // Get README and analyze
    const readme = await this.github.getReadmeContent(repo.owner, repo.name);
    const model = this.analyzer.getRecommendedModel(score);

    console.log(
      `Using model ${model} for ${repo.full_name} (score: ${score.total}, growth: ${score.growth})`,
    );

    const analysis = await this.claude.analyzeRepository(repo, readme, model);

    // Save analysis
    await this.storage.saveAnalysis(analysis);

    // Generate alert if needed
    if (
      analysis.scores.investment >= Config.alerts.scoreThreshold ||
      score.growth >= 90
    ) {
      await this.storage.saveAlert({
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
        const contributors = await this.github.getContributors(
          repo.owner,
          repo.name,
        );
        await this.storage.saveContributors(repo.id, contributors);
      } catch (error) {
        console.error(
          `Error getting contributors for ${repo.full_name}:`,
          error,
        );
      }
    }

    // Return the analysis in the format expected by the frontend
    return await this.storage.getLatestAnalysis(repo.id);
  }

  /**
   * Handle comprehensive scan request
   */
  private async handleComprehensiveScan(): Promise<Response> {
    console.log("Starting manual comprehensive scan...");

    try {
      const startTime = Date.now();
      await this.comprehensiveScan();
      const duration = Date.now() - startTime;

      return this.jsonResponse({
        message: "Comprehensive scan completed",
        duration: `${Math.round(duration / 1000)}s`,
        tiers: {
          tier1: await this.storageEnhanced.getReposByTier(1, 10),
          tier2: await this.storageEnhanced.getReposByTier(2, 10),
          tier3: await this.storageEnhanced.getReposByTier(3, 10),
        },
      });
    } catch (error) {
      console.error("Error in comprehensive scan:", error);
      return this.jsonResponse(
        {
          error: error instanceof Error ? error.message : "Scan failed",
        },
        500,
      );
    }
  }

  /**
   * Handle metrics request
   */
  private async handleMetrics(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const repoId = url.searchParams.get("repo_id");

    if (!repoId) {
      return this.jsonResponse({ error: "repo_id required" }, 400);
    }

    const metrics = await this.storageEnhanced.getComprehensiveMetrics(repoId);

    return this.jsonResponse(metrics);
  }

  /**
   * Handle tiers request
   */
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

  /**
   * Get currently active batch (if any)
   */
  private async handleGetActiveBatch(): Promise<Response> {
    // Get all batch keys
    const allKeys = await this.state.storage.list({ prefix: "batch:" });

    // Find active batches
    for (const [key, value] of allKeys.entries()) {
      const batch = value as any;
      if (batch.status === "active") {
        // Check if batch is stale (no update in 5 minutes)
        const lastUpdate = batch.lastUpdate || batch.startTime;
        const isStale = Date.now() - lastUpdate > 5 * 60 * 1000;

        return this.jsonResponse({
          batchId: batch.batchId,
          type: batch.type,
          status: isStale ? "stale" : "active",
          progress: {
            processed: batch.processed || 0,
            total: batch.totalRepos || 0,
            succeeded: batch.succeeded || 0,
            failed: batch.failed || 0,
            tierProgress: batch.tierProgress || null,
          },
          startTime: batch.startTime,
          lastUpdate: batch.lastUpdate,
          isStale,
        });
      }
    }

    return this.jsonResponse({
      batchId: null,
      message: "No active batch",
    });
  }

  /**
   * Get status of a specific batch
   */
  private async handleGetBatchStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const batchId = url.searchParams.get("batchId");

    if (!batchId) {
      return this.jsonResponse({ error: "batchId parameter required" }, 400);
    }

    const batch = (await this.state.storage.get(`batch:${batchId}`)) as any;

    if (!batch) {
      return this.jsonResponse(
        {
          error: "Batch not found",
          batchId,
        },
        404,
      );
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

  /**
   * Get batch history (last 10 batches)
   */
  private async handleGetBatchHistory(): Promise<Response> {
    const allKeys = await this.state.storage.list({ prefix: "batch:" });
    const batches = [];

    for (const [key, value] of allKeys.entries()) {
      batches.push(value);
    }

    // Sort by start time, most recent first
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

  /**
   * Comprehensive repository scanning with tiered approach
   */
  private async comprehensiveScan(): Promise<void> {
    console.log("Starting comprehensive repository scan...");

    // 1. Discover repositories using dynamic search strategies
    const strategies = this.buildSearchStrategies();
    const allRepos = await this.githubEnhanced.searchComprehensive(
      strategies,
      Config.limits.reposPerScan,
    );

    console.log(`Found ${allRepos.length} repositories across all strategies`);

    // 2. Save only NEW repositories — known repos are updated by tier processing
    const knownIds = await this.storage.getKnownRepoIds();
    const knownSet = new Set(knownIds);

    const recentRows = await this.storage.getRepoIdsWithRecentMetrics(24);
    const recentlySnapshotted = new Set(recentRows.map((r) => r.repo_id));

    let newCount = 0;
    for (const repo of allRepos) {
      if (knownSet.has(repo.id)) {
        // Update repositories row with fresh search data (no extra API call)
        await this.storage.saveRepository(repo);
        continue;
      }
      newCount++;

      await this.storage.saveRepository(repo);

      if (!recentlySnapshotted.has(repo.id)) {
        await this.storage.saveMetrics({
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

      await this.storageEnhanced.updateRepoTier(repo.id, {
        stars: repo.stars,
        growth_velocity: growthVelocity,
        engagement_score: 50, // Initial estimate
      });
    }

    console.log(
      `Discovered ${newCount} new repositories, skipped ${allRepos.length - newCount} already known`,
    );

    // 3. Backfill repo_tiers for any repos missing tier assignments
    await this.backfillRepoTiers();

    // 4. Process each tier
    await this.processTier1Repos();
    await this.processTier2Repos();
    await this.processTier3Repos();
  }

  /**
   * Build dynamic search strategies with relative date filters.
   * Mixes established-repo monitoring with new-repo discovery.
   */
  private buildSearchStrategies(): Array<{ type: string; query: string }> {
    const now = new Date();
    const daysAgo = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.toISOString().split("T")[0];
    };

    return [
      // Established repos (top by stars)
      { type: "topic", query: "topic:ai stars:>500" },
      { type: "topic", query: "topic:llm stars:>500" },
      // Recently created repos (new projects gaining traction)
      { type: "recent", query: `created:>${daysAgo(30)} topic:ai stars:>5` },
      { type: "recent", query: `created:>${daysAgo(30)} topic:llm stars:>5` },
      // Recently active repos (fresh pushes in the last week)
      {
        type: "trending",
        query: `pushed:>${daysAgo(7)} topic:ai stars:>20`,
      },
      {
        type: "trending",
        query: `pushed:>${daysAgo(7)} topic:machine-learning stars:>20`,
      },
      // Recently active Python AI repos
      {
        type: "trending",
        query: `pushed:>${daysAgo(7)} language:python topic:ai stars:>10`,
      },
    ];
  }

  /**
   * Assign tier rows to repos that exist in repositories but have no repo_tiers entry.
   * This can happen if repos were inserted before tier tracking was added.
   */
  private async backfillRepoTiers(): Promise<void> {
    const orphans = await this.storage.getReposWithoutTiers();
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

      await this.storageEnhanced.updateRepoTier(repo.id, {
        stars: repo.stars,
        growth_velocity: growthVelocity,
        engagement_score: 50,
      });
    }
  }

  /**
   * Run automated batch analysis (called by alarm)
   * Analyzes repositories that are stale or never analyzed
   */
  private async runAutomatedBatchAnalysis(): Promise<void> {
    console.log("Starting automated batch analysis...");

    const batchId = `auto_${Date.now()}`;
    const startTime = Date.now();

    try {
      // Store batch state in Durable Object
      await this.state.storage.put(`batch:${batchId}`, {
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

      // Get repositories needing analysis using same logic as /api/analyze/batch
      const reposNeedingAnalysis = await this.getRepositoriesNeedingAnalysis(
        "all",
        false,
      );

      if (reposNeedingAnalysis.length === 0) {
        console.log("No repositories need analysis at this time");
        await this.state.storage.put(`batch:${batchId}`, {
          batchId,
          type: "automated",
          startTime,
          status: "completed",
          processed: 0,
          succeeded: 0,
          failed: 0,
          reason: "No stale repositories found",
        });
        return;
      }

      console.log(
        `Automated analysis: Processing ${reposNeedingAnalysis.length} repositories`,
      );

      // Update batch with total counts
      const tierCounts = { tier1: 0, tier2: 0, tier3: 0 };
      reposNeedingAnalysis.forEach((r) => {
        if (r.tier === 1) tierCounts.tier1++;
        if (r.tier === 2) tierCounts.tier2++;
        if (r.tier === 3) tierCounts.tier3++;
      });

      await this.state.storage.put(`batch:${batchId}`, {
        batchId,
        type: "automated",
        startTime,
        status: "active",
        processed: 0,
        succeeded: 0,
        failed: 0,
        totalRepos: reposNeedingAnalysis.length,
        tierProgress: {
          tier1: { processed: 0, total: tierCounts.tier1 },
          tier2: { processed: 0, total: tierCounts.tier2 },
          tier3: { processed: 0, total: tierCounts.tier3 },
        },
        lastUpdate: Date.now(),
      });

      // Process repositories in chunks (to avoid CPU timeout)
      const CHUNK_SIZE = 10; // Process 10 repos per chunk
      let totalProcessed = 0;
      let totalSucceeded = 0;
      let totalFailed = 0;

      for (
        let i = 0;
        i < reposNeedingAnalysis.length && i < 100;
        i += CHUNK_SIZE
      ) {
        const chunk = reposNeedingAnalysis.slice(i, i + CHUNK_SIZE);

        for (const repoData of chunk) {
          try {
            const repo = await this.storage.getRepository(repoData.id);
            if (!repo) {
              console.log(`Repository ${repoData.id} not found, skipping`);
              totalFailed++;
              continue;
            }

            // Analyze the repository
            await this.analyzeRepository(repo);
            totalSucceeded++;

            // Update batch progress in DO state
            const batchState: any = await this.state.storage.get(
              `batch:${batchId}`,
            );
            if (batchState) {
              totalProcessed++;

              // Update tier-specific progress
              if (repoData.tier === 1)
                batchState.tierProgress.tier1.processed++;
              if (repoData.tier === 2)
                batchState.tierProgress.tier2.processed++;
              if (repoData.tier === 3)
                batchState.tierProgress.tier3.processed++;

              batchState.processed = totalProcessed;
              batchState.succeeded = totalSucceeded;
              batchState.failed = totalFailed;
              batchState.lastUpdate = Date.now();

              await this.state.storage.put(`batch:${batchId}`, batchState);

              console.log(
                `Automated batch progress: ${totalProcessed}/${reposNeedingAnalysis.length} (Tier 1: ${batchState.tierProgress.tier1.processed}/${batchState.tierProgress.tier1.total}, Tier 2: ${batchState.tierProgress.tier2.processed}/${batchState.tierProgress.tier2.total}, Tier 3: ${batchState.tierProgress.tier3.processed}/${batchState.tierProgress.tier3.total})`,
              );
            }

            // Rate limiting between analyses (Claude rate limiter enforces its own 2s minDelay)
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error analyzing ${repoData.full_name}:`, error);
            totalFailed++;
          }
        }

        // Small delay between chunks
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Mark batch as completed
      const finalState: any = await this.state.storage.get(`batch:${batchId}`);
      if (finalState) {
        finalState.status = "completed";
        finalState.endTime = Date.now();
        finalState.duration = Date.now() - startTime;
        await this.state.storage.put(`batch:${batchId}`, finalState);
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(
        `Automated batch analysis completed in ${duration}s: ${totalSucceeded} succeeded, ${totalFailed} failed`,
      );
    } catch (error) {
      console.error("Error in automated batch analysis:", error);

      // Mark batch as failed
      await this.state.storage.put(`batch:${batchId}`, {
        batchId,
        type: "automated",
        startTime,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        endTime: Date.now(),
      });
    }
  }

  /**
   * Get repositories that need analysis based on staleness thresholds
   */
  private async getRepositoriesNeedingAnalysis(
    target: "all" | "tier1" | "tier2" | "tier3" = "all",
    force: boolean = false,
  ): Promise<
    Array<{
      id: string;
      full_name: string;
      owner: string;
      name: string;
      tier: number;
      stars: number;
    }>
  > {
    // Build tier conditions based on force mode
    let tierConditions = [];
    if (force) {
      // Force mode: tighter thresholds (1/3/5 days)
      tierConditions = [
        `(rt.tier = 1 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-24 hours')))`,
        `(rt.tier = 2 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-72 hours')))`,
        `(rt.tier = 3 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-120 hours')))`,
      ];
    } else {
      // Normal mode: standard thresholds (3/5/7 days)
      tierConditions = [
        `(rt.tier = 1 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-72 hours')))`,
        `(rt.tier = 2 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-120 hours')))`,
        `(rt.tier = 3 AND (a.created_at IS NULL OR a.created_at < datetime('now', '-168 hours')))`,
      ];
    }

    // Add target filtering
    let targetFilter = "";
    if (target === "tier1") targetFilter = " AND rt.tier = 1";
    if (target === "tier2") targetFilter = " AND rt.tier = 2";
    if (target === "tier3") targetFilter = " AND rt.tier = 3";

    const query = `
      SELECT DISTINCT r.id, r.full_name, r.owner, r.name, rt.tier, r.stars
      FROM repositories r
      JOIN repo_tiers rt ON r.id = rt.repo_id
      LEFT JOIN (
        SELECT repo_id, MAX(created_at) as created_at
        FROM analyses
        GROUP BY repo_id
      ) a ON r.id = a.repo_id
      WHERE r.is_archived = 0 AND r.is_fork = 0
        AND (${tierConditions.join(" OR ")})
        ${targetFilter}
      ORDER BY rt.tier ASC, r.stars DESC
      LIMIT 100
    `;

    const results = await this.env.DB.prepare(query).all();
    return (results.results || []) as any[];
  }

  /**
   * Process Tier 1 repositories (deep scan)
   */
  private async processTier1Repos(): Promise<void> {
    console.log("Processing Tier 1 repositories...");
    const tier1Repos = await this.storageEnhanced.getReposNeedingScan(
      1,
      "deep",
    );
    console.log(`Found ${tier1Repos.length} Tier 1 repos needing scan`);

    // Process in batches to stay within CPU limits
    const BATCH_SIZE = 20;

    for (let i = 0; i < tier1Repos.length; i += BATCH_SIZE) {
      const batch = tier1Repos.slice(i, i + BATCH_SIZE);

      for (const repoId of batch) {
        let repo = await this.storage.getRepository(repoId);
        if (!repo) continue;

        try {
          // Refresh repo data from GitHub API to keep repositories table current
          try {
            const fresh = await this.github.getRepoDetails(
              repo.owner,
              repo.name,
            );
            await this.storage.saveRepository(fresh);
            repo = fresh;
          } catch (err) {
            console.warn(
              `Could not refresh ${repo.full_name}, using cached data`,
            );
          }

          // Check per-metric freshness — only fetch stale metrics from GitHub
          const freshness =
            await this.storageEnhanced.getMetricsFreshness(repoId);

          const [commits, releases, prs, issues, stars, forks] =
            await Promise.all([
              isStale(freshness.commits, 6)
                ? this.githubEnhanced.getCommitActivity(repo.owner, repo.name)
                : null,
              isStale(freshness.releases, 24)
                ? this.githubEnhanced.getReleaseMetrics(repo.owner, repo.name)
                : null,
              isStale(freshness.prs, 12)
                ? this.githubEnhanced.getPullRequestMetrics(
                    repo.owner,
                    repo.name,
                  )
                : null,
              isStale(freshness.issues, 12)
                ? this.githubEnhanced.getIssueMetrics(repo.owner, repo.name)
                : null,
              isStale(freshness.stars, 12)
                ? this.githubEnhanced.getStarHistory(repo.owner, repo.name)
                : null,
              isStale(freshness.forks, 24)
                ? this.githubEnhanced.analyzeForkNetwork(
                    repo.owner,
                    repo.name,
                  )
                : null,
            ]);

          // Save only freshly-fetched metrics (saveMetricsWithRepoId skips undefined)
          await this.saveMetricsWithRepoId(repoId, {
            commits: commits ?? undefined,
            releases: releases ?? undefined,
            prs: prs ?? undefined,
            issues: issues ?? undefined,
            stars: stars ?? undefined,
            forks: forks ?? undefined,
          });

          // Read all metrics from D1 for scoring (includes just-saved + cached)
          const cached =
            await this.storageEnhanced.getComprehensiveMetrics(repoId);

          // Analyze with complete D1 data
          const score = await this.analyzerEnhanced.analyzeWithMetrics(repo, {
            commits: cached.commits,
            releases: cached.releases,
            pullRequests: cached.pullRequests,
            issues: cached.issues,
            stars: cached.stars,
            forks: cached.forks,
          });

          // Update tier based on new score
          const growthVelocity = this.analyzerEnhanced.calculateGrowthVelocity(
            repo.stars,
            cached.stars,
          );
          const engagementScore =
            this.analyzerEnhanced.calculateEngagementScoreForTier({
              forks: repo.forks,
              issues: repo.open_issues,
              prActivity: cached.pullRequests?.total_prs,
              contributors: cached.pullRequests?.unique_contributors,
            });

          await this.storageEnhanced.updateRepoTier(repoId, {
            stars: repo.stars,
            growth_velocity: growthVelocity,
            engagement_score: engagementScore,
          });

          // Mark as scanned
          await this.storageEnhanced.markRepoScanned(repoId, "deep");

          // If high potential, run Claude analysis
          if (this.analyzerEnhanced.isHighPotential(score)) {
            await this.analyzeRepository(repo);
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(
            `Error processing tier 1 repo ${repo.full_name}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Process Tier 2 repositories (basic scan)
   */
  private async processTier2Repos(): Promise<void> {
    console.log("Processing Tier 2 repositories...");
    const tier2Repos = await this.storageEnhanced.getReposNeedingScan(
      2,
      "basic",
    );
    console.log(`Found ${tier2Repos.length} Tier 2 repos needing scan`);

    const BATCH_SIZE = 50;

    for (let i = 0; i < tier2Repos.length; i += BATCH_SIZE) {
      const batch = tier2Repos.slice(i, i + BATCH_SIZE);

      for (const repoId of batch) {
        let repo = await this.storage.getRepository(repoId);
        if (!repo) continue;

        try {
          // Refresh repo data from GitHub API to keep repositories table current
          try {
            const fresh = await this.github.getRepoDetails(
              repo.owner,
              repo.name,
            );
            await this.storage.saveRepository(fresh);
            repo = fresh;
          } catch (err) {
            console.warn(
              `Could not refresh ${repo.full_name}, using cached data`,
            );
          }

          // Check per-metric freshness — only fetch stale metrics
          const freshness =
            await this.storageEnhanced.getMetricsFreshness(repoId);

          const [stars, issues] = await Promise.all([
            isStale(freshness.stars, 12)
              ? this.githubEnhanced.getStarHistory(repo.owner, repo.name, 7)
              : null,
            isStale(freshness.issues, 12)
              ? this.githubEnhanced.getIssueMetrics(repo.owner, repo.name, 7)
              : null,
          ]);

          // Save only freshly-fetched metrics
          if (stars) {
            await this.storageEnhanced.saveStarHistory(
              stars.map((s) => ({ ...s, repo_id: repoId })),
            );
          }
          if (issues) {
            await this.storageEnhanced.saveIssueMetrics({
              ...issues,
              repo_id: repoId,
            });
          }

          // Read from D1 for growth velocity calc (includes just-saved + cached)
          const cached =
            await this.storageEnhanced.getComprehensiveMetrics(repoId);

          // Check for promotion to Tier 1
          const growthVelocity = this.analyzerEnhanced.calculateGrowthVelocity(
            repo.stars,
            cached.stars,
          );
          if (growthVelocity > 10 || repo.stars >= 100) {
            await this.storageEnhanced.updateRepoTier(repoId, {
              stars: repo.stars,
              growth_velocity: growthVelocity,
              engagement_score: 50,
            });
          }

          await this.storageEnhanced.markRepoScanned(repoId, "basic");

          // Lighter rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(
            `Error processing tier 2 repo ${repo.full_name}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Process Tier 3 repositories (minimal scan)
   */
  private async processTier3Repos(): Promise<void> {
    console.log("Processing Tier 3 repositories...");
    const tier3Repos = await this.storageEnhanced.getReposNeedingScan(
      3,
      "basic",
    );
    console.log(`Found ${tier3Repos.length} Tier 3 repos needing scan`);

    // Batch process for efficiency
    const batchSize = 50;
    for (let i = 0; i < tier3Repos.length; i += batchSize) {
      const batch = tier3Repos.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (repoId) => {
          const repo = await this.storage.getRepository(repoId);
          if (!repo) return;

          try {
            // Just update basic metrics
            await this.storage.saveMetrics({
              repo_id: repoId,
              stars: repo.stars,
              forks: repo.forks,
              open_issues: repo.open_issues,
              watchers: repo.stars,
              contributors: Math.ceil(repo.forks * 0.1),
              commits_count: 0,
              recorded_at: new Date().toISOString(),
            });

            // Check for promotion
            if (repo.stars >= 50) {
              await this.storageEnhanced.updateRepoTier(repoId, {
                stars: repo.stars,
                growth_velocity: 0,
                engagement_score: 30,
              });
            }

            await this.storageEnhanced.markRepoScanned(repoId, "basic");
          } catch (error) {
            console.error(
              `Error processing tier 3 repo ${repo.full_name}:`,
              error,
            );
          }
        }),
      );

      // Rate limiting between batches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  /**
   * Helper to save metrics with repo_id
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
      await this.storageEnhanced.saveCommitMetrics(
        metrics.commits.map((c) => ({ ...c, repo_id: repoId })),
      );
    }

    if (metrics.releases) {
      await this.storageEnhanced.saveReleaseMetrics(
        metrics.releases.map((r) => ({ ...r, repo_id: repoId })),
      );
    }

    if (metrics.prs) {
      await this.storageEnhanced.savePullRequestMetrics({
        ...metrics.prs,
        repo_id: repoId,
      });
    }

    if (metrics.issues) {
      await this.storageEnhanced.saveIssueMetrics({
        ...metrics.issues,
        repo_id: repoId,
      });
    }

    if (metrics.stars) {
      await this.storageEnhanced.saveStarHistory(
        metrics.stars.map((s) => ({ ...s, repo_id: repoId })),
      );
    }

    if (metrics.forks) {
      await this.storageEnhanced.saveForkAnalysis({
        ...metrics.forks,
        repo_id: repoId,
      });
    }
  }
}

export default GitHubAgent;
