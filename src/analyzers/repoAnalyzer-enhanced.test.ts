import { describe, it, expect } from "vitest";
import { starVelocity } from "./repoAnalyzer-enhanced";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const day = (daysAgo: number) =>
  new Date(NOW - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe("starVelocity", () => {
  it("is null when no snapshot is at least a day old", () => {
    expect(starVelocity(1000, [], NOW)).toBeNull();
    expect(starVelocity(1000, [{ date: day(0), star_count: 990 }], NOW)).toBeNull();
  });

  it("measures against the newest snapshot at least 7 days old", () => {
    const history = [
      { date: day(2), star_count: 980 },
      { date: day(8), star_count: 900 },
      { date: day(20), star_count: 500 },
    ];
    // (1000 - 900) stars over 8.5 days (dates are midnight UTC, NOW is noon)
    expect(starVelocity(1000, history, NOW)).toBeCloseTo(100 / 8.5, 6);
  });

  it("falls back to the oldest snapshot under 7 days old", () => {
    const history = [
      { date: day(1), star_count: 990 },
      { date: day(4), star_count: 960 },
    ];
    expect(starVelocity(1000, history, NOW)).toBeCloseTo(40 / 4.5, 6);
  });

  it("divides by the real gap, not a fixed week, when snapshots are sparse", () => {
    const history = [{ date: day(14), star_count: 860 }];
    expect(starVelocity(1000, history, NOW)).toBeCloseTo(140 / 14.5, 6);
  });

  it("can be negative when stars were removed", () => {
    expect(starVelocity(980, [{ date: day(10), star_count: 1000 }], NOW)).toBeLessThan(0);
  });
});
