import type { Env, Repository } from '../types';
import { StorageService } from './storage';

export class StorageServiceFixed extends StorageService {
  constructor(env: Env) {
    super(env);
  }

  /**
   * Get high growth repos with fallback to all repos when insufficient data
   */
  async getHighGrowthRepos(days: number = 30, minGrowthPercent: number = 200): Promise<Repository[]> {
    // First try to get repos with growth metrics
    const growthRepos = await super.getHighGrowthRepos(days, minGrowthPercent);
    
    if (growthRepos.length > 0) {
      return growthRepos;
    }
    
    // If no growth repos found (likely due to insufficient historical data),
    // return all repos sorted by stars
    console.log('No growth data available, returning all repos sorted by stars');
    
    const allRepos = await this.dbAll<any>(`
      SELECT * FROM repositories 
      WHERE is_archived = 0 AND is_fork = 0
      ORDER BY stars DESC 
      LIMIT 50
    `);
    
    return allRepos.map((row: any) => ({
      ...row,
      topics: JSON.parse(row.topics || '[]'),
      is_archived: Boolean(row.is_archived),
      is_fork: Boolean(row.is_fork),
    }));
  }

  /**
   * Get all repositories (for dashboard overview)
   */
  async getAllRepositories(limit: number = 100): Promise<Repository[]> {
    const results = await this.dbAll<any>(`
      SELECT * FROM repositories 
      WHERE is_archived = 0 AND is_fork = 0
      ORDER BY stars DESC 
      LIMIT ?
    `, limit);
    
    return results.map((row: any) => ({
      ...row,
      topics: JSON.parse(row.topics || '[]'),
      is_archived: Boolean(row.is_archived),
      is_fork: Boolean(row.is_fork),
    }));
  }

  /**
   * Get repository count
   */
  async getRepositoryCount(): Promise<number> {
    const result = await this.dbFirst<{ count: number }>(`
      SELECT COUNT(*) as count FROM repositories 
      WHERE is_archived = 0 AND is_fork = 0
    `);
    return result?.count || 0;
  }
}
