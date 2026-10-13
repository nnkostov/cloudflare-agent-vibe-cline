import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { StorageEnhancedService } from "./storage-enhanced";
import { resetDatabase } from "../test/d1";
import type { Env } from "../types";

interface RepoSeed {
  id: string;
  tier?: 1 | 2 | 3;
  stars?: number;
  forks?: number;
  pushedAt?: string;
  archived?: boolean;
  failedHoursAgo?: number;
  // Latest analysis: age and the repo snapshot stored with it
  analyzedHoursAgo?: number;
  snapshot?: { stars: number; forks: number; pushedAt: string } | null;
}

const PUSHED = "2026-09-01T00:00:00Z";

async function seed(repo: RepoSeed): Promise<void> {
  const stars = repo.stars ?? 1000;
  const forks = repo.forks ?? 100;
  const pushedAt = repo.pushedAt ?? PUSHED;
  await env.DB.prepare(
    `INSERT INTO repositories (id, name, owner, full_name, stars, forks, created_at, updated_at, pushed_at, is_archived)
     VALUES (?, ?, 'o', ?, ?, ?, '2025-01-01T00:00:00Z', ?, ?, ?)`,
  )
    .bind(repo.id, repo.id, `o/${repo.id}`, stars, forks, pushedAt, pushedAt, repo.archived ? 1 : 0)
    .run();
  await env.DB.prepare(
    `INSERT INTO repo_tiers (repo_id, tier, stars, next_scan_due, last_analysis_attempt_at, last_analysis_error)
     VALUES (?, ?, ?, '2026-01-01', ?, ?)`,
  )
    .bind(
      repo.id,
      repo.tier ?? 3,
      stars,
      repo.failedHoursAgo === undefined
        ? null
        : new Date(Date.now() - repo.failedHoursAgo * 3600_000)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19),
      repo.failedHoursAgo === undefined ? null : "refused:cyber",
    )
    .run();
  if (repo.analyzedHoursAgo !== undefined) {
    const snapshot =
      repo.snapshot === undefined
        ? { stars, forks, pushedAt }
        : repo.snapshot;
    await env.DB.prepare(
      `INSERT INTO analyses (repo_id, investment_score, innovation_score, team_score, market_score,
         recommendation, summary, strengths, risks, questions, model, cost, created_at,
         stars_at_analysis, forks_at_analysis, pushed_at_at_analysis)
       VALUES (?, 50, 50, 50, 50, 'watch', 's', '[]', '[]', '[]', 'claude-sonnet-5-5', 0,
         datetime('now', ?), ?, ?, ?)`,
    )
      .bind(
        repo.id,
        `-${repo.analyzedHoursAgo} hours`,
        snapshot?.stars ?? null,
        snapshot?.forks ?? null,
        snapshot?.pushedAt ?? null,
      )
      .run();
  }
}

describe("StorageEnhancedService.getReposNeedingAnalysis (D1)", () => {
  let storage: StorageEnhancedService;
  const dueIds = async (force = false) =>
    (await storage.getReposNeedingAnalysis("all", force)).map((r) => r.id);

  beforeEach(async () => {
    await resetDatabase(env.DB);
    storage = new StorageEnhancedService(env as unknown as Env);
  });

  it("includes repos that were never analyzed", async () => {
    await seed({ id: "new" });
    expect(await dueIds()).toEqual(["new"]);
  });

  it("skips repos analyzed more recently than the tier's minimum age, even if changed", async () => {
    await seed({ id: "recent", analyzedHoursAgo: 48, pushedAt: "2026-10-10T00:00:00Z", snapshot: { stars: 1000, forks: 100, pushedAt: PUSHED } });
    expect(await dueIds()).toEqual([]);
  });

  it("skips unchanged repos between the minimum and maximum age", async () => {
    await seed({ id: "unchanged", analyzedHoursAgo: 8 * 24 });
    expect(await dueIds()).toEqual([]);
  });

  it("includes repos with a newer push after the minimum age", async () => {
    await seed({
      id: "pushed",
      analyzedHoursAgo: 8 * 24,
      pushedAt: "2026-10-10T00:00:00Z",
      snapshot: { stars: 1000, forks: 100, pushedAt: PUSHED },
    });
    expect(await dueIds()).toEqual(["pushed"]);
  });

  it("requires star growth of both 10% and 25 stars", async () => {
    await seed({ id: "small", stars: 55, analyzedHoursAgo: 8 * 24, snapshot: { stars: 50, forks: 100, pushedAt: PUSHED } });
    await seed({ id: "big", stars: 1100, analyzedHoursAgo: 8 * 24, snapshot: { stars: 1000, forks: 100, pushedAt: PUSHED } });
    expect(await dueIds()).toEqual(["big"]);
  });

  it("includes forks growing 10% and by at least 10", async () => {
    await seed({ id: "forked", forks: 120, analyzedHoursAgo: 8 * 24, snapshot: { stars: 1000, forks: 100, pushedAt: PUSHED } });
    expect(await dueIds()).toEqual(["forked"]);
  });

  it("treats a missing snapshot (old fallback analysis) as changed", async () => {
    await seed({ id: "fallback", analyzedHoursAgo: 8 * 24, snapshot: null });
    expect(await dueIds()).toEqual(["fallback"]);
  });

  it("includes unchanged repos past the tier's maximum age", async () => {
    await seed({ id: "t1-old", tier: 1, analyzedHoursAgo: 8 * 24 });
    await seed({ id: "t2-young", tier: 2, analyzedHoursAgo: 8 * 24 });
    await seed({ id: "t3-old", tier: 3, analyzedHoursAgo: 31 * 24 });
    expect((await dueIds()).sort()).toEqual(["t1-old", "t3-old"]);
  });

  it("skips repos with a persistent failure in the last 24h", async () => {
    await seed({ id: "failed-recently", failedHoursAgo: 2 });
    await seed({ id: "failed-long-ago", failedHoursAgo: 30 });
    expect(await dueIds()).toEqual(["failed-long-ago"]);
  });

  it("skips archived repos", async () => {
    await seed({ id: "archived", archived: true });
    expect(await dueIds()).toEqual([]);
  });

  it("orders never-analyzed, then changed, then over max age", async () => {
    await seed({ id: "over-max", tier: 1, analyzedHoursAgo: 8 * 24, stars: 5000 });
    await seed({
      id: "changed",
      tier: 3,
      analyzedHoursAgo: 8 * 24,
      pushedAt: "2026-10-10T00:00:00Z",
      snapshot: { stars: 1000, forks: 100, pushedAt: PUSHED },
    });
    await seed({ id: "never", tier: 3, stars: 10 });
    expect(await dueIds()).toEqual(["never", "changed", "over-max"]);
  });

  it("force re-analyzes unchanged repos past the shorter force window", async () => {
    await seed({ id: "six-days", tier: 3, analyzedHoursAgo: 6 * 24 });
    expect(await dueIds(false)).toEqual([]);
    expect(await dueIds(true)).toEqual(["six-days"]);
  });

  it("respects the tier target and limit", async () => {
    await seed({ id: "a", tier: 1 });
    await seed({ id: "b", tier: 2 });
    await seed({ id: "c", tier: 2, stars: 9000 });
    expect(
      (await storage.getReposNeedingAnalysis("tier2", false, 1)).map((r) => r.id),
    ).toEqual(["c"]);
  });

  it("keeps the failure cooldown and scan timestamps when a repo's tier is updated", async () => {
    await seed({ id: "r1" });
    await env.DB.prepare(
      "UPDATE repo_tiers SET last_deep_scan = '2026-10-12 10:00:00' WHERE repo_id = 'r1'",
    ).run();
    await storage.recordAnalysisFailure("r1", "refused:cyber");

    await storage.updateRepoTier("r1", {
      stars: 60000,
      growth_velocity: 1,
      engagement_score: 50,
    });

    const row = await env.DB.prepare(
      "SELECT tier, last_deep_scan, last_analysis_error FROM repo_tiers WHERE repo_id = 'r1'",
    ).first();
    expect(row).toEqual({
      tier: 1,
      last_deep_scan: "2026-10-12 10:00:00",
      last_analysis_error: "refused:cyber",
    });
    expect(await dueIds()).toEqual([]);
  });
});
