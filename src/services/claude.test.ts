import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ClaudeService,
  AnalysisRefusedError,
  AnalysisTruncatedError,
  AnalysisInvalidError,
  classifyAnalysisError,
} from "./claude";
import type { Repository, Env } from "../types";
import {
  VALID_ANALYSIS,
  messageResponse,
  errorResponse,
  requestAt,
} from "../test/anthropicMock";

// The real limiter would make tests wait between calls
vi.mock("../utils/rateLimiter", () => ({
  claudeRateLimiter: { acquire: vi.fn().mockResolvedValue(undefined) },
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const repo: Repository = {
  id: "test-123",
  name: "test-repo",
  owner: "test-owner",
  full_name: "test-owner/test-repo",
  description: "A test repository",
  stars: 1000,
  forks: 200,
  open_issues: 50,
  language: "TypeScript",
  topics: ["ai", "ml", "test"],
  created_at: "2023-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  pushed_at: "2024-01-01T00:00:00Z",
  is_archived: false,
  is_fork: false,
  html_url: "https://github.com/test-owner/test-repo",
  clone_url: "https://github.com/test-owner/test-repo.git",
  default_branch: "main",
};

const readme = "# Test Repository\n\nThis is a test repository for AI/ML.";

describe("ClaudeService", () => {
  let service: ClaudeService;

  beforeEach(() => {
    mockFetch.mockReset();
    const env: Env = {
      DB: {} as any,
      STORAGE: {} as any,
      GITHUB_AGENT: {} as any,
      GITHUB_TOKEN: "test-github-token",
      ANTHROPIC_API_KEY: "test-anthropic-key",
    };
    service = new ClaudeService(env);
  });

  describe("successful analysis", () => {
    it("maps the structured output to an Analysis, reading the text block by type", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({ model: "claude-opus-5-5" }),
      );

      const analysis = await service.analyzeRepository(
        repo,
        readme,
        "claude-opus-5-5",
      );

      expect(analysis.repo_id).toBe("test-123");
      expect(analysis.scores).toEqual(VALID_ANALYSIS.scores);
      expect(analysis.recommendation).toBe("buy");
      expect(analysis.questions).toEqual(VALID_ANALYSIS.questions);
      expect(analysis.growth_prediction).toBe(VALID_ANALYSIS.growth_prediction);
      expect(analysis.investment_thesis).toBe(VALID_ANALYSIS.investment_thesis);
      expect(analysis.competitive_analysis).toBe(
        VALID_ANALYSIS.competitive_analysis,
      );
      expect(analysis.metadata.model).toBe("claude-opus-5-5");
    });

    it("computes cost from actual token usage", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({
          model: "claude-opus-5-5",
          inputTokens: 2000,
          outputTokens: 800,
        }),
      );

      const analysis = await service.analyzeRepository(
        repo,
        readme,
        "claude-opus-5-5",
      );

      // Opus 5.5: $4 / $20 per MTok
      expect(analysis.metadata.cost).toBeCloseTo(
        (2000 * 4 + 800 * 20) / 1_000_000,
        10,
      );
      expect(analysis.metadata.input_tokens).toBe(2000);
      expect(analysis.metadata.output_tokens).toBe(800);
    });

    it("clamps scores into 0-100 and drops an empty investment thesis", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({
          text: JSON.stringify({
            ...VALID_ANALYSIS,
            scores: { ...VALID_ANALYSIS.scores, investment: 105, team: -3 },
            recommendation: "watch",
            investment_thesis: "",
          }),
        }),
      );

      const analysis = await service.analyzeRepository(repo, readme);

      expect(analysis.scores.investment).toBe(100);
      expect(analysis.scores.team).toBe(0);
      expect(analysis.investment_thesis).toBeUndefined();
    });
  });

  describe("request shape", () => {
    it("sends structured output, effort and no temperature", async () => {
      mockFetch.mockResolvedValueOnce(messageResponse());

      await service.analyzeRepository(repo, readme, "claude-sonnet-5-5");

      const { body } = requestAt(mockFetch, 0);
      expect(body.model).toBe("claude-sonnet-5-5");
      expect(body.max_tokens).toBe(16000);
      expect(body).not.toHaveProperty("temperature");
      expect(body.output_config.effort).toBe("medium");
      expect(body.output_config.format.type).toBe("json_schema");
      expect(body.output_config.format.schema.additionalProperties).toBe(false);
      expect(body.system).toContain("Scoring Guidelines");
      expect(body.messages[0].content).toContain("test-owner/test-repo");
      expect(body.messages[0].content).toContain(`<readme>\n${readme}\n</readme>`);
    });

    it("truncates the README to 10,000 characters", async () => {
      mockFetch.mockResolvedValueOnce(messageResponse());

      await service.analyzeRepository(repo, "x".repeat(12000));

      const content: string = requestAt(mockFetch, 0).body.messages[0].content;
      expect(content).toContain(`${"x".repeat(10000)}...\n</readme>`);
      expect(content).not.toContain("x".repeat(10001));
    });

    it.each(["claude-opus-5-5", "claude-sonnet-5-5"] as const)(
      "opts %s into server-side refusal fallback",
      async (model) => {
        mockFetch.mockResolvedValueOnce(messageResponse({ model }));

        await service.analyzeRepository(repo, readme, model);

        const { body, headers } = requestAt(mockFetch, 0);
        expect(body.fallbacks).toBe("default");
        expect(headers.get("anthropic-beta")).toContain(
          "server-side-fallback-2026-07-01",
        );
      },
    );

    it("does not send fallbacks for Haiku, which has no server-side fallback", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({ model: "claude-haiku-5-5" }),
      );

      await service.analyzeRepository(repo, readme, "claude-haiku-5-5");

      const { body, headers } = requestAt(mockFetch, 0);
      expect(body).not.toHaveProperty("fallbacks");
      expect(body.output_config.effort).toBe("low");
      expect(headers.get("anthropic-beta") ?? "").not.toContain(
        "server-side-fallback",
      );
    });
  });

  describe("failures", () => {
    it("throws AnalysisRefusedError on a refusal", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({
          model: "claude-opus-5-5",
          stopReason: "refusal",
          stopDetails: { category: "cyber", explanation: null },
        }),
      );

      const error = await service
        .analyzeRepository(repo, readme, "claude-opus-5-5")
        .catch((e) => e);

      expect(error).toBeInstanceOf(AnalysisRefusedError);
      expect(error.category).toBe("cyber");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries a refused Haiku analysis once on Sonnet", async () => {
      mockFetch
        .mockResolvedValueOnce(
          messageResponse({
            model: "claude-haiku-5-5",
            stopReason: "refusal",
            stopDetails: { category: "general_harms", explanation: null },
          }),
        )
        .mockResolvedValueOnce(messageResponse({ model: "claude-sonnet-5-5" }));

      const analysis = await service.analyzeRepository(
        repo,
        readme,
        "claude-haiku-5-5",
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(requestAt(mockFetch, 1).body.model).toBe("claude-sonnet-5-5");
      expect(analysis.metadata.model).toBe("claude-sonnet-5-5");
    });

    it("throws AnalysisTruncatedError when output hits max_tokens", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({ stopReason: "max_tokens", text: '{"scores": {' }),
      );

      await expect(service.analyzeRepository(repo, readme)).rejects.toBeInstanceOf(
        AnalysisTruncatedError,
      );
    });

    it("throws AnalysisInvalidError when the output doesn't match the schema", async () => {
      mockFetch.mockResolvedValueOnce(
        messageResponse({ text: JSON.stringify({ scores: {} }) }),
      );

      await expect(service.analyzeRepository(repo, readme)).rejects.toBeInstanceOf(
        AnalysisInvalidError,
      );
    });

    it("retries a 429 and then succeeds", async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(429, "rate limited"))
        .mockResolvedValueOnce(messageResponse());

      const analysis = await service.analyzeRepository(repo, readme);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(analysis.scores.investment).toBe(82);
    });

    it("does not retry a 400", async () => {
      mockFetch.mockImplementation(async () => errorResponse(400, "bad request"));

      const error = await service.analyzeRepository(repo, readme).catch((e) => e);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(classifyAnalysisError(error)).toEqual({
        reason: "invalid_request",
        persistent: true,
      });
    });
  });

  describe("classifyAnalysisError", () => {
    it("treats refusals, truncation and invalid output as persistent", () => {
      expect(classifyAnalysisError(new AnalysisRefusedError("bio"))).toEqual({
        reason: "refused:bio",
        persistent: true,
      });
      expect(classifyAnalysisError(new AnalysisTruncatedError())).toEqual({
        reason: "truncated",
        persistent: true,
      });
      expect(
        classifyAnalysisError(new AnalysisInvalidError("x")).persistent,
      ).toBe(true);
    });

    it("treats exhausted 5xx retries as transient", async () => {
      mockFetch.mockImplementation(async () => errorResponse(529, "overloaded"));

      const error = await service.analyzeRepository(repo, readme).catch((e) => e);

      expect(classifyAnalysisError(error)).toEqual({
        reason: "api_error:529",
        persistent: false,
      });
    });

    it("treats unknown errors as transient", () => {
      expect(classifyAnalysisError(new Error("network down"))).toEqual({
        reason: "network down",
        persistent: false,
      });
    });
  });
});
