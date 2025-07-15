import { Octokit } from '@octokit/rest';
import type { 
  Repository, 
  Env, 
  CommitMetrics, 
  ReleaseMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis
} from '../types';
import { globalConnectionPool } from '../utils/connectionPool';
import { PerformanceMonitor } from '../utils/performanceMonitor';
import { githubRateLimiter, githubSearchRateLimiter, withExponentialBackoff } from '../utils/rateLimiter';
import { BaseService } from './base';

export class GitHubEnhancedService extends BaseService {
  private octokit: Octokit;

  constructor(env: Env) {
    super(env);
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
  }

  /**
   * Get commit activity for a repository
   */
  async getCommitActivity(
    owner: string, 
    repo: string, 
    days: number = 30
  ): Promise<CommitMetrics[]> {
    const monitor = new PerformanceMonitor();
    
    return monitor.monitor('getCommitActivity', async () => {
      // Apply rate limiting
      await githubRateLimiter.acquire();
      
      return globalConnectionPool.withConnection(async () => {
        return withExponentialBackoff(async () => {
          try {
            const since = new Date();
            since.setDate(since.getDate() - days);
            
            // Get commit activity stats
            const { data: stats } = await this.octokit.repos.getCommitActivityStats({
              owner,
              repo,
            });

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
            await githubRateLimiter.acquire();

            // Get recent commits for author info
            const { data: commits } = await this.octokit.repos.listCommits({
              owner,
              repo,
              since: since.toISOString(),
              per_page: 100,
            });

      // Process daily metrics
      const dailyMetrics = new Map<string, CommitMetrics>();
      const today = new Date();
      
      // Initialize last N days
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        dailyMetrics.set(dateStr, {
          repo_id: '', // Will be set by caller
          date: dateStr,
          commit_count: 0,
          unique_authors: 0,
          additions: 0,
          deletions: 0,
        });
      }

      // Process commit stats (weekly data from GitHub)
      if (stats && stats.length > 0) {
        const recentWeeks = stats.slice(-Math.ceil(days / 7));
        
        for (const week of recentWeeks) {
          const weekStart = new Date(week.week * 1000);
          
          for (let i = 0; i < 7 && i < week.days.length; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            if (dailyMetrics.has(dateStr)) {
              const metric = dailyMetrics.get(dateStr)!;
              metric.commit_count = week.days[i];
            }
          }
        }
      }

      // Get unique authors from recent commits
      const authorsByDate = new Map<string, Set<string>>();
      
      for (const commit of commits) {
        const date = commit.commit.author?.date;
        if (date) {
          const dateStr = new Date(date).toISOString().split('T')[0];
          if (!authorsByDate.has(dateStr)) {
            authorsByDate.set(dateStr, new Set());
          }
          if (commit.author?.login) {
            authorsByDate.get(dateStr)!.add(commit.author.login);
          }
        }
      }

      // Update unique authors
      for (const [date, authors] of authorsByDate) {
        if (dailyMetrics.has(date)) {
          dailyMetrics.get(date)!.unique_authors = authors.size;
        }
      }

          return Array.from(dailyMetrics.values()).sort((a, b) => 
            b.date.localeCompare(a.date)
          );
          } catch (error) {
            console.error(`Error getting commit activity for ${owner}/${repo}:`, error);
            throw error; // Re-throw for exponential backoff
          }
        });
      });
    }, { timeout: 30000 });
  }

  /**
   * Get release metrics for a repository
   */
  async getReleaseMetrics(
    owner: string,
    repo: string
  ): Promise<ReleaseMetrics[]> {
    // Apply rate limiting
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          const { data: releases } = await this.octokit.repos.listReleases({
            owner,
            repo,
            per_page: 100,
          });

          return releases.map(release => ({
            repo_id: '', // Will be set by caller
            release_id: release.id.toString(),
            tag_name: release.tag_name,
            name: release.name,
            published_at: release.published_at || release.created_at,
            is_prerelease: release.prerelease,
            is_draft: release.draft,
            download_count: release.assets.reduce((sum, asset) => 
              sum + asset.download_count, 0
            ),
            body: release.body || null,
          }));
        } catch (error) {
          console.error(`Error getting releases for ${owner}/${repo}:`, error);
          throw error; // Re-throw for exponential backoff
        }
      });
    });
  }

  /**
   * Get pull request metrics for a repository
   */
  async getPullRequestMetrics(
    owner: string,
    repo: string,
    days: number = 30
  ): Promise<PullRequestMetrics> {
    const monitor = new PerformanceMonitor();
    
    return monitor.monitor('getPullRequestMetrics', async () => {
      // Apply rate limiting
      await githubRateLimiter.acquire();
      
      return globalConnectionPool.withConnection(async () => {
        return withExponentialBackoff(async () => {
          try {
            const since = new Date();
            since.setDate(since.getDate() - days);
            
            const { data: pullRequests } = await this.octokit.pulls.list({
              owner,
              repo,
              state: 'all',
              sort: 'updated',
              direction: 'desc',
              since: since.toISOString(),
              per_page: 100,
            });

      const contributors = new Set<string>();
      let totalReviewComments = 0;
      let mergedPRs = 0;
      let totalMergeTime = 0;
      let mergedWithTime = 0;

      for (const pr of pullRequests) {
        if (pr.user?.login) {
          contributors.add(pr.user.login);
        }

        if (pr.merged_at) {
          mergedPRs++;
          const createdAt = new Date(pr.created_at);
          const mergedAt = new Date(pr.merged_at);
          const mergeTimeHours = (mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          
          if (mergeTimeHours > 0) {
            totalMergeTime += mergeTimeHours;
            mergedWithTime++;
          }
        }

        // Get review comments count
        if (pr.review_comment_url) {
          // For now, we'll estimate review comments
          totalReviewComments += 1;
        }
      }

            return {
              repo_id: '', // Will be set by caller
              period_start: since.toISOString(),
              period_end: new Date().toISOString(),
              total_prs: pullRequests.length,
              merged_prs: mergedPRs,
              avg_time_to_merge_hours: mergedWithTime > 0 
                ? totalMergeTime / mergedWithTime 
                : null,
              unique_contributors: contributors.size,
              avg_review_comments: pullRequests.length > 0
                ? totalReviewComments / pullRequests.length
                : null,
            };
          } catch (error) {
            console.error(`Error getting PR metrics for ${owner}/${repo}:`, error);
            throw error; // Re-throw for exponential backoff
          }
        });
      });
    }, { timeout: 30000 });
  }

  /**
   * Get issue metrics for a repository
   */
  async getIssueMetrics(
    owner: string,
    repo: string,
    days: number = 30
  ): Promise<IssueMetrics> {
    // Apply rate limiting
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          const since = new Date();
          since.setDate(since.getDate() - days);
          
          const { data: issues } = await this.octokit.issues.listForRepo({
            owner,
            repo,
            state: 'all',
            since: since.toISOString(),
            per_page: 100,
          });

      let closedIssues = 0;
      let totalCloseTime = 0;
      let closedWithTime = 0;
      let totalResponseTime = 0;
      let issuesWithResponse = 0;
      let bugIssues = 0;
      let featureIssues = 0;

      // Filter out pull requests
      const realIssues = issues.filter(issue => !issue.pull_request);

      for (const issue of realIssues) {
        // Count issue types by labels
        const labels = issue.labels.map(l => 
          typeof l === 'string' ? l : l.name?.toLowerCase() || ''
        );
        
        if (labels.some(l => l.includes('bug'))) {
          bugIssues++;
        }
        if (labels.some(l => l.includes('feature') || l.includes('enhancement'))) {
          featureIssues++;
        }

        // Calculate close time
        if (issue.closed_at) {
          closedIssues++;
          const createdAt = new Date(issue.created_at);
          const closedAt = new Date(issue.closed_at);
          const closeTimeHours = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          
          if (closeTimeHours > 0) {
            totalCloseTime += closeTimeHours;
            closedWithTime++;
          }
        }

        // Get first response time (would need timeline API for accurate data)
        // For now, we'll estimate based on comments
        if (issue.comments > 0) {
          issuesWithResponse++;
          // Rough estimate: assume first response within 24 hours on average
          totalResponseTime += 24;
        }
      }

          return {
            repo_id: '', // Will be set by caller
            period_start: since.toISOString(),
            period_end: new Date().toISOString(),
            total_issues: realIssues.length,
            closed_issues: closedIssues,
            avg_time_to_close_hours: closedWithTime > 0
              ? totalCloseTime / closedWithTime
              : null,
            avg_time_to_first_response_hours: issuesWithResponse > 0
              ? totalResponseTime / issuesWithResponse
              : null,
            bug_issues: bugIssues,
            feature_issues: featureIssues,
          };
        } catch (error) {
          console.error(`Error getting issue metrics for ${owner}/${repo}:`, error);
          throw error; // Re-throw for exponential backoff
        }
      });
    });
  }

  /**
   * Get star history using GitHub Archive or approximation
   */
  async getStarHistory(
    owner: string,
    repo: string,
    days: number = 30
  ): Promise<StarHistory[]> {
    // Apply rate limiting
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          // Get current star count
          const { data: repoData } = await this.octokit.repos.get({
            owner,
            repo,
          });

      const currentStars = repoData.stargazers_count;
      const history: StarHistory[] = [];

      // For now, we'll create an approximation based on current data
      // In production, you'd want to use GitHub Archive or star-history.com API
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Simple linear approximation for demo
        // In reality, you'd fetch actual historical data
        const daysAgo = i;
        const estimatedStars = Math.floor(currentStars * (1 - (daysAgo * 0.01)));
        const dailyGrowth = i === 0 ? 0 : Math.floor(currentStars * 0.01);
        
        history.push({
          repo_id: '', // Will be set by caller
          date: dateStr,
          star_count: Math.max(0, estimatedStars),
          daily_growth: dailyGrowth,
          weekly_growth_rate: i % 7 === 0 ? 7.0 : null,
        });
      }

          return history.sort((a, b) => b.date.localeCompare(a.date));
        } catch (error) {
          console.error(`Error getting star history for ${owner}/${repo}:`, error);
          throw error; // Re-throw for exponential backoff
        }
      });
    });
  }

  /**
   * Analyze fork network
   */
  async analyzeForkNetwork(
    owner: string,
    repo: string
  ): Promise<ForkAnalysis> {
    // Apply rate limiting
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          const { data: forks } = await this.octokit.repos.listForks({
            owner,
            repo,
            sort: 'stargazers',
            per_page: 100,
          });

      let activeForks = 0;
      let forksAhead = 0;
      let forksWithStars = 0;
      let totalForkStars = 0;

      for (const fork of forks) {
        // Check if fork is active (pushed to recently)
        if (fork.pushed_at) {
          const pushedAt = new Date(fork.pushed_at);
          const daysSincePush = (Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSincePush < 90) {
            activeForks++;
          }
        }

        // Check if fork has stars
        const starCount = fork.stargazers_count || 0;
        if (starCount > 0) {
          forksWithStars++;
          totalForkStars += starCount;
        }

        // Note: To check if fork is ahead, we'd need to compare commits
        // This requires additional API calls, so we'll estimate
        const forkCount = fork.forks_count || 0;
        if (forkCount > 0 || starCount > 10) {
          forksAhead++;
        }
      }

          return {
            repo_id: '', // Will be set by caller
            analysis_date: new Date().toISOString().split('T')[0],
            total_forks: forks.length,
            active_forks: activeForks,
            forks_ahead: forksAhead,
            forks_with_stars: forksWithStars,
            avg_fork_stars: forksWithStars > 0 
              ? totalForkStars / forksWithStars 
              : null,
          };
        } catch (error) {
          console.error(`Error analyzing fork network for ${owner}/${repo}:`, error);
          throw error; // Re-throw for exponential backoff
        }
      });
    });
  }

  /**
   * Comprehensive repository search with multiple strategies
   */
  async searchComprehensive(
    strategies: Array<{ type: string; query: string }>,
    limit: number = 100
  ): Promise<Repository[]> {
    const monitor = new PerformanceMonitor();
    
    return monitor.monitor('searchComprehensive', async () => {
      const allRepos = new Map<string, Repository>();
      
      // Process strategies sequentially to respect rate limits
      for (const strategy of strategies) {
        // Apply search rate limiting for each strategy
        await githubSearchRateLimiter.acquire();
        
        await globalConnectionPool.withConnection(async () => {
          await withExponentialBackoff(async () => {
            try {
              console.log(`Searching with strategy: ${strategy.type} - ${strategy.query}`);
              
              const { data } = await this.octokit.search.repos({
                q: strategy.query,
                sort: 'stars',
                order: 'desc',
                per_page: Math.min(limit, 100),
              });

              for (const repo of data.items) {
                if (!allRepos.has(repo.id.toString())) {
                  allRepos.set(repo.id.toString(), this.mapGitHubRepoToRepository(repo));
                }
              }
            } catch (error) {
              console.error(`Error with search strategy ${strategy.type}:`, error);
              throw error; // Re-throw for exponential backoff
            }
          });
        });
        
        // Small delay between search strategies
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return Array.from(allRepos.values())
        .sort((a, b) => b.stars - a.stars)
        .slice(0, limit);
    }, { timeout: 60000 }); // 60 second timeout for comprehensive search
  }

  /**
   * Map GitHub API response to our Repository type
   */
  private mapGitHubRepoToRepository(repo: any): Repository {
    return {
      id: repo.id.toString(),
      name: repo.name,
      owner: repo.owner.login,
      full_name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      open_issues: repo.open_issues_count,
      language: repo.language,
      topics: repo.topics || [],
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      is_archived: repo.archived,
      is_fork: repo.fork,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch || 'main',
    };
  }
}
