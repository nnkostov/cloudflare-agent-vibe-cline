import { describe, it, expect } from 'vitest';
import { RepoAnalyzer } from './repoAnalyzer';
import type { Repository, Env, Score } from '../types';

describe('RepoAnalyzer', () => {
  const mockEnv: Env = {
    DB: {} as any,
    STORAGE: {} as any,
    GITHUB_AGENT: {} as any,
    GITHUB_TOKEN: 'test-token',
    ANTHROPIC_API_KEY: 'test-key'
  };
  
  const analyzer = new RepoAnalyzer(mockEnv);

  const createMockRepo = (overrides: Partial<Repository> = {}): Repository => ({
    id: 'test-123',
    name: 'test-repo',
    owner: 'test-owner',
    full_name: 'test-owner/test-repo',
    description: 'A test repository',
    stars: 1000,
    forks: 200,
    open_issues: 50,
    language: 'TypeScript',
    topics: ['ai', 'ml'],
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pushed_at: '2024-01-01T00:00:00Z',
    is_archived: false,
    is_fork: false,
    html_url: 'https://github.com/test-owner/test-repo',
    clone_url: 'https://github.com/test-owner/test-repo.git',
    default_branch: 'main',
    ...overrides
  });


  describe('getRecommendedModel', () => {
    it('should return claude-opus-4 for high-scoring repositories', async () => {
      const repo = createMockRepo({ stars: 10000, forks: 2000 });
      const score = await analyzer.analyze(repo);
      
      const model = analyzer.getRecommendedModel(score);
      expect(model).toBe('claude-opus-4');
    });

    it('should return claude-opus-4 for score exactly 70', async () => {
      // Create a repo that will score around 70
      const repo = createMockRepo({ 
        stars: 3000, 
        forks: 600,
        topics: ['ai', 'machine-learning', 'deep-learning']
      });
      
      const score = await analyzer.analyze(repo);
      const model = analyzer.getRecommendedModel(score);
      
      // Verify the score is around 70
      expect(score.total).toBeGreaterThanOrEqual(68);
      expect(score.total).toBeLessThanOrEqual(72);
      expect(model).toBe('claude-opus-4');
    });

    it('should return claude-sonnet-4 for medium-scoring repositories', async () => {
      const repo = createMockRepo({ stars: 1000, forks: 200 });
      
      const score = await analyzer.analyze(repo);
      const model = analyzer.getRecommendedModel(score);
      
      expect(score.total).toBeGreaterThanOrEqual(50);
      expect(score.total).toBeLessThan(70);
      expect(model).toBe('claude-sonnet-4');
    });

    it('should return claude-sonnet-4 for score exactly 50', async () => {
      const repo = createMockRepo({ 
        stars: 500, 
        forks: 100,
        topics: ['ai']
      });
      
      const score = await analyzer.analyze(repo);
      const model = analyzer.getRecommendedModel(score);
      
      // Verify the score is around 50
      expect(score.total).toBeGreaterThanOrEqual(48);
      expect(score.total).toBeLessThanOrEqual(52);
      expect(model).toBe('claude-sonnet-4');
    });

    it('should return claude-3-haiku-20240307 for low-scoring repositories', async () => {
      const repo = createMockRepo({ 
        stars: 100, 
        forks: 10,
        topics: []
      });
      
      const score = await analyzer.analyze(repo);
      const model = analyzer.getRecommendedModel(score);
      
      expect(score.total).toBeLessThan(50);
      expect(model).toBe('claude-3-haiku-20240307');
    });

    it('should return claude-opus-4 for high growth score regardless of total score', async () => {
      const repo = createMockRepo({ 
        stars: 2000, 
        forks: 400,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days old
      });
      
      const score = await analyzer.analyze(repo);
      const model = analyzer.getRecommendedModel(score);
      
      expect(score.growth).toBeGreaterThanOrEqual(80);
      expect(model).toBe('claude-opus-4');
    });
  });

  describe('analyze', () => {
    it('should calculate correct score weights', async () => {
      const repo = createMockRepo();
      
      const score = await analyzer.analyze(repo);
      
      expect(score).toHaveProperty('total');
      expect(score).toHaveProperty('growth');
      expect(score).toHaveProperty('engagement');
      expect(score).toHaveProperty('quality');
      expect(score).toHaveProperty('factors');
      
      // Verify total is weighted sum
      const expectedTotal = Math.round(
        score.growth * 0.4 + 
        score.engagement * 0.3 + 
        score.quality * 0.3
      );
      expect(score.total).toBe(expectedTotal);
    });

    it('should handle edge cases gracefully', async () => {
      const repo = createMockRepo({
        stars: 0,
        forks: 0,
        open_issues: 0,
        topics: [],
        created_at: new Date().toISOString()
      });
      
      const score = await analyzer.analyze(repo);
      
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(score.growth).toBeGreaterThanOrEqual(0);
      expect(score.engagement).toBeGreaterThanOrEqual(0);
      expect(score.quality).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isHighPotential', () => {
    it('should identify high potential repositories', async () => {
      const repo = createMockRepo({ stars: 5000, forks: 1000 });
      const score = await analyzer.analyze(repo);
      
      const result = analyzer.isHighPotential(score);
      
      expect(result).toBe(true);
    });

    it('should identify low potential repositories', async () => {
      const repo = createMockRepo({ stars: 50, forks: 5 });
      const score = await analyzer.analyze(repo);
      
      const result = analyzer.isHighPotential(score);
      
      expect(result).toBe(false);
    });

    it('should consider growth rate for newer repositories', async () => {
      const repo = createMockRepo({ 
        stars: 1000,
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days old
      });
      
      const score = await analyzer.analyze(repo);
      const result = analyzer.isHighPotential(score);
      
      expect(score.growth).toBeGreaterThan(60); // High growth
      expect(result).toBe(true);
    });
  });

  describe('scoring factors', () => {
    it('should boost score for AI-related topics', async () => {
      const repoWithAI = createMockRepo({ 
        topics: ['artificial-intelligence', 'machine-learning', 'deep-learning', 'llm', 'agents'] 
      });
      const repoWithoutAI = createMockRepo({ 
        topics: ['javascript', 'web'] 
      });
      
      const scoreWithAI = await analyzer.analyze(repoWithAI);
      const scoreWithoutAI = await analyzer.analyze(repoWithoutAI);
      
      expect(scoreWithAI.engagement).toBeGreaterThan(scoreWithoutAI.engagement);
    });

    it('should consider repository age in growth calculation', async () => {
      const newRepo = createMockRepo({ 
        stars: 1000,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });
      const oldRepo = createMockRepo({ 
        stars: 1000,
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
      });
      
      const newScore = await analyzer.analyze(newRepo);
      const oldScore = await analyzer.analyze(oldRepo);
      
      expect(newScore.growth).toBeGreaterThan(oldScore.growth);
    });

    it('should value documentation and language', async () => {
      const withQuality = createMockRepo({
        description: 'This is a comprehensive AI/ML library with extensive documentation and examples',
        topics: ['ai', 'ml', 'documentation', 'examples'],
        language: 'Python'
      });
      const withoutQuality = createMockRepo({
        description: 'Test',
        topics: [],
        language: 'Unknown'
      });
      
      const goodScore = await analyzer.analyze(withQuality);
      const poorScore = await analyzer.analyze(withoutQuality);
      
      expect(goodScore.quality).toBeGreaterThan(poorScore.quality);
    });
  });
});
