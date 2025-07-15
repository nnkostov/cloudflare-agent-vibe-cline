import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeService } from '../services/claude';
import { RepoAnalyzer } from '../analyzers/repoAnalyzer';
import type { Repository, Env } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Claude 4 Integration Tests', () => {
  let claudeService: ClaudeService;
  let repoAnalyzer: RepoAnalyzer;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      DB: {} as any,
      STORAGE: {} as any,
      GITHUB_AGENT: {} as any,
      GITHUB_TOKEN: 'test-github-token',
      ANTHROPIC_API_KEY: 'test-anthropic-key'
    };
    
    claudeService = new ClaudeService(mockEnv);
    repoAnalyzer = new RepoAnalyzer(mockEnv);
    vi.clearAllMocks();
  });

  describe('End-to-End Analysis Flow', () => {
    it('should analyze high-scoring repository with claude-opus-4', async () => {
      // Create a high-scoring repository
      const highScoringRepo: Repository = {
        id: 'langchain-123',
        name: 'langchain',
        owner: 'langchain-ai',
        full_name: 'langchain-ai/langchain',
        description: 'Building applications with LLMs through composability',
        stars: 50000,
        forks: 10000,
        open_issues: 500,
        language: 'Python',
        topics: ['ai', 'llm', 'agents', 'machine-learning', 'artificial-intelligence'],
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        pushed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        is_archived: false,
        is_fork: false,
        html_url: 'https://github.com/langchain-ai/langchain',
        clone_url: 'https://github.com/langchain-ai/langchain.git',
        default_branch: 'main'
      };

      const readme = `# LangChain
      
Building applications with LLMs through composability

## What is LangChain?

LangChain is a framework for developing applications powered by language models. It enables applications that:
- Are context-aware: connect a language model to sources of context
- Reason: rely on a language model to reason about how to answer

## Main Features

- Components: abstractions for working with language models
- Off-the-shelf chains: structured assembly of components
- Data Augmented Generation: interact with external data sources
- Agents: let LLMs make decisions about which tools to use
- Memory: persist state between calls of a chain/agent
- Evaluation: generative models are hard to evaluate with traditional metrics`;

      // Step 1: Calculate score
      const score = await repoAnalyzer.analyze(highScoringRepo);
      expect(score.total).toBeGreaterThanOrEqual(70);

      // Step 2: Get recommended model
      const recommendedModel = repoAnalyzer.getRecommendedModel(score);
      expect(recommendedModel).toBe('claude-opus-4');

      // Step 3: Mock Claude API response for opus-4
      const mockClaudeResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            scores: {
              investment: 92,
              innovation: 95,
              team: 88,
              market: 90,
              technical_moat: 93,
              scalability: 91,
              developer_adoption: 94
            },
            recommendation: 'strong-buy',
            summary: 'LangChain is a pioneering framework in the LLM application space with exceptional growth and adoption.',
            strengths: [
              'First-mover advantage in LLM orchestration',
              'Strong developer community',
              'Comprehensive tooling ecosystem'
            ],
            risks: [
              'Competition from major cloud providers',
              'Rapid technology evolution'
            ],
            questions: [
              'What is the monetization strategy?',
              'How will you maintain competitive advantage?'
            ],
            growth_prediction: 'Expected 15x growth in 12 months based on current adoption trajectory',
            investment_thesis: 'Category-defining platform with strong network effects and developer mindshare',
            competitive_analysis: 'Leading position with 3x more GitHub stars than nearest competitor'
          })
        }],
        usage: { input_tokens: 2000, output_tokens: 800 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse
      });

      // Step 4: Analyze with Claude
      const analysis = await claudeService.analyzeRepository(highScoringRepo, readme, recommendedModel);

      // Verify the complete flow
      expect(analysis.scores.investment).toBe(92);
      expect(analysis.scores.technical_moat).toBe(93);
      expect(analysis.recommendation).toBe('strong-buy');
      expect(analysis.growth_prediction).toBe('Expected 15x growth in 12 months based on current adoption trajectory');
      expect(analysis.metadata.model).toBe('claude-opus-4');
      expect(analysis.metadata.cost).toBeCloseTo(0.003, 3); // 800 output tokens at $3.75/M
    });

    it('should analyze medium-scoring repository with claude-sonnet-4', async () => {
      // Create a medium-scoring repository
      const mediumScoringRepo: Repository = {
        id: 'ai-tool-456',
        name: 'ai-assistant',
        owner: 'startup-ai',
        full_name: 'startup-ai/ai-assistant',
        description: 'An AI-powered coding assistant',
        stars: 2000,
        forks: 400,
        open_issues: 50,
        language: 'TypeScript',
        topics: ['ai', 'assistant', 'developer-tools'],
        created_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        pushed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_archived: false,
        is_fork: false,
        html_url: 'https://github.com/startup-ai/ai-assistant',
        clone_url: 'https://github.com/startup-ai/ai-assistant.git',
        default_branch: 'main'
      };

      const readme = '# AI Assistant\n\nA coding assistant powered by AI.';

      // Step 1: Calculate score
      const score = await repoAnalyzer.analyze(mediumScoringRepo);
      expect(score.total).toBeGreaterThanOrEqual(50);
      expect(score.total).toBeLessThanOrEqual(80);

      // Step 2: Get recommended model
      const recommendedModel = repoAnalyzer.getRecommendedModel(score);
      expect(recommendedModel).toBe('claude-sonnet-4');

      // Step 3: Mock Claude API response for sonnet-4
      const mockClaudeResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            scores: {
              investment: 65,
              innovation: 70,
              team: 60,
              market: 68,
              technical_moat: 62,
              scalability: 66,
              developer_adoption: 64
            },
            recommendation: 'buy',
            summary: 'Solid AI coding assistant with good growth potential.',
            strengths: ['Growing user base', 'Active development'],
            risks: ['Crowded market', 'Limited differentiation'],
            questions: ['What makes this unique?'],
            growth_prediction: 'Steady 3x growth expected',
            investment_thesis: 'Worth watching as the market develops',
            competitive_analysis: 'Mid-tier player with room to grow'
          })
        }],
        usage: { input_tokens: 1000, output_tokens: 400 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse
      });

      // Step 4: Analyze with Claude
      const analysis = await claudeService.analyzeRepository(mediumScoringRepo, readme, recommendedModel);

      // Verify the complete flow
      expect(analysis.scores.investment).toBe(65);
      expect(analysis.recommendation).toBe('buy');
      expect(analysis.metadata.model).toBe('claude-sonnet-4');
      expect(analysis.metadata.cost).toBeCloseTo(0.0012, 3); // 400 output tokens at $3/M
    });

    it('should analyze low-scoring repository with claude-3-haiku', async () => {
      // Create a low-scoring repository
      const lowScoringRepo: Repository = {
        id: 'small-project-789',
        name: 'ml-experiment',
        owner: 'individual-dev',
        full_name: 'individual-dev/ml-experiment',
        description: 'Personal ML experiments',
        stars: 50,
        forks: 5,
        open_issues: 2,
        language: 'Python',
        topics: ['machine-learning'],
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        pushed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        is_archived: false,
        is_fork: false,
        html_url: 'https://github.com/individual-dev/ml-experiment',
        clone_url: 'https://github.com/individual-dev/ml-experiment.git',
        default_branch: 'main'
      };

      const readme = '# ML Experiment\n\nTesting various ML algorithms.';

      // Step 1: Calculate score
      const score = await repoAnalyzer.analyze(lowScoringRepo);
      expect(score.total).toBeLessThanOrEqual(60);

      // Step 2: Get recommended model
      const recommendedModel = repoAnalyzer.getRecommendedModel(score);
      expect(recommendedModel).toBe('claude-3-haiku-20240307');

      // Step 3: Mock Claude API response for haiku
      const mockClaudeResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            scores: {
              investment: 30,
              innovation: 35,
              team: 25,
              market: 30
            },
            recommendation: 'pass',
            summary: 'Early-stage personal project with limited commercial potential.',
            strengths: ['Learning project'],
            risks: ['No clear path to commercialization'],
            questions: ['Is this intended as a product?']
          })
        }],
        usage: { input_tokens: 500, output_tokens: 200 }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClaudeResponse
      });

      // Step 4: Analyze with Claude
      const analysis = await claudeService.analyzeRepository(lowScoringRepo, readme, recommendedModel);

      // Verify the complete flow
      expect(analysis.scores.investment).toBe(30);
      expect(analysis.recommendation).toBe('pass');
      expect(analysis.metadata.model).toBe('claude-3-haiku-20240307');
      expect(analysis.metadata.cost).toBeCloseTo(0.00005, 5); // ~200 tokens at $0.25/M
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully in the full flow', async () => {
      const repo: Repository = {
        id: 'test-123',
        name: 'test-repo',
        owner: 'test-owner',
        full_name: 'test-owner/test-repo',
        description: 'Test repository',
        stars: 5000,
        forks: 1000,
        open_issues: 100,
        language: 'TypeScript',
        topics: ['ai', 'ml'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-01T00:00:00Z',
        is_archived: false,
        is_fork: false,
        html_url: 'https://github.com/test-owner/test-repo',
        clone_url: 'https://github.com/test-owner/test-repo.git',
        default_branch: 'main'
      };

      const score = await repoAnalyzer.analyze(repo);
      const model = repoAnalyzer.getRecommendedModel(score);

      // Mock API error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      await expect(
        claudeService.analyzeRepository(repo, 'README content', model)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Model Selection Edge Cases', () => {
    it('should use claude-opus-4 for high growth score even with lower total score', async () => {
      const rapidGrowthRepo: Repository = {
        id: 'rapid-growth',
        name: 'new-ai-framework',
        owner: 'hot-startup',
        full_name: 'hot-startup/new-ai-framework',
        description: 'Revolutionary AI framework',
        stars: 3000,
        forks: 600,
        open_issues: 100,
        language: 'Python',
        topics: ['ai', 'llm', 'agents'],
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days old
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        pushed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        is_archived: false,
        is_fork: false,
        html_url: 'https://github.com/hot-startup/new-ai-framework',
        clone_url: 'https://github.com/hot-startup/new-ai-framework.git',
        default_branch: 'main'
      };

      const score = await repoAnalyzer.analyze(rapidGrowthRepo);
      const model = repoAnalyzer.getRecommendedModel(score);

      expect(score.growth).toBeGreaterThanOrEqual(80);
      expect(model).toBe('claude-opus-4');
    });
  });
});
