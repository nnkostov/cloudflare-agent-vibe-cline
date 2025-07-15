import type { 
  Repository, 
  Score, 
  Env,
  CommitMetrics,
  ReleaseMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis
} from '../types';
import { SCORING } from '../types';
import { BaseService } from '../services/base';

export class RepoAnalyzerEnhanced extends BaseService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Enhanced analysis with comprehensive metrics
   */
  async analyzeWithMetrics(
    repo: Repository,
    metrics: {
      commits?: CommitMetrics[];
      releases?: ReleaseMetrics[];
      pullRequests?: PullRequestMetrics | null;
      issues?: IssueMetrics | null;
      stars?: StarHistory[];
      forks?: ForkAnalysis | null;
    }
  ): Promise<Score> {
    const factors = await this.calculateEnhancedFactors(repo, metrics);
    
    // Calculate weighted scores
    const growth = this.calculateGrowthScore(factors);
    const engagement = this.calculateEngagementScore(factors);
    const quality = this.calculateQualityScore(factors);
    
    // Calculate total score
    const total = Math.round(
      growth * SCORING.weights.growth +
      engagement * SCORING.weights.engagement +
      quality * SCORING.weights.quality
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      growth: Math.min(100, Math.max(0, growth)),
      engagement: Math.min(100, Math.max(0, engagement)),
      quality: Math.min(100, Math.max(0, quality)),
      factors,
    };
  }

  /**
   * Calculate enhanced factors including new metrics
   */
  private async calculateEnhancedFactors(
    repo: Repository,
    metrics: {
      commits?: CommitMetrics[];
      releases?: ReleaseMetrics[];
      pullRequests?: PullRequestMetrics | null;
      issues?: IssueMetrics | null;
      stars?: StarHistory[];
      forks?: ForkAnalysis | null;
    }
  ): Promise<Record<string, number>> {
    const factors: Record<string, number> = {};

    // Basic metrics (existing)
    factors.stars = repo.stars;
    factors.forks = repo.forks;
    factors.issues = repo.open_issues;
    
    // Age and activity
    const ageInDays = Math.floor(
      (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    factors.age = ageInDays;
    
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    factors.daysSinceUpdate = daysSinceUpdate;

    // Commit activity metrics
    if (metrics.commits && metrics.commits.length > 0) {
      const recentCommits = metrics.commits.slice(0, 30);
      factors.commitFrequency = recentCommits.reduce((sum, m) => sum + m.commit_count, 0) / 30;
      factors.uniqueAuthors = Math.max(...recentCommits.map(m => m.unique_authors));
      factors.codeChurn = recentCommits.reduce((sum, m) => sum + m.additions + m.deletions, 0);
    }

    // Release metrics
    if (metrics.releases && metrics.releases.length > 0) {
      factors.releaseCount = metrics.releases.length;
      factors.latestReleaseAge = Math.floor(
        (Date.now() - new Date(metrics.releases[0].published_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      factors.totalDownloads = metrics.releases.reduce((sum, r) => sum + r.download_count, 0);
      
      // Release frequency (releases per month)
      if (metrics.releases.length > 1) {
        const oldestRelease = metrics.releases[metrics.releases.length - 1];
        const monthsSpan = Math.max(1, 
          (Date.now() - new Date(oldestRelease.published_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        factors.releaseFrequency = metrics.releases.length / monthsSpan;
      }
    }

    // Pull request metrics
    if (metrics.pullRequests) {
      factors.prActivity = metrics.pullRequests.total_prs;
      factors.prMergeRate = metrics.pullRequests.merged_prs / Math.max(1, metrics.pullRequests.total_prs);
      factors.prContributors = metrics.pullRequests.unique_contributors;
      factors.prResponseTime = metrics.pullRequests.avg_time_to_merge_hours || 168; // Default to 1 week
    }

    // Issue metrics
    if (metrics.issues) {
      factors.issueActivity = metrics.issues.total_issues;
      factors.issueCloseRate = metrics.issues.closed_issues / Math.max(1, metrics.issues.total_issues);
      factors.issueResponseTime = metrics.issues.avg_time_to_first_response_hours || 48; // Default to 2 days
      factors.bugRatio = metrics.issues.bug_issues / Math.max(1, metrics.issues.total_issues);
    }

    // Star growth metrics
    if (metrics.stars && metrics.stars.length > 0) {
      const recentStars = metrics.stars.slice(0, 7);
      const weekAgoStars = recentStars[recentStars.length - 1]?.star_count || repo.stars;
      factors.weeklyStarGrowth = repo.stars - weekAgoStars;
      factors.starVelocity = factors.weeklyStarGrowth / 7;
      
      // Calculate growth rate
      if (weekAgoStars > 0) {
        factors.starGrowthRate = ((repo.stars - weekAgoStars) / weekAgoStars) * 100;
      }
    }

    // Fork network metrics
    if (metrics.forks) {
      factors.activeForkRatio = metrics.forks.active_forks / Math.max(1, metrics.forks.total_forks);
      factors.forkEngagement = metrics.forks.forks_with_stars / Math.max(1, metrics.forks.total_forks);
      factors.avgForkStars = metrics.forks.avg_fork_stars || 0;
    }

    // Calculated metrics
    factors.starsPerDay = ageInDays > 0 ? repo.stars / ageInDays : 0;
    factors.forksPerStar = repo.stars > 0 ? repo.forks / repo.stars : 0;
    factors.issuesPerStar = repo.stars > 0 ? repo.open_issues / repo.stars : 0;
    
    // Topic relevance
    factors.topicRelevance = this.calculateTopicRelevance(repo.topics);
    
    // Documentation quality (basic check)
    factors.hasDescription = repo.description ? 1 : 0;
    factors.descriptionLength = repo.description?.length || 0;

    return factors;
  }

  /**
   * Calculate growth score with enhanced metrics
   */
  private calculateGrowthScore(factors: Record<string, number>): number {
    let score = 0;
    
    // Star-based growth (40%)
    if (factors.stars > 0) {
      const starScore = Math.min(100, Math.log10(factors.stars + 1) * 20);
      const velocityBonus = Math.min(30, factors.starVelocity || 0);
      const growthRateBonus = Math.min(30, (factors.starGrowthRate || 0) / 10);
      score += (starScore + velocityBonus + growthRateBonus) * 0.4;
    }
    
    // Fork-based growth (20%)
    if (factors.forks > 0) {
      const forkScore = Math.min(100, Math.log10(factors.forks + 1) * 25);
      const activeForkBonus = (factors.activeForkRatio || 0) * 30;
      score += (forkScore + activeForkBonus) * 0.2;
    }
    
    // Contributor growth (20%)
    const contributorScore = Math.min(100, 
      (factors.uniqueAuthors || 0) * 10 + 
      (factors.prContributors || 0) * 5
    );
    score += contributorScore * 0.2;
    
    // Release momentum (20%)
    if (factors.releaseCount > 0) {
      const releaseScore = Math.min(100,
        factors.releaseCount * 5 +
        (factors.releaseFrequency || 0) * 20 +
        Math.max(0, 50 - (factors.latestReleaseAge || 365) / 7)
      );
      score += releaseScore * 0.2;
    }
    
    return Math.round(score);
  }

  /**
   * Calculate engagement score with enhanced metrics
   */
  private calculateEngagementScore(factors: Record<string, number>): number {
    let score = 0;
    
    // Fork engagement (30%)
    const forkEngagement = Math.min(100,
      (factors.forksPerStar || 0) * 200 +
      (factors.forkEngagement || 0) * 50 +
      Math.log10((factors.avgForkStars || 0) + 1) * 10
    );
    score += forkEngagement * 0.3;
    
    // Issue engagement (25%)
    const issueEngagement = Math.min(100,
      Math.log10((factors.issueActivity || 0) + 1) * 20 +
      (factors.issueCloseRate || 0) * 40 +
      Math.max(0, 40 - (factors.issueResponseTime || 48) / 24 * 10)
    );
    score += issueEngagement * 0.25;
    
    // PR engagement (25%)
    const prEngagement = Math.min(100,
      Math.log10((factors.prActivity || 0) + 1) * 20 +
      (factors.prMergeRate || 0) * 40 +
      Math.max(0, 40 - (factors.prResponseTime || 168) / 24 * 5)
    );
    score += prEngagement * 0.25;
    
    // Topic relevance (20%)
    score += (factors.topicRelevance || 0) * 100 * 0.2;
    
    return Math.round(score);
  }

  /**
   * Calculate quality score with enhanced metrics
   */
  private calculateQualityScore(factors: Record<string, number>): number {
    let score = 0;
    
    // Documentation quality (25%)
    const docScore = Math.min(100,
      (factors.hasDescription || 0) * 30 +
      Math.min(70, (factors.descriptionLength || 0) / 2) +
      (factors.releaseCount > 0 ? 20 : 0) // Bonus for having releases
    );
    score += docScore * 0.25;
    
    // Code quality indicators (35%)
    const codeQuality = Math.min(100,
      Math.max(0, 50 - (factors.bugRatio || 0.5) * 100) + // Lower bug ratio is better
      (factors.commitFrequency > 0.5 ? 25 : 0) + // Regular commits
      (factors.uniqueAuthors > 2 ? 25 : factors.uniqueAuthors * 12.5) // Multiple contributors
    );
    score += codeQuality * 0.35;
    
    // Activity and maintenance (40%)
    const activityScore = Math.min(100,
      Math.max(0, 100 - factors.daysSinceUpdate * 2) * 0.5 + // Recent updates
      (factors.commitFrequency || 0) * 10 * 0.3 + // Commit frequency
      (factors.releaseFrequency || 0) * 20 * 0.2 // Release frequency
    );
    score += activityScore * 0.4;
    
    return Math.round(score);
  }

  /**
   * Calculate topic relevance score
   */
  private calculateTopicRelevance(topics: string[]): number {
    const relevantTopics = [
      'ai', 'artificial-intelligence', 'machine-learning', 'ml',
      'deep-learning', 'neural-network', 'llm', 'large-language-model',
      'gpt', 'transformer', 'nlp', 'natural-language-processing',
      'computer-vision', 'cv', 'reinforcement-learning', 'rl',
      'generative-ai', 'genai', 'agents', 'ai-agents',
      'langchain', 'llamaindex', 'vector-database', 'embeddings'
    ];
    
    const matchCount = topics.filter(topic => 
      relevantTopics.includes(topic.toLowerCase())
    ).length;
    
    return Math.min(1, matchCount / 3); // Max relevance with 3+ relevant topics
  }

  /**
   * Determine if repository is high potential based on enhanced score
   */
  isHighPotential(score: Score): boolean {
    return score.total >= SCORING.thresholds.highPotential;
  }

  /**
   * Get recommended analysis model based on enhanced score
   */
  getRecommendedModel(score: Score): string {
    if (score.total >= SCORING.thresholds.veryHigh || score.growth >= 90) {
      return 'high';
    } else if (score.total >= SCORING.thresholds.highPotential) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate growth velocity for tier assignment
   */
  calculateGrowthVelocity(
    currentStars: number,
    historicalStars: StarHistory[]
  ): number {
    if (historicalStars.length === 0) return 0;
    
    // Get stars from 7 days ago
    const weekAgo = historicalStars.find(h => {
      const daysAgo = Math.floor(
        (Date.now() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysAgo >= 7;
    });
    
    if (!weekAgo) return 0;
    
    const weeklyGrowth = currentStars - weekAgo.star_count;
    return weeklyGrowth / 7; // Stars per day
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
    const forkRatio = metrics.forks / Math.max(1, metrics.forks + metrics.issues);
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
