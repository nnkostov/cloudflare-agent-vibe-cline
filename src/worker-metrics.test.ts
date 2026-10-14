import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import worker from "./index";
import { resetDatabase } from "./test/d1";
import type { Env } from "./types";

async function logAt(minutesAgo: number, message: string | null, url: string | null = null) {
  const ts = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO tail_logs (id, timestamp, script_name, outcome, request_url, log_message)
     VALUES (?, ?, 'github-ai-intelligence', 'ok', ?, ?)`,
  )
    .bind(crypto.randomUUID(), ts, url, message)
    .run();
}

describe("GET /api/worker-metrics (D1)", () => {
  beforeEach(async () => {
    await resetDatabase(env.DB);
  });

  it("counts real logged activity in five-minute buckets", async () => {
    // Current bucket: two Claude analyses and a GitHub call
    await logAt(1, "[API CALL] Claude API Response - Model: claude-sonnet-5-5, Input: 1, Output: 1, Total: 2");
    await logAt(2, "[API CALL] Claude API Response - Model: claude-haiku-5-5, Input: 1, Output: 1, Total: 2");
    await logAt(2, "[API CALL] GitHub API - getReadme for o/r");
    // Twenty minutes ago: one dashboard request
    await logAt(21, "Found 50 repositories", "https://x.workers.dev/api/reports/enhanced");
    // Outside the hour: ignored
    await logAt(70, "[API CALL] Claude API Response - old");

    const res = await worker.fetch(
      new Request("http://localhost/api/worker-metrics"),
      env as unknown as Env,
    );
    const body = (await res.json()) as any;

    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30");
    expect(body.metrics).toHaveLength(12);
    const current = body.metrics[11];
    expect(current.counts).toMatchObject({ analyses: 2, github: 1, dashboard: 0, events: 3 });
    expect(current.heartbeat).toBe(100);
    expect(current.activityType).toBe("ai-processing");
    const earlier = body.metrics[11 - 4];
    expect(earlier.counts).toMatchObject({ dashboard: 1, events: 1 });
    expect(earlier.heartbeat).toBe(33);
    expect(body.metrics[0].activityType).toBe("idle");
    expect(body.summary.eventsLastHour).toBe(4);
  });
});
