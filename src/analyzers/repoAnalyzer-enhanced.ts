import type { Env, StarHistory } from "../types";
import { BaseService } from "../services/base";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Stars gained per day, measured against a real recorded snapshot: the
 * newest one at least 7 days old, else the oldest one at least 1 day old.
 * Snapshots can be days apart, so growth is divided by the actual time
 * elapsed. Returns null when no snapshot is old enough to measure against.
 */
export function starVelocity(
  currentStars: number,
  history: Pick<StarHistory, "date" | "star_count">[],
  now: number = Date.now(),
): number | null {
  const aged = history
    .map((h) => ({ stars: h.star_count, days: (now - Date.parse(h.date)) / DAY_MS }))
    .filter((h) => h.days >= 1);
  if (aged.length === 0) return null;

  const weekOld = aged.filter((h) => h.days >= 7);
  const reference =
    weekOld.length > 0
      ? weekOld.reduce((a, b) => (b.days < a.days ? b : a))
      : aged.reduce((a, b) => (b.days > a.days ? b : a));
  return (currentStars - reference.stars) / reference.days;
}

export class RepoAnalyzerEnhanced extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Star growth per day for tier assignment. See starVelocity.
   */
  calculateGrowthVelocity(
    currentStars: number,
    historicalStars: StarHistory[],
  ): number | null {
    return starVelocity(currentStars, historicalStars);
  }

  /**
   * Calculate engagement score for tier assignment
   */
  calculateEngagementScoreForTier(metrics: {
    forks: number;
    issues: number;
    prActivity?: number;
    contributors?: number;
  }): number {
    let score = 0;

    // Fork ratio (0-40 points)
    const forkRatio =
      metrics.forks / Math.max(1, metrics.forks + metrics.issues);
    score += forkRatio * 40;

    // PR activity (0-30 points)
    if (metrics.prActivity) {
      score += Math.min(30, metrics.prActivity * 3);
    }

    // Contributor diversity (0-30 points)
    if (metrics.contributors) {
      score += Math.min(30, metrics.contributors * 5);
    }

    return score;
  }
}
