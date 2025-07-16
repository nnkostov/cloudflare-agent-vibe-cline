import { Octokit } from '@octokit/rest';
import type { 
  Repository, 
  RepoMetrics, 
  Contributor, 
  Env,
  CommitMetrics, 
  ReleaseMetrics,
  PullRequestMetrics,
  IssueMetrics,
  StarHistory,
  ForkAnalysis
} from '../types';
import { githubRateLimiter, githubSearchRateLimiter, withExponentialBackoff } from '../utils/simpleRateLimiter';
import { BaseService } from './base';

export class GitHubService extends BaseService {
  private octokit: Octokit;

  constructor(env: Env) {
    super(env);
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
  }

  // ========== Search Operations ==========

  async searchTrendingRepos(
    topics: string[],
    minStars: number = 100,
    languages?: string[],
    limit: number = 100
  ): Promise<Repository[]> {
    // Check rate limit
    if (!await githubSearchRateLimiter.checkLimit()) {
      const waitTime = githubSearchRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const topicQuery = `topic:${topics[0]}`;
        const languageQuery = languages?.length 
          ? ' AND (' + languages.map(l => `language:${l}`).join(' OR ') + ')'
          : '';
        
        const query = `${topicQuery}${languageQuery} stars:>=${minStars}`;
        
        console.log('GitHub search query:', query);

        const response = await this.octokit.search.repos({
          q: query,
          sort: 'stars',
          order: 'desc',
          per_page: limit,
        });

        console.log('GitHub search response:', {
          total_count: response.data.total_count,
          items_returned: response.data.items.length
        });

        return response.data.items.map(this.mapGitHubRepoToRepository);
      } catch (error) {
        console.error('Error searching GitHub repos:', error);
        throw new Error(`Failed to search GitHub repositories: ${error}`);
      }
    });
  }

  async searchRecentHighGrowthRepos(
    days: number = 30,
    minStars: number = 50
  ): Promise<Repository[]> {
    if (!await githubSearchRateLimiter.checkLimit()) {
      const waitTime = githubSearchRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const date = new Date();
        date.setDate(date.getDate() - days);
        const dateString = date.toISOString().split('T')[0];

        const query = `created:>${dateString} stars:>=${minStars} sort:stars-desc`;

        const response = await this.octokit.search.repos({
          q: query,
          sort: 'stars',
          order: 'desc',
          per_page: 100,
        });

        return response.data.items.map(this.mapGitHubRepoToRepository);
      } catch (error) {
        console.error('Error searching recent high-growth repos:', error);
        throw new Error(`Failed to search recent repositories: ${error}`);
      }
    });
  }

  async searchComprehensive(
    strategies: Array<{ type: string; query: string }>,
    limit: number = 100
  ): Promise<Repository[]> {
    const allRepos = new Map<string, Repository>();
    
    for (const strategy of strategies) {
      if (!await githubSearchRateLimiter.checkLimit()) {
        const waitTime = githubSearchRateLimiter.getWaitTime();
        throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
      }
      
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
          throw error;
        }
      });
      
      // Small delay between search strategies
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Array.from(allRepos.values())
      .sort((a, b) => b.stars - a.stars)
      .slice(0, limit);
  }

  // ========== Repository Operations ==========

  async getRepoDetails(owner: string, name: string): Promise<Repository> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const response = await this.octokit.repos.get({
          owner,
          repo: name,
        });

        return this.mapGitHubRepoToRepository(response.data);
      } catch (error) {
        console.error(`Error getting repo details for ${owner}/${name}:`, error);
        throw new Error(`Failed to get repository details: ${error}`);
      }
    });
  }

  async getRepoMetrics(owner: string, name: string): Promise<Partial<RepoMetrics>> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const repo = await this.octokit.repos.get({ owner, repo: name });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!await githubRateLimiter.checkLimit()) {
          const waitTime = githubRateLimiter.getWaitTime();
          throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
        }
        
        const contributors = await this.octokit.repos.listContributors({ 
          owner, 
          repo: name, 
          per_page: 1,
          anon: 'true'
        });

        const contributorsCount = this.extractTotalFromLinkHeader(
          contributors.headers.link
        ) || contributors.data.length;

        return {
          stars: repo.data.stargazers_count,
          forks: repo.data.forks_count,
          open_issues: repo.data.open_issues_count,
          watchers: repo.data.watchers_count,
          contributors: contributorsCount,
        };
      } catch (error) {
        console.error(`Error getting repo metrics for ${owner}/${name}:`, error);
        throw new Error(`Failed to get repository metrics: ${error}`);
      }
    });
  }

  async getReadmeContent(owner: string, name: string): Promise<string> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const response = await this.octokit.repos.getReadme({
          owner,
          repo: name,
        });

        const content = atob(response.data.content);
        return content;
      } catch (error) {
        console.error(`Error getting README for ${owner}/${name}:`, error);
        return '';
      }
    });
  }

  // ========== Contributor Operations ==========

  async getContributors(
    owner: string, 
    name: string, 
    limit: number = 10
  ): Promise<Contributor[]> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const response = await this.octokit.repos.listContributors({
          owner,
          repo: name,
          per_page: limit,
        });

        const contributors: Contributor[] = [];
        
        for (const contrib of response.data) {
          if (!contrib.login) continue;
          
          if (!await githubRateLimiter.checkLimit()) {
            const waitTime = githubRateLimiter.getWaitTime();
            throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
          }
          
          try {
            const userResponse = await this.octokit.users.getByUsername({
              username: contrib.login,
            });

            contributors.push({
              username: contrib.login,
              contributions: contrib.contributions || 0,
              profile_url: contrib.html_url || '',
              company: userResponse.data.company,
              location: userResponse.data.location,
              bio: userResponse.data.bio,
              followers: userResponse.data.followers,
              following: userResponse.data.following,
              public_repos: userResponse.data.public_repos,
            });
          } catch (error) {
            // If user details fail, return basic info
            contributors.push({
              username: contrib.login,
              contributions: contrib.contributions || 0,
              profile_url: contrib.html_url || '',
              company: null,
              location: null,
              bio: null,
              followers: 0,
              following: 0,
              public_repos: 0,
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        return contributors;
      } catch (error) {
        console.error(`Error getting contributors for ${owner}/${name}:`, error);
        throw new Error(`Failed to get contributors: ${error}`);
      }
    });
  }

  // ========== Enhanced Metrics Operations ==========

  async getCommitActivity(
    owner: string, 
    repo: string, 
    days: number = 30
  ): Promise<CommitMetrics[]> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - days);
        
        const { data: stats } = await this.octokit.repos.getCommitActivityStats({
          owner,
          repo,
        });

        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!await githubRateLimiter.checkLimit()) {
          const waitTime = githubRateLimiter.getWaitTime();
          throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
        }

        const { data: commits } = await this.octokit.repos.listCommits({
          owner,
          repo,
          since: since.toISOString(),
          per_page: 100,
        });

        // Process daily metrics
        const dailyMetrics = new Map<string, CommitMetrics>();
        const today = new Date();
        
        for (let i = 0; i < days; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          dailyMetrics.set(dateStr, {
            repo_id: '',
            date: dateStr,
            commit_count: 0,
            unique_authors: 0,
            additions: 0,
            deletions: 0,
          });
        }

        // Process commit stats
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

        // Get unique authors
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
        throw error;
      }
    });
  }

  async getReleaseMetrics(
    owner: string,
    repo: string
  ): Promise<ReleaseMetrics[]> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const { data: releases } = await this.octokit.repos.listReleases({
          owner,
          repo,
          per_page: 100,
        });

        return releases.map(release => ({
          repo_id: '',
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
        throw error;
      }
    });
  }

  async getPullRequestMetrics(
    owner: string,
    repo: string,
    days: number = 30
  ): Promise<PullRequestMetrics> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
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

          if (pr.review_comment_url) {
            totalReviewComments += 1;
          }
        }

        return {
          repo_id: '',
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
        throw error;
      }
    });
  }

  async getIssueMetrics(
    owner: string,
    repo: string,
    days: number = 30
  ): Promise<IssueMetrics> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
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

        const realIssues = issues.filter(issue => !issue.pull_request);

        for (const issue of realIssues) {
          const labels = issue.labels.map(l => 
            typeof l === 'string' ? l : l.name?.toLowerCase() || ''
          );
          
          if (labels.some(l => l.includes('bug'))) {
            bugIssues++;
          }
          if (labels.some(l => l.includes('feature') || l.includes('enhancement'))) {
            featureIssues++;
          }

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

          if (issue.comments > 0) {
            issuesWithResponse++;
            totalResponseTime += 24; // Estimate
          }
        }

        return {
          repo_id: '',
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
        throw error;
      }
    });
  }

  async getStarHistory(
    owner: string,
    repo: string,
    days: number = 30
  ): Promise<StarHistory[]> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return withExponentialBackoff(async () => {
      try {
        const { data: repoData } = await this.octokit.repos.get({
          owner,
          repo,
        });

        const currentStars = repoData.stargazers_count;
        const history: StarHistory[] = [];
        const today = new Date();
        
        for (let i = 0; i < days; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const daysAgo = i;
          const estimatedStars = Math.floor(currentStars * (1 - (daysAgo * 0.01)));
          const dailyGrowth = i === 0 ? 0 : Math.floor(currentStars * 0.01);
          
          history.push({
            repo_id: '',
            date: dateStr,
            star_count: Math.max(0, estimatedStars),
            daily_growth: dailyGrowth,
            weekly_growth_rate: i % 7 === 0 ? 7.0 : null,
          });
        }

        return history.sort((a, b) => b.date.localeCompare(a.date));
      } catch (error) {
        console.error(`Error getting star history for ${owner}/${repo}:`, error);
        throw error;
      }
    });
  }

  async analyzeForkNetwork(
    owner: string,
    repo: string
  ): Promise<ForkAnalysis> {
    if (!await githubRateLimiter.checkLimit()) {
      const waitTime = githubRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
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
          if (fork.pushed_at) {
            const pushedAt = new Date(fork.pushed_at);
            const daysSincePush = (Date.now() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
            
            if (daysSincePush < 90) {
              activeForks++;
            }
          }

          const starCount = fork.stargazers_count || 0;
          if (starCount > 0) {
            forksWithStars++;
            totalForkStars += starCount;
          }

          const forkCount = fork.forks_count || 0;
          if (forkCount > 0 || starCount > 10) {
            forksAhead++;
          }
        }

        return {
          repo_id: '',
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
        throw error;
      }
    });
  }

  // ========== Utility Operations ==========

  async checkRateLimit(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
    internalStatus: {
      general: any;
      search: any;
    };
  }> {
    try {
      const response = await this.octokit.rateLimit.get();
      const core = response.data.rate;

      return {
        remaining: core.remaining,
        reset: new Date(core.reset * 1000),
        limit: core.limit,
        internalStatus: {
          general: githubRateLimiter.getStatus(),
          search: githubSearchRateLimiter.getStatus(),
        },
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw new Error(`Failed to check rate limit: ${error}`);
    }
  }

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

  private extractTotalFromLinkHeader(linkHeader?: string): number | null {
    if (!linkHeader) return null;

    const matches = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (matches && matches[1]) {
      return parseInt(matches[1], 10);
    }

    return null;
  }
}
