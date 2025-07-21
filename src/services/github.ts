import { Octokit } from '@octokit/rest';
import type { Repository, RepoMetrics, Contributor, Env } from '../types';
import { globalConnectionPool } from '../utils/connectionPool';
import { PerformanceMonitor } from '../utils/performanceMonitor';
import { githubRateLimiter, githubSearchRateLimiter, withExponentialBackoff } from '../utils/rateLimiter';
import { BaseService } from './base';

export class GitHubService extends BaseService {
  private octokit: Octokit;

  constructor(env: Env) {
    super(env);
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
  }

  /**
   * Search for trending repositories based on topics and criteria
   */
  async searchTrendingRepos(
    topics: string[],
    minStars: number = 100,
    languages?: string[],
    limit: number = 30
  ): Promise<Repository[]> {
    const monitor = new PerformanceMonitor();
    
    return monitor.monitor('searchTrendingRepos', async () => {
      // Apply search rate limiting
      await githubSearchRateLimiter.acquire();
      
      return globalConnectionPool.withConnection(async () => {
        return withExponentialBackoff(async () => {
          try {
            // Build search query - try a simpler approach
            // GitHub search doesn't like complex OR queries, so let's search for the first topic only
            const topicQuery = `topic:${topics[0]}`;
            const languageQuery = languages?.length 
              ? ' AND (' + languages.map(l => `language:${l}`).join(' OR ') + ')'
              : '';
            
            // Don't include sort in the query string - it's a separate parameter
            const query = `${topicQuery}${languageQuery} stars:>=${minStars}`;
            
            console.log('GitHub search query:', query);
            console.log('GitHub token present:', !!this.env.GITHUB_TOKEN);
            console.log('[API CALL] GitHub Search API - searchTrendingRepos');

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
      });
    }, { timeout: 30000 });
  }

  /**
   * Get detailed repository information
   */
  async getRepoDetails(owner: string, name: string): Promise<Repository> {
    // Apply rate limiting
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          console.log(`[API CALL] GitHub API - getRepoDetails for ${owner}/${name}`);
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
    });
  }

  /**
   * Get repository metrics including contributors count
   */
  async getRepoMetrics(owner: string, name: string): Promise<Partial<RepoMetrics>> {
    // Apply rate limiting for both requests
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          // Make requests sequentially to respect rate limits
          console.log(`[API CALL] GitHub API - getRepoMetrics for ${owner}/${name}`);
          const repo = await this.octokit.repos.get({ owner, repo: name });
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 100));
          await githubRateLimiter.acquire();
          
          console.log(`[API CALL] GitHub API - listContributors for ${owner}/${name}`);
          const contributors = await this.octokit.repos.listContributors({ 
            owner, 
            repo: name, 
            per_page: 1,
            anon: 'true'
          });

          // Get total contributors from Link header
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
    });
  }

  /**
   * Get top contributors for a repository
   */
  async getContributors(
    owner: string, 
    name: string, 
    limit: number = 10
  ): Promise<Contributor[]> {
    const monitor = new PerformanceMonitor();
    
    return monitor.monitor('getContributors', async () => {
      // Apply rate limiting
      await githubRateLimiter.acquire();
      
      return globalConnectionPool.withConnection(async () => {
        return withExponentialBackoff(async () => {
          try {
            console.log(`[API CALL] GitHub API - getContributors for ${owner}/${name}`);
            const response = await this.octokit.repos.listContributors({
              owner,
              repo: name,
              per_page: limit,
            });

            // Process contributors sequentially to respect rate limits
            const contributors: (Contributor | null)[] = [];
            
            for (const contrib of response.data) {
              if (!contrib.login) {
                contributors.push(null);
                continue;
              }
              
              // Rate limit each user lookup
              await githubRateLimiter.acquire();
              
              const contributor = await globalConnectionPool.withConnection(async () => {
                return withExponentialBackoff(async () => {
                  try {
                    console.log(`[API CALL] GitHub API - getByUsername for ${contrib.login}`);
                    const userResponse = await this.octokit.users.getByUsername({
                      username: contrib.login!,
                    });

                    return {
                      username: contrib.login!,
                      contributions: contrib.contributions || 0,
                      profile_url: contrib.html_url || '',
                      company: userResponse.data.company,
                      location: userResponse.data.location,
                      bio: userResponse.data.bio,
                      followers: userResponse.data.followers,
                      following: userResponse.data.following,
                      public_repos: userResponse.data.public_repos,
                    };
                  } catch (error) {
                    // If user details fail, return basic info
                    return {
                      username: contrib.login!,
                      contributions: contrib.contributions || 0,
                      profile_url: contrib.html_url || '',
                      company: null,
                      location: null,
                      bio: null,
                      followers: 0,
                      following: 0,
                      public_repos: 0,
                    };
                  }
                });
              });
              
              contributors.push(contributor);
              
              // Small delay between user lookups
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            return contributors.filter((c): c is Contributor => c !== null);
          } catch (error) {
            console.error(`Error getting contributors for ${owner}/${name}:`, error);
            throw new Error(`Failed to get contributors: ${error}`);
          }
        });
      });
    }, { timeout: 60000 }); // 60 second timeout for contributor fetching
  }

  /**
   * Search repositories created in the last N days with high growth
   */
  async searchRecentHighGrowthRepos(
    days: number = 30,
    minStars: number = 50
  ): Promise<Repository[]> {
    // Apply search rate limiting
    await githubSearchRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          const date = new Date();
          date.setDate(date.getDate() - days);
          const dateString = date.toISOString().split('T')[0];

          const query = `created:>${dateString} stars:>=${minStars} sort:stars-desc`;

          console.log('[API CALL] GitHub Search API - searchRecentHighGrowthRepos');
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
    });
  }

  /**
   * Get repository README content
   */
  async getReadmeContent(owner: string, name: string): Promise<string> {
    // Apply rate limiting
    await githubRateLimiter.acquire();
    
    return globalConnectionPool.withConnection(async () => {
      return withExponentialBackoff(async () => {
        try {
          console.log(`[API CALL] GitHub API - getReadme for ${owner}/${name}`);
          const response = await this.octokit.repos.getReadme({
            owner,
            repo: name,
          });

          // Decode base64 content using Web API
          const content = atob(response.data.content);
          return content;
        } catch (error) {
          console.error(`Error getting README for ${owner}/${name}:`, error);
          return '';
        }
      });
    });
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

  /**
   * Extract total count from GitHub Link header
   */
  private extractTotalFromLinkHeader(linkHeader?: string): number | null {
    if (!linkHeader) return null;

    const matches = linkHeader.match(/page=(\d+)>; rel="last"/);
    if (matches && matches[1]) {
      return parseInt(matches[1], 10);
    }

    return null;
  }

  /**
   * Check rate limit status
   */
  async checkRateLimit(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
    internalStatus: {
      general: any;
      search: any;
    };
  }> {
    // Don't rate limit the rate limit check itself
    return globalConnectionPool.withConnection(async () => {
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
    });
  }
}
