import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScanOrchestrator } from "./scanner";
import type { ScanDeps } from "./scanner";
import type { Repository } from "../types";

function createMockRepo(overrides: Partial<Repository> = {}): Repository {
  return {
    id: "repo-1",
    name: "test-repo",
    owner: "test-owner",
    full_name: "test-owner/test-repo",
    description: "A test repository",
    stars: 500,
    forks: 100,
    open_issues: 20,
    language: "Python",
    topics: ["ai"],
    created_at: "2023-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    pushed_at: "2024-01-01T00:00:00Z",
    is_archived: false,
    is_fork: false,
    html_url: "https://github.com/test-owner/test-repo",
    clone_url: "https://github.com/test-owner/test-repo.git",
    default_branch: "main",
    ...overrides,
  };
}

function createMockDeps(): { deps: ScanDeps; mocks: Record<string, any> } {
  const mocks = {
    // GitHubEnhancedService
    searchComprehensive: vi.fn().mockResolvedValue([]),
    getCommitActivity: vi.fn().mockResolvedValue([]),
    getReleaseMetrics: vi.fn().mockResolvedValue([]),
    getPullRequestMetrics: vi.fn().mockResolvedValue(null),
    getIssueMetrics: vi.fn().mockResolvedValue(null),
    getStarHistory: vi.fn().mockResolvedValue([]),
    analyzeForkNetwork: vi.fn().mockResolvedValue(null),

    // GitHubService
    getRepoDetails: vi.fn().mockImplementation((owner: string, name: string) =>
      Promise.resolve(createMockRepo({ owner, name, full_name: `${owner}/${name}` })),
    ),

    // StorageService
    getKnownRepoIds: vi.fn().mockResolvedValue([]),
    getRepoIdsWithRecentMetrics: vi.fn().mockResolvedValue([]),
    saveRepository: vi.fn().mockResolvedValue(undefined),
    saveMetrics: vi.fn().mockResolvedValue(undefined),
    getReposWithoutTiers: vi.fn().mockResolvedValue([]),
    getRepository: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(createMockRepo({ id })),
    ),

    // StorageEnhancedService
    updateRepoTier: vi.fn().mockResolvedValue(undefined),
    getReposNeedingScan: vi.fn().mockResolvedValue([]),
    getMetricsFreshness: vi.fn().mockResolvedValue({
      commits: null,
      releases: null,
      prs: null,
      issues: null,
      stars: null,
      forks: null,
    }),
    getComprehensiveMetrics: vi.fn().mockResolvedValue({
      commits: [],
      releases: [],
      pullRequests: null,
      issues: null,
      stars: [],
      forks: null,
      tier: null,
    }),
    markRepoScanned: vi.fn().mockResolvedValue(undefined),
    saveCommitMetrics: vi.fn().mockResolvedValue(undefined),
    saveReleaseMetrics: vi.fn().mockResolvedValue(undefined),
    savePullRequestMetrics: vi.fn().mockResolvedValue(undefined),
    saveIssueMetrics: vi.fn().mockResolvedValue(undefined),
    saveStarHistory: vi.fn().mockResolvedValue(undefined),
    saveForkAnalysis: vi.fn().mockResolvedValue(undefined),

    // RepoAnalyzerEnhanced
    analyzeWithMetrics: vi.fn().mockResolvedValue({ total: 75 }),
    calculateGrowthVelocity: vi.fn().mockReturnValue(5),
    calculateEngagementScoreForTier: vi.fn().mockReturnValue(50),

    // analyzeRepo callback
    analyzeRepo: vi.fn().mockResolvedValue(null),
  };

  const deps: ScanDeps = {
    github: {
      getRepoDetails: mocks.getRepoDetails,
    } as any,
    githubEnhanced: {
      searchComprehensive: mocks.searchComprehensive,
      getCommitActivity: mocks.getCommitActivity,
      getReleaseMetrics: mocks.getReleaseMetrics,
      getPullRequestMetrics: mocks.getPullRequestMetrics,
      getIssueMetrics: mocks.getIssueMetrics,
      getStarHistory: mocks.getStarHistory,
      analyzeForkNetwork: mocks.analyzeForkNetwork,
    } as any,
    storage: {
      getKnownRepoIds: mocks.getKnownRepoIds,
      getRepoIdsWithRecentMetrics: mocks.getRepoIdsWithRecentMetrics,
      saveRepository: mocks.saveRepository,
      saveMetrics: mocks.saveMetrics,
      getReposWithoutTiers: mocks.getReposWithoutTiers,
      getRepository: mocks.getRepository,
    } as any,
    storageEnhanced: {
      updateRepoTier: mocks.updateRepoTier,
      getReposNeedingScan: mocks.getReposNeedingScan,
      getMetricsFreshness: mocks.getMetricsFreshness,
      getComprehensiveMetrics: mocks.getComprehensiveMetrics,
      markRepoScanned: mocks.markRepoScanned,
      saveCommitMetrics: mocks.saveCommitMetrics,
      saveReleaseMetrics: mocks.saveReleaseMetrics,
      savePullRequestMetrics: mocks.savePullRequestMetrics,
      saveIssueMetrics: mocks.saveIssueMetrics,
      saveStarHistory: mocks.saveStarHistory,
      saveForkAnalysis: mocks.saveForkAnalysis,
    } as any,
    analyzerEnhanced: {
      analyzeWithMetrics: mocks.analyzeWithMetrics,
      calculateGrowthVelocity: mocks.calculateGrowthVelocity,
      calculateEngagementScoreForTier: mocks.calculateEngagementScoreForTier,
    } as any,
    analyzeRepo: mocks.analyzeRepo,
  };

  return { deps, mocks };
}

describe("ScanOrchestrator", () => {
  let scanner: ScanOrchestrator;
  let mocks: Record<string, any>;

  beforeEach(() => {
    const created = createMockDeps();
    scanner = new ScanOrchestrator(created.deps);
    mocks = created.mocks;
    vi.clearAllMocks();
  });

  describe("comprehensiveScan", () => {
    it("should discover new repos and assign tiers", async () => {
      const newRepo = createMockRepo({ id: "new-1", full_name: "o/new-1" });
      mocks.searchComprehensive.mockResolvedValue([newRepo]);
      mocks.getKnownRepoIds.mockResolvedValue([]); // none known

      const result = await scanner.comprehensiveScan();

      expect(mocks.saveRepository).toHaveBeenCalledWith(newRepo);
      expect(mocks.saveMetrics).toHaveBeenCalled();
      expect(mocks.updateRepoTier).toHaveBeenCalledWith(
        "new-1",
        expect.objectContaining({ stars: 500 }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          succeeded: 0,
          failed: 0,
        }),
      );
    });

    it("should skip saving metrics for already-known repos", async () => {
      const knownRepo = createMockRepo({ id: "known-1" });
      mocks.searchComprehensive.mockResolvedValue([knownRepo]);
      mocks.getKnownRepoIds.mockResolvedValue(["known-1"]);

      await scanner.comprehensiveScan();

      // saveRepository is called (to update), but saveMetrics is NOT
      expect(mocks.saveRepository).toHaveBeenCalledWith(knownRepo);
      expect(mocks.saveMetrics).not.toHaveBeenCalled();
      // updateRepoTier should NOT be called for known repos during discovery
      expect(mocks.updateRepoTier).not.toHaveBeenCalled();
    });

    it("should return aggregated BatchResult from all tiers", async () => {
      mocks.searchComprehensive.mockResolvedValue([]);

      // Tier 1: 1 repo that succeeds
      mocks.getReposNeedingScan
        .mockResolvedValueOnce(["t1-repo"]) // tier 1
        .mockResolvedValueOnce([]) // tier 2
        .mockResolvedValueOnce([]); // tier 3

      const result = await scanner.comprehensiveScan();

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
    });
  });

  describe("processTier1Repos", () => {
    it("should call analyzeRepo for every Tier 1 repo", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["r1", "r2"]);

      await scanner.processTier1Repos();

      expect(mocks.analyzeRepo).toHaveBeenCalledTimes(2);
      // Each call should pass force=true
      for (const call of mocks.analyzeRepo.mock.calls) {
        expect(call[1]).toBe(true);
      }
    });

    it("should return BatchResult with correct counts when some fail", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["ok", "fail"]);

      let callCount = 0;
      mocks.analyzeRepo.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return Promise.reject(new Error("Claude timeout"));
        return Promise.resolve(null);
      });

      const result = await scanner.processTier1Repos();

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Claude timeout");
    });

    it("should not abort batch when individual repo fails", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["fail", "ok1", "ok2"]);

      let callCount = 0;
      mocks.analyzeRepo.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.reject(new Error("transient"));
        return Promise.resolve(null);
      });

      const result = await scanner.processTier1Repos();

      // All 3 repos were attempted
      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
    });

    it("should mark repos as deep-scanned", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["r1"]);

      await scanner.processTier1Repos();

      expect(mocks.markRepoScanned).toHaveBeenCalledWith("r1", "deep");
    });
  });

  describe("processTier2Repos", () => {
    it("should promote repos when stars >= 100", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["promoted"]);
      const promoRepo = createMockRepo({ id: "promoted", stars: 150 });
      mocks.getRepository.mockResolvedValue(promoRepo);
      // getRepoDetails refreshes the repo — return the same data
      mocks.getRepoDetails.mockResolvedValue(promoRepo);
      mocks.calculateGrowthVelocity.mockReturnValue(3); // below 10

      const result = await scanner.processTier2Repos();

      expect(result.succeeded).toBe(1);
      expect(mocks.updateRepoTier).toHaveBeenCalledWith(
        "promoted",
        expect.objectContaining({ stars: 150 }),
      );
    });

    it("should promote repos when growth velocity > 10", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["fast"]);
      mocks.getRepository.mockResolvedValue(
        createMockRepo({ id: "fast", stars: 80 }),
      );
      mocks.calculateGrowthVelocity.mockReturnValue(15);

      await scanner.processTier2Repos();

      expect(mocks.updateRepoTier).toHaveBeenCalledWith(
        "fast",
        expect.objectContaining({ growth_velocity: 15 }),
      );
    });

    it("should mark repos as basic-scanned", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["r1"]);

      await scanner.processTier2Repos();

      expect(mocks.markRepoScanned).toHaveBeenCalledWith("r1", "basic");
    });

    it("should collect errors without aborting", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["bad", "good"]);

      let callIdx = 0;
      mocks.getRepository.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) {
          return Promise.resolve(createMockRepo({ id: "bad" }));
        }
        return Promise.resolve(createMockRepo({ id: "good" }));
      });

      // Make getMetricsFreshness fail for first call
      let freshnessCallIdx = 0;
      mocks.getMetricsFreshness.mockImplementation(() => {
        freshnessCallIdx++;
        if (freshnessCallIdx === 1) return Promise.reject(new Error("D1 error"));
        return Promise.resolve({ stars: null, issues: null });
      });

      const result = await scanner.processTier2Repos();

      expect(result.failed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.errors[0].error).toContain("D1 error");
    });
  });

  describe("processTier3Repos", () => {
    it("should promote repos when stars >= 50", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["rising"]);
      mocks.getRepository.mockResolvedValue(
        createMockRepo({ id: "rising", stars: 55 }),
      );

      await scanner.processTier3Repos();

      expect(mocks.updateRepoTier).toHaveBeenCalledWith(
        "rising",
        expect.objectContaining({ stars: 55 }),
      );
    });

    it("should not promote repos with stars < 50", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["small"]);
      mocks.getRepository.mockResolvedValue(
        createMockRepo({ id: "small", stars: 30 }),
      );

      await scanner.processTier3Repos();

      expect(mocks.updateRepoTier).not.toHaveBeenCalled();
    });

    it("should collect errors in BatchResult", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["err"]);
      mocks.getRepository.mockResolvedValue(
        createMockRepo({ id: "err" }),
      );
      mocks.saveMetrics.mockRejectedValue(new Error("write failed"));

      const result = await scanner.processTier3Repos();

      expect(result.failed).toBe(1);
      expect(result.errors[0].error).toContain("write failed");
    });

    it("should mark repos as basic-scanned", async () => {
      mocks.getReposNeedingScan.mockResolvedValue(["r1"]);

      await scanner.processTier3Repos();

      expect(mocks.markRepoScanned).toHaveBeenCalledWith("r1", "basic");
    });
  });
});
