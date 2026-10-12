import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { StorageEnhancedService } from "./storage-enhanced";
import { resetDatabase } from "../test/d1";
import type { Env } from "../types";

async function seedRepo(id: string, failedHoursAgo?: number): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO repositories (id, name, owner, full_name, stars, forks, created_at, updated_at, pushed_at)
     VALUES (?, ?, 'o', ?, 100, 10, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')`,
  )
    .bind(id, id, `o/${id}`)
    .run();
  await env.DB.prepare(
    `INSERT INTO repo_tiers (repo_id, tier, stars, next_scan_due, last_analysis_attempt_at, last_analysis_error)
     VALUES (?, 3, 100, '2026-01-01', datetime('now', ?), ?)`,
  )
    .bind(
      id,
      failedHoursAgo === undefined ? null : `-${failedHoursAgo} hours`,
      failedHoursAgo === undefined ? null : "refused:cyber",
    )
    .run();
}

describe("StorageEnhancedService analysis failures (D1)", () => {
  let storage: StorageEnhancedService;

  beforeEach(async () => {
    await resetDatabase(env.DB);
    storage = new StorageEnhancedService(env as unknown as Env);
  });

  it("skips repos with a persistent failure in the last 24h", async () => {
    await seedRepo("never-failed");
    await seedRepo("failed-recently", 2);
    await seedRepo("failed-long-ago", 30);

    const ids = (await storage.getReposNeedingAnalysis()).map((r) => r.id);

    expect(ids.sort()).toEqual(["failed-long-ago", "never-failed"]);
  });

  it("records and clears a failure", async () => {
    await seedRepo("r1");

    await storage.recordAnalysisFailure("r1", "truncated");
    expect(
      await env.DB.prepare(
        "SELECT last_analysis_error FROM repo_tiers WHERE repo_id = 'r1'",
      ).first("last_analysis_error"),
    ).toBe("truncated");
    expect((await storage.getReposNeedingAnalysis()).map((r) => r.id)).toEqual([]);

    await storage.clearAnalysisFailure("r1");
    expect((await storage.getReposNeedingAnalysis()).map((r) => r.id)).toEqual(["r1"]);
  });
});
