import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeService } from "../services/claude";
import { RepoAnalyzer } from "../analyzers/repoAnalyzer";
import type { Repository, Env } from "../types";
import { messageResponse, requestAt } from "../test/anthropicMock";

vi.mock("../utils/rateLimiter", () => ({
  claudeRateLimiter: { acquire: vi.fn().mockResolvedValue(undefined) },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function makeRepo(overrides: Partial<Repository>): Repository {
  return {
    id: "repo",
    name: "repo",
    owner: "owner",
    full_name: "owner/repo",
    description: "A repository",
    stars: 100,
    forks: 10,
    open_issues: 5,
    language: "Python",
    topics: [],
    created_at: daysAgo(180),
    updated_at: daysAgo(7),
    pushed_at: daysAgo(7),
    is_archived: false,
    is_fork: false,
    html_url: "https://github.com/owner/repo",
    clone_url: "https://github.com/owner/repo.git",
    default_branch: "main",
    ...overrides,
  };
}

const highScoringRepo = makeRepo({
  id: "langchain-123",
  full_name: "langchain-ai/langchain",
  description: "Building applications with LLMs through composability",
  stars: 50000,
  forks: 10000,
  open_issues: 500,
  topics: ["ai", "llm", "agents", "machine-learning", "artificial-intelligence"],
  created_at: daysAgo(365),
  updated_at: daysAgo(1),
  pushed_at: daysAgo(1),
});

const mediumScoringRepo = makeRepo({
  id: "ai-tool-456",
  full_name: "startup-ai/ai-assistant",
  description: "An AI-powered coding assistant",
  stars: 400,
  forks: 50,
  open_issues: 20,
  language: "TypeScript",
  topics: ["ai"],
});

const lowScoringRepo = makeRepo({
  id: "small-project-789",
  full_name: "individual-dev/ml-experiment",
  description: "Personal ML experiments",
  stars: 30,
  forks: 2,
  open_issues: 1,
  created_at: daysAgo(30),
  updated_at: daysAgo(14),
  pushed_at: daysAgo(14),
});

const rapidGrowthRepo = makeRepo({
  id: "rapid-growth",
  full_name: "hot-startup/new-ai-framework",
  description: "Revolutionary AI framework",
  stars: 3000,
  forks: 600,
  open_issues: 100,
  topics: ["ai", "llm", "agents"],
  created_at: daysAgo(30),
  updated_at: daysAgo(1),
  pushed_at: daysAgo(1),
});

describe("Claude analysis integration", () => {
  let claudeService: ClaudeService;
  let repoAnalyzer: RepoAnalyzer;

  beforeEach(() => {
    mockFetch.mockReset();
    const env: Env = {
      DB: {} as any,
      STORAGE: {} as any,
      GITHUB_AGENT: {} as any,
      GITHUB_TOKEN: "test-github-token",
      ANTHROPIC_API_KEY: "test-anthropic-key",
    };
    claudeService = new ClaudeService(env);
    repoAnalyzer = new RepoAnalyzer(env);
  });

  it.each([
    ["high-scoring", highScoringRepo, "claude-sonnet-5-5", "medium"],
    ["medium-scoring", mediumScoringRepo, "claude-sonnet-5-5", "medium"],
    ["low-scoring", lowScoringRepo, "claude-haiku-5-5", "low"],
  ] as const)(
    "analyzes a %s repository with the tier's model and effort",
    async (_label, repo, expectedModel, expectedEffort) => {
      const score = await repoAnalyzer.analyze(repo);
      const model = repoAnalyzer.getRecommendedModel(score);
      expect(model).toBe(expectedModel);

      mockFetch.mockResolvedValueOnce(messageResponse({ model }));
      const analysis = await claudeService.analyzeRepository(
        repo,
        "# README",
        model,
      );

      const { body } = requestAt(mockFetch, 0);
      expect(body.model).toBe(expectedModel);
      expect(body.output_config.effort).toBe(expectedEffort);
      expect(analysis.repo_id).toBe(repo.id);
      expect(analysis.metadata.model).toBe(expectedModel);
      expect(analysis.metadata.cost).toBeGreaterThan(0);
    },
  );

  it("records the fallback model when a refusal is served by another model", async () => {
    mockFetch.mockResolvedValueOnce(messageResponse({ model: "claude-sonnet-5" }));

    const analysis = await claudeService.analyzeRepository(
      highScoringRepo,
      "# README",
      "claude-sonnet-5-5",
    );

    expect(analysis.metadata.model).toBe("claude-sonnet-5");
  });

  it("uses the high-tier model for high growth even with a lower total score", async () => {
    const score = await repoAnalyzer.analyze(rapidGrowthRepo);

    expect(score.growth).toBeGreaterThanOrEqual(80);
    expect(repoAnalyzer.getRecommendedModel(score)).toBe("claude-sonnet-5-5");
  });
});
