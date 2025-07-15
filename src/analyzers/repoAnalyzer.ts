import type { Repository, Score, Env, SCORING } from '../types';
import { BaseService } from '../services/base';
import { SCORING as ScoringConfig } from '../types';

export class RepoAnalyzer extends BaseService {
  /**
   * Analyze a repository and calculate scores
   */
  async analyze(repo: Repository): Promise<Score> {
    const factors = await this.calculateFactors(repo);
    
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
   * Calculate all scoring factors
   */
  private async calculateFactors(repo: Repository) {
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
  getRecommendedModel(score: Score): 'claude-3-opus-20240229' | 'claude-3-sonnet-20240229' | 'claude-3-haiku-20240307' {
    if (score.total >= ScoringConfig.thresholds.veryHigh || score.growth >= 90) {
      return 'claude-3-opus-20240229';
    } else if (score.total >= ScoringConfig.thresholds.highPotential) {
      return 'claude-3-sonnet-20240229';
    }
    return 'claude-3-haiku-20240307';
  }
}
