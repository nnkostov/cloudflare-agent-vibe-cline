import type { 
  Repository, 
  Score, 
  Env, 
  SCORING, 
  ClaudeModel,
  CommitMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis
} from '../types';
import { BaseService } from '../services/base';
import { SCORING as ScoringConfig, CONFIG } from '../types';

export class RepoAnalyzer extends BaseService {
  /**
   * Analyze a repository and calculate scores
   */
  async analyze(repo: Repository, enhancedMetrics?: {
    commits?: CommitMetrics[];
    pullRequests?: PullRequestMetrics | null;
    issues?: IssueMetrics | null;
    stars?: StarHistory[];
    forks?: ForkAnalysis | null;
  }): Promise<Score> {
    const factors = enhancedMetrics 
      ? await this.calculateEnhancedFactors(repo, enhancedMetrics)
      : await this.calculateBasicFactors(repo);
    
    // Calculate weighted scores
    const growth = this.weightedSum(factors.growth, ScoringConfig.factors.growth);
    const engagement = this.weightedSum(factors.engagement, ScoringConfig.factors.engagement);
    const quality = this.weightedSum(factors.quality, ScoringConfig.factors.quality);
    
    // Calculate total score
    const total = this.weightedSum(
      { growth, engagement, quality },
      ScoringConfig.weights
    );

    return {
      total: Math.round(total),
      growth: Math.round(growth),
      engagement: Math.round(engagement),
      quality: Math.round(quality),
      factors: Object.entries(factors).reduce((acc, [category, values]) => ({
        ...acc,
        ...Object.entries(values).reduce((inner, [key, value]) => ({
          ...inner,
          [`${category}_${key}`]: Math.round(value)
        }), {})
      }), {})
    };
  }

  /**
   * Calculate basic scoring factors
   */
  private async calculateBasicFactors(repo: Repository) {
    const ageInDays = this.getDaysSince(repo.created_at);
    const daysSinceUpdate = this.getDaysSince(repo.updated_at);
    
    return {
      growth: {
        stars: this.scoreByThresholds(repo.stars, [1000, 500, 100, 50], [100, 80, 60, 40, 20]),
        forks: repo.stars > 0 ? this.scoreByRatio(repo.forks / repo.stars, 0.2, 0.1) : 20,
        contributors: this.scoreByThresholds(repo.forks, [50, 20, 10], [70, 50, 30, 20])
      },
      engagement: {
        forkRatio: this.scoreForkRatio(repo),
        issues: this.scoreIssueRatio(repo),
        topics: Math.min(repo.topics.filter(t => 
          ['ai', 'llm', 'ml', 'gpt'].some(keyword => t.toLowerCase().includes(keyword))
        ).length * 20, 60)
      },
      quality: {
        docs: this.scoreDocumentation(repo),
        code: this.scoreByThresholds(repo.stars, [1000, 500, 100], [80, 60, 40, 20]),
        activity: this.scoreByThresholds(daysSinceUpdate, [7, 30, 90], [100, 80, 50, 20], true)
      }
    };
  }

  /**
   * Calculate enhanced scoring factors using comprehensive metrics
   */
  private async calculateEnhancedFactors(repo: Repository, metrics: {
    commits?: CommitMetrics[];
    pullRequests?: PullRequestMetrics | null;
    issues?: IssueMetrics | null;
    stars?: StarHistory[];
    forks?: ForkAnalysis | null;
  }) {
    const basicFactors = await this.calculateBasicFactors(repo);
    
    // Enhanced growth metrics
    const growthVelocity = this.calculateGrowthVelocity(metrics.stars || []);
    const commitActivity = this.calculateCommitActivity(metrics.commits || []);
    const releaseFrequency = this.calculateReleaseFrequency(repo);
    
    // Enhanced engagement metrics
    const prEngagement = this.calculatePREngagement(metrics.pullRequests);
    const issueEngagement = this.calculateIssueEngagement(metrics.issues);
    const forkEngagement = this.calculateForkEngagement(metrics.forks);
    
    // Enhanced quality metrics
    const codeQuality = this.calculateCodeQuality(repo, metrics);
    const communityHealth = this.calculateCommunityHealth(metrics);
    
    return {
      growth: {
        stars: Math.max(basicFactors.growth.stars, growthVelocity),
        forks: Math.max(basicFactors.growth.forks, forkEngagement),
        contributors: Math.max(basicFactors.growth.contributors, commitActivity),
        velocity: growthVelocity,
        releases: releaseFrequency
      },
      engagement: {
        forkRatio: basicFactors.engagement.forkRatio,
        issues: Math.max(basicFactors.engagement.issues, issueEngagement),
        topics: basicFactors.engagement.topics,
        pullRequests: prEngagement,
        community: communityHealth
      },
      quality: {
        docs: basicFactors.quality.docs,
        code: Math.max(basicFactors.quality.code, codeQuality),
        activity: basicFactors.quality.activity,
        maintenance: this.calculateMaintenanceScore(metrics)
      }
    };
  }

  /**
   * Calculate growth velocity from star history
   */
  private calculateGrowthVelocity(starHistory: StarHistory[]): number {
    if (starHistory.length < 7) return 50;
    
    const recentWeek = starHistory.slice(0, 7);
    const totalGrowth = recentWeek.reduce((sum: number, day: StarHistory) => sum + (day.daily_growth || 0), 0);
    const avgDailyGrowth = totalGrowth / 7;
    
    // Score based on daily growth rate
    if (avgDailyGrowth > 100) return 100;
    if (avgDailyGrowth > 50) return 90;
    if (avgDailyGrowth > 20) return 80;
    if (avgDailyGrowth > 10) return 70;
    if (avgDailyGrowth > 5) return 60;
    return 50;
  }

  /**
   * Calculate commit activity score
   */
  private calculateCommitActivity(commits: CommitMetrics[]): number {
    if (commits.length === 0) return 40;
    
    const recentCommits = commits.slice(0, 30);
    const totalCommits = recentCommits.reduce((sum: number, day: CommitMetrics) => sum + day.commit_count, 0);
    const uniqueAuthors = new Set(recentCommits.flatMap(day => 
      Array(day.unique_authors).fill(null)
    )).size;
    
    let score = 0;
    
    // Score based on commit frequency
    if (totalCommits > 300) score += 50;
    else if (totalCommits > 150) score += 40;
    else if (totalCommits > 50) score += 30;
    else if (totalCommits > 10) score += 20;
    else score += 10;
    
    // Score based on author diversity
    if (uniqueAuthors > 20) score += 50;
    else if (uniqueAuthors > 10) score += 40;
    else if (uniqueAuthors > 5) score += 30;
    else if (uniqueAuthors > 2) score += 20;
    else score += 10;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate release frequency score
   */
  private calculateReleaseFrequency(repo: Repository): number {
    // Simple heuristic based on update frequency
    const daysSinceUpdate = this.getDaysSince(repo.updated_at);
    
    if (daysSinceUpdate < 7) return 80;
    if (daysSinceUpdate < 30) return 60;
    if (daysSinceUpdate < 90) return 40;
    return 20;
  }

  /**
   * Calculate PR engagement score
   */
  private calculatePREngagement(pr: PullRequestMetrics | null | undefined): number {
    if (!pr || pr.total_prs === 0) return 40;
    
    let score = 0;
    
    // Merge rate
    const mergeRate = pr.merged_prs / pr.total_prs;
    if (mergeRate > 0.8) score += 30;
    else if (mergeRate > 0.6) score += 25;
    else if (mergeRate > 0.4) score += 20;
    else score += 10;
    
    // Time to merge
    if (pr.avg_time_to_merge_hours !== null) {
      if (pr.avg_time_to_merge_hours < 24) score += 30;
      else if (pr.avg_time_to_merge_hours < 72) score += 25;
      else if (pr.avg_time_to_merge_hours < 168) score += 20;
      else score += 10;
    }
    
    // Contributor diversity
    if (pr.unique_contributors > 10) score += 40;
    else if (pr.unique_contributors > 5) score += 30;
    else if (pr.unique_contributors > 2) score += 20;
    else score += 10;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate issue engagement score
   */
  private calculateIssueEngagement(issues: IssueMetrics | null | undefined): number {
    if (!issues || issues.total_issues === 0) return 40;
    
    let score = 0;
    
    // Close rate
    const closeRate = issues.closed_issues / issues.total_issues;
    if (closeRate > 0.8) score += 30;
    else if (closeRate > 0.6) score += 25;
    else if (closeRate > 0.4) score += 20;
    else score += 10;
    
    // Response time
    if (issues.avg_time_to_first_response_hours !== null) {
      if (issues.avg_time_to_first_response_hours < 24) score += 35;
      else if (issues.avg_time_to_first_response_hours < 72) score += 25;
      else if (issues.avg_time_to_first_response_hours < 168) score += 15;
      else score += 5;
    }
    
    // Issue types (bugs vs features)
    const featureRatio = issues.feature_issues / (issues.total_issues || 1);
    if (featureRatio > 0.5) score += 35;
    else if (featureRatio > 0.3) score += 25;
    else score += 15;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate fork engagement score
   */
  private calculateForkEngagement(forks: ForkAnalysis | null | undefined): number {
    if (!forks || forks.total_forks === 0) return 40;
    
    let score = 0;
    
    // Active fork ratio
    const activeRatio = forks.active_forks / forks.total_forks;
    if (activeRatio > 0.5) score += 40;
    else if (activeRatio > 0.3) score += 30;
    else if (activeRatio > 0.1) score += 20;
    else score += 10;
    
    // Forks with stars
    const starredRatio = forks.forks_with_stars / forks.total_forks;
    if (starredRatio > 0.3) score += 30;
    else if (starredRatio > 0.1) score += 20;
    else if (starredRatio > 0.05) score += 15;
    else score += 10;
    
    // Average fork stars
    if (forks.avg_fork_stars !== null) {
      if (forks.avg_fork_stars > 50) score += 30;
      else if (forks.avg_fork_stars > 10) score += 20;
      else if (forks.avg_fork_stars > 1) score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate code quality score
   */
  private calculateCodeQuality(repo: Repository, metrics: any): number {
    let score = 0;
    
    // Language quality
    const qualityLanguages = ['TypeScript', 'Rust', 'Go', 'Python', 'JavaScript'];
    if (qualityLanguages.includes(repo.language || '')) score += 20;
    
    // Documentation
    if (repo.description && repo.description.length > 100) score += 20;
    if (repo.topics.length > 5) score += 20;
    
    // Activity patterns
    if (metrics.commits && metrics.commits.length > 0) {
      const avgCommits = metrics.commits.slice(0, 30).reduce((sum: number, day: CommitMetrics) => 
        sum + day.commit_count, 0) / 30;
      if (avgCommits > 5) score += 20;
      else if (avgCommits > 2) score += 15;
      else if (avgCommits > 0.5) score += 10;
    }
    
    // Not archived or fork
    if (!repo.is_archived && !repo.is_fork) score += 20;
    
    return Math.min(score, 100);
  }

  /**
   * Calculate community health score
   */
  private calculateCommunityHealth(metrics: any): number {
    let score = 0;
    
    // PR activity
    if (metrics.pullRequests) {
      if (metrics.pullRequests.total_prs > 20) score += 25;
      else if (metrics.pullRequests.total_prs > 10) score += 20;
      else if (metrics.pullRequests.total_prs > 5) score += 15;
      else score += 10;
    }
    
    // Issue activity
    if (metrics.issues) {
      if (metrics.issues.total_issues > 20) score += 25;
      else if (metrics.issues.total_issues > 10) score += 20;
      else if (metrics.issues.total_issues > 5) score += 15;
      else score += 10;
    }
    
    // Fork activity
    if (metrics.forks) {
      if (metrics.forks.active_forks > 10) score += 25;
      else if (metrics.forks.active_forks > 5) score += 20;
      else if (metrics.forks.active_forks > 2) score += 15;
      else score += 10;
    }
    
    // Commit diversity
    if (metrics.commits && metrics.commits.length > 0) {
      const avgAuthors = metrics.commits.slice(0, 30).reduce((sum: number, day: CommitMetrics) => 
        sum + day.unique_authors, 0) / 30;
      if (avgAuthors > 3) score += 25;
      else if (avgAuthors > 2) score += 20;
      else if (avgAuthors > 1) score += 15;
      else score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate maintenance score
   */
  private calculateMaintenanceScore(metrics: any): number {
    let score = 0;
    
    // Issue resolution
    if (metrics.issues && metrics.issues.avg_time_to_close_hours !== null) {
      if (metrics.issues.avg_time_to_close_hours < 168) score += 35; // < 1 week
      else if (metrics.issues.avg_time_to_close_hours < 336) score += 25; // < 2 weeks
      else if (metrics.issues.avg_time_to_close_hours < 720) score += 15; // < 1 month
      else score += 5;
    }
    
    // PR merge time
    if (metrics.pullRequests && metrics.pullRequests.avg_time_to_merge_hours !== null) {
      if (metrics.pullRequests.avg_time_to_merge_hours < 48) score += 35;
      else if (metrics.pullRequests.avg_time_to_merge_hours < 168) score += 25;
      else if (metrics.pullRequests.avg_time_to_merge_hours < 336) score += 15;
      else score += 5;
    }
    
    // Regular commits
    if (metrics.commits && metrics.commits.length > 0) {
      const daysWithCommits = metrics.commits.filter((day: CommitMetrics) => day.commit_count > 0).length;
      const commitRatio = daysWithCommits / metrics.commits.length;
      if (commitRatio > 0.7) score += 30;
      else if (commitRatio > 0.5) score += 20;
      else if (commitRatio > 0.3) score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Calculate weighted sum
   */
  private weightedSum(values: Record<string, number>, weights: Record<string, number>): number {
    return Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + (values[key] || 0) * weight,
      0
    );
  }

  /**
   * Score by thresholds
   */
  private scoreByThresholds(
    value: number, 
    thresholds: number[], 
    scores: number[],
    inverse: boolean = false
  ): number {
    for (let i = 0; i < thresholds.length; i++) {
      if (inverse ? value <= thresholds[i] : value >= thresholds[i]) {
        return scores[i];
      }
    }
    return scores[scores.length - 1];
  }

  /**
   * Score by ratio
   */
  private scoreByRatio(ratio: number, optimal: number, acceptable: number): number {
    if (ratio >= acceptable && ratio <= optimal) return 80;
    if (ratio > optimal && ratio <= optimal * 1.5) return 60;
    if (ratio >= acceptable * 0.5) return 40;
    return 20;
  }

  /**
   * Score fork ratio
   */
  private scoreForkRatio(repo: Repository): number {
    if (repo.stars === 0) return 0;
    const ratio = repo.forks / repo.stars;
    return this.scoreByRatio(ratio, 0.3, 0.1);
  }

  /**
   * Score issue ratio
   */
  private scoreIssueRatio(repo: Repository): number {
    if (repo.stars === 0) return 0;
    const ratio = repo.open_issues / repo.stars;
    if (ratio > 0.01 && ratio < 0.05) return 100;
    if (ratio > 0.005 && ratio < 0.1) return 80;
    if (ratio > 0 && ratio < 0.2) return 60;
    return ratio === 0 ? 40 : 20;
  }

  /**
   * Score documentation quality
   */
  private scoreDocumentation(repo: Repository): number {
    let score = 0;
    if (repo.description && repo.description.length > 20) score += 30;
    if (repo.description && repo.description.length > 100) score += 20;
    if (repo.topics.length > 3) score += 20;
    else if (repo.topics.length > 0) score += 10;
    if (!repo.is_archived && !repo.is_fork) score += 20;
    if (['Python', 'TypeScript', 'JavaScript', 'Go', 'Rust'].includes(repo.language || '')) score += 10;
    return Math.min(score, 100);
  }

  /**
   * Calculate days since date
   */
  private getDaysSince(dateString: string): number {
    return Math.ceil((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Determine if repository is high-potential
   */
  isHighPotential(score: Score): boolean {
    return score.total >= ScoringConfig.thresholds.highPotential || 
           score.growth >= 80 ||
           (score.growth >= 60 && score.quality >= 70);
  }

  /**
   * Get recommended Claude model based on score
   */
  getRecommendedModel(score: Score): ClaudeModel {
    if (CONFIG.claude.useClaude4) {
      if (score.total >= CONFIG.claude.thresholds.high || score.growth >= 80) {
        return CONFIG.claude.models.high; // claude-opus-4
      } else if (score.total >= CONFIG.claude.thresholds.medium) {
        return CONFIG.claude.models.medium; // claude-sonnet-4
      }
      return CONFIG.claude.models.low; // claude-3-haiku-20240307
    }
    
    // Fallback to Claude 4 models
    if (score.total >= ScoringConfig.thresholds.veryHigh || score.growth >= 90) {
      return 'claude-opus-4-20250514';
    } else if (score.total >= ScoringConfig.thresholds.highPotential) {
      return 'claude-sonnet-4-20250514';
    }
    return 'claude-3-5-haiku-20241022';
  }

  /**
   * Calculate tier assignment based on comprehensive metrics
   */
  calculateTier(repo: Repository, score: Score, metrics?: any): 1 | 2 | 3 {
    // Tier 1: Hot prospects
    if (repo.stars >= 100 && (score.growth >= 70 || score.total >= 70)) {
      return 1;
    }
    
    // Tier 2: Rising stars
    if (repo.stars >= 50 && (score.growth >= 50 || score.total >= 50)) {
      return 2;
    }
    
    // Tier 3: Long tail
    return 3;
  }
}
