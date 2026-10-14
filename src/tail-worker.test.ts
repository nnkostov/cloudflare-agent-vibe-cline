import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { TailWorker } from "./tail-worker";
import { resetDatabase } from "./test/d1";
import type { Env } from "./types";

const awkward = `It's a "quoted" path C:\\temp\\x; DROP TABLE tail_logs; --`;

function cronEvent(messages: string[], exception?: { name: string; message: string }) {
  return {
    scriptName: "github-ai-intelligence",
    outcome: "ok" as const,
    eventTimestamp: Date.parse("2026-10-14T00:15:00Z"),
    event: {},
    logs: messages.map((m) => ({ message: [m], level: "log" as const, timestamp: 0 })),
    exceptions: exception ? [{ ...exception, timestamp: 0 }] : [],
  };
}

describe("TailWorker (D1)", () => {
  beforeEach(async () => {
    await resetDatabase(env.DB);
  });

  it("stores every line of a multi-line event, with text exactly as logged", async () => {
    const worker = new TailWorker(env as unknown as Env);

    await worker.tail([cronEvent(["Mode: analysis-only batch run", awkward, "done"])]);

    const { results } = await env.DB.prepare(
      "SELECT log_message FROM tail_logs ORDER BY rowid",
    ).all<{ log_message: string }>();
    expect(results.map((r) => r.log_message)).toEqual([
      "Mode: analysis-only batch run",
      awkward,
      "done",
    ]);
  });

  it("records critical errors as system alerts with no repository", async () => {
    const worker = new TailWorker(env as unknown as Env);

    await worker.tail([
      cronEvent(["starting"], { name: "Error", message: "GitHub rate limit exceeded" }),
    ]);

    const alert = await env.DB.prepare(
      "SELECT repo_id, type, level FROM alerts",
    ).first();
    expect(alert).toEqual({ repo_id: null, type: "system_error", level: "critical" });
  });
});
