import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { StorageService } from "./storage";
import { resetDatabase } from "../test/d1";
import type { Analysis, Env, Repository } from "../types";

const repo: Repository = {
  id: "repo-1",
  name: "agent-kit",
  owner: "acme",
  full_name: "acme/agent-kit",
  description: "Agent toolkit",
  stars: 1200,
  forks: 150,
  open_issues: 12,
  language: "TypeScript",
  topics: ["ai", "agents"],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  pushed_at: "2026-10-01T00:00:00Z",
  is_archived: false,
  is_fork: false,
  html_url: "https://github.com/acme/agent-kit",
  clone_url: "https://github.com/acme/agent-kit.git",
  default_branch: "main",
};

const analysis: Analysis = {
  repo_id: "repo-1",
  scores: {
    investment: 81,
    innovation: 77,
    team: 70,
    market: 85,
    technical_moat: 66,
    scalability: 72,
    developer_adoption: 90,
  },
  recommendation: "buy",
  summary: "Strong adoption.\n\nClear wedge.",
  strengths: ["Community"],
  risks: ["Competition"],
  questions: ["Pricing?"],
  growth_prediction: "2x in 12 months",
  investment_thesis: "Developer-led wedge into agent infrastructure.",
  competitive_analysis: "Ahead of two alternatives.",
  metadata: {
    model: "claude-sonnet-5-5",
    cost: 0.012,
    timestamp: new Date().toISOString(),
    input_tokens: 2100,
    output_tokens: 780,
  },
};

describe("StorageService analyses (D1)", () => {
  let storage: StorageService;

  beforeEach(async () => {
    await resetDatabase(env.DB);
    storage = new StorageService(env as unknown as Env);
    await storage.saveRepository(repo);
  });

  it("round-trips the extended analysis fields and token usage", async () => {
    await storage.saveAnalysis(analysis, repo);

    const saved = await storage.getLatestAnalysis("repo-1");

    expect(saved?.scores).toEqual(analysis.scores);
    expect(saved?.questions).toEqual(["Pricing?"]);
    expect(saved?.growth_prediction).toBe(analysis.growth_prediction);
    expect(saved?.investment_thesis).toBe(analysis.investment_thesis);
    expect(saved?.competitive_analysis).toBe(analysis.competitive_analysis);
    expect(saved?.metadata.input_tokens).toBe(2100);
    expect(saved?.metadata.output_tokens).toBe(780);
    expect(saved?.metadata.model).toBe("claude-sonnet-5-5");
  });

  it("stores the repo snapshot used for change detection", async () => {
    await storage.saveAnalysis(analysis, repo);

    const row = await env.DB.prepare(
      "SELECT stars_at_analysis, forks_at_analysis, pushed_at_at_analysis FROM analyses WHERE repo_id = ?",
    )
      .bind("repo-1")
      .first();

    expect(row).toEqual({
      stars_at_analysis: 1200,
      forks_at_analysis: 150,
      pushed_at_at_analysis: "2026-10-01T00:00:00Z",
    });
  });

  it("reads analyses saved before the extended columns as undefined fields", async () => {
    await env.DB.prepare(
      `INSERT INTO analyses (repo_id, investment_score, innovation_score, team_score, market_score,
        recommendation, summary, strengths, risks, questions, model, cost)
       VALUES ('repo-1', 60, 60, 60, 60, 'watch', 'Old', '[]', '[]', '[]', 'claude-sonnet-4-6', 0.001)`,
    ).run();

    const saved = await storage.getLatestAnalysis("repo-1");

    expect(saved?.scores.technical_moat).toBeUndefined();
    expect(saved?.investment_thesis).toBeUndefined();
    expect(saved?.metadata.model).toBe("claude-sonnet-4-6");
  });

  it("keeps discovered_at when a repository is saved again", async () => {
    await env.DB.prepare(
      "UPDATE repositories SET discovered_at = '2025-08-01 00:00:00' WHERE id = 'repo-1'",
    ).run();

    await storage.saveRepository({ ...repo, stars: 1300 });

    const row = await env.DB.prepare(
      "SELECT stars, discovered_at FROM repositories WHERE id = 'repo-1'",
    ).first();
    expect(row).toEqual({ stars: 1300, discovered_at: "2025-08-01 00:00:00" });
  });

  it("saves system alerts with no repository", async () => {
    await storage.saveAlert({
      repo_id: null,
      type: "system",
      level: "urgent",
      message: "scan: 50/50 repos failed",
    });

    const row = await env.DB.prepare(
      "SELECT repo_id, type FROM alerts WHERE type = 'system'",
    ).first();
    expect(row).toEqual({ repo_id: null, type: "system" });
  });
});

