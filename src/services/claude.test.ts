import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeService } from "./claude";
import type { Repository, Env } from "../types";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("ClaudeService", () => {
  let service: ClaudeService;
  let mockEnv: Env;

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

  const mockReadme =
    "# Test Repository\n\nThis is a test repository for AI/ML projects.";

  beforeEach(() => {
    mockEnv = {
      DB: {} as any,
      STORAGE: {} as any,
      GITHUB_AGENT: {} as any,
      GITHUB_TOKEN: "test-github-token",
      ANTHROPIC_API_KEY: "test-anthropic-key",
    };
    service = new ClaudeService(mockEnv);
    vi.clearAllMocks();
  });

  describe("isClaudeV4Model", () => {
    it("should identify Claude 4 models correctly", () => {
      // Access private method through any type casting for testing
      const serviceAny = service as any;

      expect(serviceAny.isClaudeV4Model("claude-opus-4-6")).toBe(true);
      expect(serviceAny.isClaudeV4Model("claude-sonnet-4-6")).toBe(true);
      expect(serviceAny.isClaudeV4Model("claude-haiku-4-5-20251001")).toBe(
        true,
      );
    });
  });

  describe("getMaxTokensForModel", () => {
    it("should return correct token limits for each model type", () => {
      const serviceAny = service as any;

      expect(serviceAny.getMaxTokensForModel("claude-opus-4-6")).toBe(8192);
      expect(serviceAny.getMaxTokensForModel("claude-sonnet-4-6")).toBe(8192);
      expect(
        serviceAny.getMaxTokensForModel("claude-haiku-4-5-20251001"),
      ).toBe(8192);
    });
  });

  describe("estimateCost", () => {
    it("should calculate correct costs for each model", () => {
      const serviceAny = service as any;
      const responseLength = 4000; // ~1000 tokens

      // Test Claude 4.6 models
      expect(
        serviceAny.estimateCost("claude-opus-4-6", responseLength),
      ).toBeCloseTo(0.005, 3);
      expect(
        serviceAny.estimateCost("claude-sonnet-4-6", responseLength),
      ).toBeCloseTo(0.003, 3);

      // Test Haiku
      expect(
        serviceAny.estimateCost("claude-haiku-4-5-20251001", responseLength),
      ).toBeCloseTo(0.001, 3);
    });
  });

  describe("analyzeRepository", () => {
    it("should analyze repository with claude-opus-4-6 model", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              scores: {
                investment: 85,
                innovation: 90,
                team: 80,
                market: 88,
                technical_moat: 92,
                scalability: 87,
                developer_adoption: 85,
              },
              recommendation: "strong-buy",
              summary: "Excellent AI/ML project with strong potential.",
              strengths: ["Strong team", "Innovative approach"],
              risks: ["Market competition"],
              questions: ["What is the monetization strategy?"],
              growth_prediction: "Expected 10x growth in 12 months",
              investment_thesis: "Strong technical moat and growing adoption",
              competitive_analysis: "Leading position in the market",
            }),
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 500 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.analyzeRepository(
        mockRepo,
        mockReadme,
        "claude-opus-4-6",
      );

      expect(result.scores.investment).toBe(85);
      expect(result.scores.technical_moat).toBe(92);
      expect(result.recommendation).toBe("strong-buy");
      expect(result.growth_prediction).toBe("Expected 10x growth in 12 months");
      expect(result.metadata.model).toBe("claude-opus-4-6");

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "x-api-key": "test-anthropic-key",
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining("claude-opus-4-6"),
        }),
      );
    });

    it("should analyze repository with claude-sonnet-4-6 model", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              scores: {
                investment: 70,
                innovation: 75,
                team: 65,
                market: 72,
                technical_moat: 68,
                scalability: 70,
                developer_adoption: 66,
              },
              recommendation: "buy",
              summary: "Solid AI project with good potential.",
              strengths: ["Good technology"],
              risks: ["Needs more adoption"],
              questions: ["How will you scale?"],
              growth_prediction: "Steady growth expected",
              investment_thesis: "Worth watching",
              competitive_analysis: "Competitive market",
            }),
          },
        ],
        usage: { input_tokens: 800, output_tokens: 400 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.analyzeRepository(
        mockRepo,
        mockReadme,
        "claude-sonnet-4-6",
      );

      expect(result.scores.investment).toBe(70);
      expect(result.recommendation).toBe("buy");
      expect(result.metadata.model).toBe("claude-sonnet-4-6");
    });

    it("should handle API errors gracefully", async () => {
      // Mock the rate limiter to allow the request
      vi.mock("../utils/rateLimiter", () => ({
        claudeRateLimiter: {
          checkLimit: vi.fn().mockResolvedValue(true),
          getWaitTime: vi.fn().mockReturnValue(0),
        },
        withExponentialBackoff: vi.fn((fn) => fn()),
      }));

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "Rate limit exceeded",
      });

      await expect(
        service.analyzeRepository(
          mockRepo,
          mockReadme,
          "claude-opus-4-6",
        ),
      ).rejects.toThrow("Claude API rate limit: 429");
    }, 10000);

    it("should use enhanced prompt for V4 models", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              scores: { investment: 80, innovation: 80, team: 80, market: 80 },
              recommendation: "buy",
              summary: "Good project",
              strengths: [],
              risks: [],
              questions: [],
            }),
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await service.analyzeRepository(
        mockRepo,
        mockReadme,
        "claude-opus-4-6",
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const prompt = callBody.messages[0].content;

      // Enhanced prompt should include these elements
      expect(prompt).toContain("senior venture capital partner");
      expect(prompt).toContain("technical_moat");
      expect(prompt).toContain("scalability");
      expect(prompt).toContain("growth_prediction");
      expect(prompt).toContain("10000"); // The actual limit used in the code
    }, 10000);

    it("should use enhanced prompt for Haiku model too", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              scores: { investment: 60, innovation: 60, team: 60, market: 60 },
              recommendation: "watch",
              summary: "Decent project",
              strengths: [],
              risks: [],
              questions: [],
            }),
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await service.analyzeRepository(
        mockRepo,
        mockReadme,
        "claude-haiku-4-5-20251001",
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const prompt = callBody.messages[0].content;

      // All current models use the enhanced prompt
      expect(prompt).toContain("senior venture capital partner");
      expect(prompt).toContain("technical_moat");
    }, 10000);
  });

  describe("parseResponse", () => {
    it("should handle malformed JSON gracefully", async () => {
      // Mock the rate limiter to allow the request
      vi.mock("../utils/rateLimiter", () => ({
        claudeRateLimiter: {
          checkLimit: vi.fn().mockResolvedValue(true),
          getWaitTime: vi.fn().mockReturnValue(0),
        },
        withExponentialBackoff: vi.fn((fn) => fn()),
      }));

      const mockResponse = {
        content: [
          {
            type: "text",
            text: "This is not JSON",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.analyzeRepository(
        mockRepo,
        mockReadme,
        "claude-opus-4-6",
      );
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.error).toBe("No valid JSON in Claude response");
    }, 10000);

    it("should extract JSON from response with extra text", async () => {
      // Mock the rate limiter to allow the request
      vi.mock("../utils/rateLimiter", () => ({
        claudeRateLimiter: {
          checkLimit: vi.fn().mockResolvedValue(true),
          getWaitTime: vi.fn().mockReturnValue(0),
        },
        withExponentialBackoff: vi.fn((fn) => fn()),
      }));

      const mockResponse = {
        content: [
          {
            type: "text",
            text: `Here's the analysis:
          {
            "scores": {
              "investment": 75,
              "innovation": 80,
              "team": 70,
              "market": 78
            },
            "recommendation": "buy",
            "summary": "Good project",
            "strengths": ["Strong tech"],
            "risks": ["Competition"],
            "questions": ["Scaling plan?"]
          }
          That's my assessment.`,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.analyzeRepository(
        mockRepo,
        mockReadme,
        "claude-sonnet-4-6",
      );

      expect(result.scores.investment).toBe(75);
      expect(result.recommendation).toBe("buy");
    }, 10000);
  });
});
