import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalysisOrchestrator } from "./analyzer";
import type { AnalysisDeps, BatchState } from "./analyzer";
import type { Repository, Analysis, Score } from "../types";

const mockRepo: Repository = {
  id: "test-123",
  name: "test-repo",
  owner: "test-owner",
  full_name: "test-owner/test-repo",
  description: "A test repository",
  stars: 1000,
  forks: 200,
  open_issues: 50,
  language: "TypeScript",
  topics: ["ai", "ml"],
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  pushed_at: "2024-01-01T00:00:00Z",
  is_archived: false,
  is_fork: false,
  html_url: "https://github.com/test-owner/test-repo",
  clone_url: "https://github.com/test-owner/test-repo.git",
  default_branch: "main",
};

const highScore: Score = {
  total: 80,
  growth: 85,
  engagement: 75,
  quality: 78,
  factors: {},
};

const lowScore: Score = {
  total: 40,
  growth: 35,
  engagement: 45,
  quality: 42,
  factors: {},
};

const mockAnalysis: Analysis = {
  repo_id: "test-123",
  scores: { investment: 82, innovation: 78, team: 75, market: 80 },
  recommendation: "buy",
  summary: "Strong project",
  strengths: ["Good architecture"],
  risks: ["Small team"],
  questions: ["Funding plans?"],
  metadata: {
    model: "claude-sonnet-4-6",
    cost: 0.001,
    timestamp: new Date().toISOString(),
  },
};

function createMockDeps(): {
  deps: AnalysisDeps;
  mocks: Record<string, any>;
} {
  const mocks = {
    analyze: vi.fn().mockResolvedValue(highScore),
    isHighPotential: vi.fn().mockReturnValue(true),
    getRecommendedModel: vi.fn().mockReturnValue("claude-sonnet-4-6"),
    getReadmeContent: vi.fn().mockResolvedValue("# Test README"),
    analyzeRepository: vi.fn().mockResolvedValue(mockAnalysis),
    saveAnalysis: vi.fn().mockResolvedValue(undefined),
    saveAlert: vi.fn().mockResolvedValue(undefined),
    getContributors: vi.fn().mockResolvedValue([]),
    saveContributors: vi.fn().mockResolvedValue(undefined),
    getLatestAnalysis: vi.fn().mockResolvedValue(mockAnalysis),
    getRepository: vi.fn().mockResolvedValue(mockRepo),
    getReposNeedingAnalysis: vi.fn().mockResolvedValue([]),
    saveBatchState: vi.fn().mockResolvedValue(undefined),
  };

  const deps: AnalysisDeps = {
    github: {
      getReadmeContent: mocks.getReadmeContent,
      getContributors: mocks.getContributors,
    } as any,
    claude: {
      analyzeRepository: mocks.analyzeRepository,
    } as any,
    storage: {
      saveAnalysis: mocks.saveAnalysis,
      saveAlert: mocks.saveAlert,
      saveContributors: mocks.saveContributors,
      getLatestAnalysis: mocks.getLatestAnalysis,
      getRepository: mocks.getRepository,
    } as any,
    storageEnhanced: {
      getReposNeedingAnalysis: mocks.getReposNeedingAnalysis,
    } as any,
    analyzer: {
      analyze: mocks.analyze,
      isHighPotential: mocks.isHighPotential,
      getRecommendedModel: mocks.getRecommendedModel,
    } as any,
    saveBatchState: mocks.saveBatchState,
  };

  return { deps, mocks };
}

describe("AnalysisOrchestrator", () => {
  let orchestrator: AnalysisOrchestrator;
  let mocks: Record<string, any>;

  beforeEach(() => {
    const created = createMockDeps();
    orchestrator = new AnalysisOrchestrator(created.deps);
    mocks = created.mocks;
    vi.clearAllMocks();
  });

  describe("analyzeRepository", () => {
    it("should skip analysis when score below threshold and force=false", async () => {
      mocks.analyze.mockResolvedValue(lowScore);
      mocks.isHighPotential.mockReturnValue(false);

      const result = await orchestrator.analyzeRepository(mockRepo, false);

      expect(result).toBeNull();
      expect(mocks.analyzeRepository).not.toHaveBeenCalled();
    });

    it("should proceed when force=true regardless of score", async () => {
      mocks.analyze.mockResolvedValue(lowScore);
      mocks.isHighPotential.mockReturnValue(false);

      // Lower investment score so no alert is triggered
      const lowAnalysis = {
        ...mockAnalysis,
        scores: { ...mockAnalysis.scores, investment: 50 },
      };
      mocks.analyzeRepository.mockResolvedValue(lowAnalysis);

      const result = await orchestrator.analyzeRepository(mockRepo, true);

      expect(result).not.toBeNull();
      expect(mocks.getReadmeContent).toHaveBeenCalled();
      expect(mocks.analyzeRepository).toHaveBeenCalled();
      expect(mocks.saveAnalysis).toHaveBeenCalled();
    });

    it("should save alert when investment_score >= 80", async () => {
      // mockAnalysis has investment: 82
      await orchestrator.analyzeRepository(mockRepo);

      expect(mocks.saveAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "investment_opportunity",
          level: "high",
        }),
      );
    });

    it("should save urgent alert when investment_score >= 90", async () => {
      const urgentAnalysis = {
        ...mockAnalysis,
        scores: { ...mockAnalysis.scores, investment: 92 },
      };
      mocks.analyzeRepository.mockResolvedValue(urgentAnalysis);

      await orchestrator.analyzeRepository(mockRepo);

      expect(mocks.saveAlert).toHaveBeenCalledWith(
        expect.objectContaining({ level: "urgent" }),
      );
    });

    it("should not save alert when investment_score < 80 and growth < 90", async () => {
      const lowInvestmentAnalysis = {
        ...mockAnalysis,
        scores: { ...mockAnalysis.scores, investment: 65 },
      };
      mocks.analyzeRepository.mockResolvedValue(lowInvestmentAnalysis);
      mocks.analyze.mockResolvedValue({ ...highScore, growth: 50 });

      await orchestrator.analyzeRepository(mockRepo);

      expect(mocks.saveAlert).not.toHaveBeenCalled();
    });

    it("should fetch contributors when investment_score >= 70", async () => {
      const analysis = {
        ...mockAnalysis,
        scores: { ...mockAnalysis.scores, investment: 75 },
      };
      mocks.analyzeRepository.mockResolvedValue(analysis);
      // growth < 90 so no alert
      mocks.analyze.mockResolvedValue({ ...highScore, growth: 50 });

      await orchestrator.analyzeRepository(mockRepo);

      expect(mocks.getContributors).toHaveBeenCalledWith(
        "test-owner",
        "test-repo",
      );
      expect(mocks.saveContributors).toHaveBeenCalled();
    });

    it("should not fetch contributors when investment_score < 70", async () => {
      const analysis = {
        ...mockAnalysis,
        scores: { ...mockAnalysis.scores, investment: 60 },
      };
      mocks.analyzeRepository.mockResolvedValue(analysis);
      mocks.analyze.mockResolvedValue({ ...highScore, growth: 50 });

      await orchestrator.analyzeRepository(mockRepo);

      expect(mocks.getContributors).not.toHaveBeenCalled();
    });
  });

  describe("runBatch", () => {
    it("should handle empty repository list", async () => {
      mocks.getReposNeedingAnalysis.mockResolvedValue([]);

      const result = await orchestrator.runBatch();

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(mocks.saveBatchState).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: "completed", reason: "No stale repositories found" }),
      );
    });

    it("should process repos and return accurate counts", async () => {
      mocks.getReposNeedingAnalysis.mockResolvedValue([
        { id: "r1", full_name: "o/r1", owner: "o", name: "r1", tier: 1, stars: 500 },
        { id: "r2", full_name: "o/r2", owner: "o", name: "r2", tier: 2, stars: 200 },
      ]);

      const result = await orchestrator.runBatch();

      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should continue processing after individual repo failure", async () => {
      mocks.getReposNeedingAnalysis.mockResolvedValue([
        { id: "r1", full_name: "o/r1", owner: "o", name: "r1", tier: 1, stars: 500 },
        { id: "r2", full_name: "o/r2", owner: "o", name: "r2", tier: 1, stars: 300 },
      ]);

      // First repo fails, second succeeds
      let callCount = 0;
      mocks.getRepository.mockImplementation((id: string) => {
        callCount++;
        if (id === "r1") return Promise.resolve(mockRepo);
        return Promise.resolve({ ...mockRepo, id: "r2", full_name: "o/r2" });
      });

      // Make analysis throw for the first repo
      const originalAnalyze = mocks.analyze;
      let analyzeCallCount = 0;
      mocks.analyze.mockImplementation(() => {
        analyzeCallCount++;
        if (analyzeCallCount === 1) return Promise.reject(new Error("API timeout"));
        return Promise.resolve(highScore);
      });

      const result = await orchestrator.runBatch();

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe("r1");
      expect(result.errors[0].error).toContain("API timeout");
    });

    it("should call saveBatchState with correct lifecycle", async () => {
      mocks.getReposNeedingAnalysis.mockResolvedValue([
        { id: "r1", full_name: "o/r1", owner: "o", name: "r1", tier: 1, stars: 500 },
      ]);

      await orchestrator.runBatch();

      // Should have been called with "active" status initially, then "completed"
      const calls = mocks.saveBatchState.mock.calls;
      const statuses = calls.map(
        (c: any[]) => (c[1] as BatchState).status,
      );
      expect(statuses[0]).toBe("active");
      expect(statuses[statuses.length - 1]).toBe("completed");
    });

    it("should include errors in completed batch state", async () => {
      mocks.getReposNeedingAnalysis.mockResolvedValue([
        { id: "r1", full_name: "o/r1", owner: "o", name: "r1", tier: 1, stars: 500 },
        { id: "r2", full_name: "o/r2", owner: "o", name: "r2", tier: 1, stars: 300 },
      ]);

      // Make first repo fail
      let analyzeCallCount = 0;
      mocks.analyze.mockImplementation(() => {
        analyzeCallCount++;
        if (analyzeCallCount === 1) return Promise.reject(new Error("timeout"));
        return Promise.resolve(highScore);
      });

      await orchestrator.runBatch();

      // Find the final saveBatchState call (completed status)
      const completedCall = mocks.saveBatchState.mock.calls.find(
        (c: any[]) => (c[1] as BatchState).status === "completed",
      );
      expect(completedCall).toBeDefined();
      const finalState = completedCall![1] as BatchState;
      expect(finalState.errors).toBeDefined();
      expect(finalState.errors!.length).toBe(1);
      expect(finalState.errors![0].id).toBe("r1");
      expect(finalState.errors![0].error).toContain("timeout");
    });

    it("should track repo not found as failure", async () => {
      mocks.getReposNeedingAnalysis.mockResolvedValue([
        { id: "gone", full_name: "o/gone", owner: "o", name: "gone", tier: 1, stars: 100 },
      ]);
      mocks.getRepository.mockResolvedValue(null);

      const result = await orchestrator.runBatch();

      expect(result.failed).toBe(1);
      expect(result.errors[0]).toEqual(
        expect.objectContaining({ id: "gone", error: "Repository not found in database" }),
      );
    });
  });
});
