import type { Repository, Analysis, ClaudeModel, Env, CONFIG } from '../types';
import { BaseService } from './base';
import { CONFIG as Config } from '../types';
import { claudeRateLimiter, withExponentialBackoff } from '../utils/simpleRateLimiter';

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
  model?: string;
}

export class ClaudeService extends BaseService {
  private apiUrl = 'https://api.anthropic.com/v1/messages';

  /**
   * Analyze a repository using Claude
   */
  async analyzeRepository(
    repo: Repository,
    readme: string,
    model: ClaudeModel = 'claude-sonnet-4-20250514'
  ): Promise<Analysis> {
    // Check rate limit
    if (!await claudeRateLimiter.checkLimit()) {
      const waitTime = claudeRateLimiter.getWaitTime();
      throw new Error(`Rate limit exceeded. Please wait ${waitTime}ms`);
    }
    
    return this.handleError(async () => {
      const isEnhancedModel = this.isClaudeV4Model(model);
      const prompt = isEnhancedModel && Config.claude.enhancedAnalysis
        ? this.buildEnhancedPrompt(repo, readme)
        : this.buildPrompt(repo, readme);
      
      console.log(`[API CALL] Claude API - analyzeRepository with model ${model}`);
      const response = await this.callClaude(prompt, model);
      return this.parseResponse(response, repo.id, model);
    }, `analyze repository ${repo.full_name}`);
  }

  /**
   * Check if model is Claude 3.5 Sonnet (latest generation)
   */
  private isClaudeV4Model(model: ClaudeModel): boolean {
    return model === 'claude-opus-4-20250514' || model === 'claude-sonnet-4-20250514' || 
           model === 'claude-3-5-sonnet-20241022' || model === 'claude-3-5-sonnet-20240620';
  }

  /**
   * Build analysis prompt
   */
  private buildPrompt(repo: Repository, readme: string): string {
    return `You are a venture capital analyst specializing in AI/ML investments. Analyze this GitHub repository:

Repository: ${repo.full_name}
Stars: ${repo.stars} | Forks: ${repo.forks} | Language: ${repo.language || 'N/A'}
Created: ${repo.created_at} | Updated: ${repo.updated_at}
Topics: ${repo.topics.join(', ') || 'None'}
Description: ${repo.description || 'No description'}

README (first 5000 chars):
${readme.substring(0, 5000)}${readme.length > 5000 ? '...' : ''}

Provide ONLY a valid JSON response with this exact structure (no additional text before or after):
{
  "scores": {
    "investment": <0-100>,
    "innovation": <0-100>,
    "team": <0-100>,
    "market": <0-100>
  },
  "recommendation": "<strong-buy|buy|watch|pass>",
  "summary": "<2-3 paragraph executive summary>",
  "strengths": ["<key strength 1>", "<key strength 2>", ...],
  "risks": ["<risk 1>", "<risk 2>", ...],
  "questions": ["<due diligence question 1>", "<question 2>", ...]
}

Important: Ensure all string values are properly escaped for JSON. Focus on: technical innovation, team quality, market opportunity, scalability, and competitive advantages.
Be critical - only exceptional projects should score above 80.`;
  }

  /**
   * Build enhanced prompt for Claude-4 models
   */
  private buildEnhancedPrompt(repo: Repository, readme: string): string {
    const readmeChars = this.isClaudeV4Model(Config.claude.models.high) ? 10000 : 5000;
    
    return `You are a senior venture capital partner at a top-tier AI/ML investment firm. Perform a comprehensive deep-dive analysis of this GitHub repository:

Repository: ${repo.full_name}
Stars: ${repo.stars} | Forks: ${repo.forks} | Language: ${repo.language || 'N/A'}
Created: ${repo.created_at} | Updated: ${repo.updated_at} | Last Push: ${repo.pushed_at}
Topics: ${repo.topics.join(', ') || 'None'}
Description: ${repo.description || 'No description'}
Open Issues: ${repo.open_issues} | Default Branch: ${repo.default_branch}

README (first ${readmeChars} chars):
${readme.substring(0, readmeChars)}${readme.length > readmeChars ? '...' : ''}

Provide a comprehensive investment analysis as a valid JSON response with this exact structure:
{
  "scores": {
    "investment": <0-100>,
    "innovation": <0-100>,
    "team": <0-100>,
    "market": <0-100>,
    "technical_moat": <0-100>,
    "scalability": <0-100>,
    "developer_adoption": <0-100>
  },
  "recommendation": "<strong-buy|buy|watch|pass>",
  "summary": "<3-4 paragraph executive summary with key insights>",
  "strengths": ["<detailed strength 1>", "<detailed strength 2>", ...],
  "risks": ["<detailed risk 1>", "<detailed risk 2>", ...],
  "questions": ["<strategic due diligence question 1>", "<question 2>", ...],
  "growth_prediction": "<6-12 month growth trajectory prediction with reasoning>",
  "investment_thesis": "<2-3 paragraph investment thesis if recommendation is buy/strong-buy>",
  "competitive_analysis": "<analysis of competitive landscape and differentiation>"
}

Scoring Guidelines:
- 90-100: Exceptional, potential unicorn with clear technical moat
- 80-89: Strong investment opportunity with significant growth potential
- 70-79: Solid project worth monitoring, may need more maturity
- 60-69: Interesting but with notable limitations
- Below 60: Not investment-ready

Focus on: technical architecture depth, scalability potential, developer ecosystem fit, competitive differentiation, team track record, market timing, and potential for 10x+ returns.`;
  }

  /**
   * Call Claude API
   */
  private async callClaude(prompt: string, model: ClaudeModel): Promise<string> {
    return withExponentialBackoff(async () => {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: this.getMaxTokensForModel(model),
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        
        // Check for rate limit errors
        if (response.status === 429 || error.includes('rate limit')) {
          throw new Error(`Claude API rate limit: ${response.status} - ${error}`);
        }
        
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as ClaudeResponse;
      
      // Log token usage for monitoring
      if (data.usage) {
        console.log(`[API CALL] Claude API Response - Model: ${model}, Input: ${data.usage.input_tokens}, Output: ${data.usage.output_tokens}, Total: ${data.usage.input_tokens + data.usage.output_tokens}`);
      }
      
      return data.content[0]?.text || '';
    }, 3); // maxRetries parameter
  }

  /**
   * Parse Claude response
   */
  private parseResponse(response: string, repoId: string, model: ClaudeModel): Analysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn(`[Claude] No JSON found in response for repo ${repoId}. Response length: ${response.length}`);
        return this.createFallbackAnalysis(repoId, model, 'No valid JSON in Claude response');
      }
      
      // Clean up the JSON string - remove control characters but preserve valid JSON structure
      const cleanJson = jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
      
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseError) {
        console.warn(`[Claude] Failed to parse JSON for repo ${repoId}: ${parseError}`);
        return this.createFallbackAnalysis(repoId, model, 'Invalid JSON structure in response');
      }
      
      const analysis: Analysis = {
        repo_id: repoId,
        scores: {
          investment: parsed.scores?.investment || 0,
          innovation: parsed.scores?.innovation || 0,
          team: parsed.scores?.team || 0,
          market: parsed.scores?.market || 0,
          technical_moat: parsed.scores?.technical_moat,
          scalability: parsed.scores?.scalability,
          developer_adoption: parsed.scores?.developer_adoption,
        },
        recommendation: parsed.recommendation || 'pass',
        summary: parsed.summary || '',
        strengths: parsed.strengths || [],
        risks: parsed.risks || [],
        questions: parsed.questions || [],
        growth_prediction: parsed.growth_prediction,
        investment_thesis: parsed.investment_thesis,
        competitive_analysis: parsed.competitive_analysis,
        metadata: {
          model,
          cost: this.estimateCost(model, response.length),
          timestamp: new Date().toISOString(),
          tokens_used: response.length * 0.25, // Rough estimate
        },
      };
      
      return analysis;
    } catch (error) {
      console.error(`[Claude] Unexpected error parsing response for repo ${repoId}: ${error}`);
      return this.createFallbackAnalysis(repoId, model, `Parsing error: ${error}`);
    }
  }

  /**
   * Create a fallback analysis when Claude fails to return valid JSON
   */
  private createFallbackAnalysis(repoId: string, model: ClaudeModel, reason: string): Analysis {
    console.log(`[Claude] Creating fallback analysis for repo ${repoId} due to: ${reason}`);
    
    return {
      repo_id: repoId,
      scores: {
        investment: 0,
        innovation: 0,
        team: 0,
        market: 0,
      },
      recommendation: 'pass',
      summary: 'Analysis could not be completed due to content processing issues. This repository may contain content that prevents proper analysis.',
      strengths: ['Unable to analyze - content processing failed'],
      risks: ['Repository content could not be properly analyzed', reason],
      questions: ['Manual review recommended for this repository'],
      metadata: {
        model,
        cost: 0,
        timestamp: new Date().toISOString(),
        tokens_used: 0,
        error: reason,
        fallback: true,
      },
    };
  }

  /**
   * Estimate cost based on model and response length
   */
  private estimateCost(model: ClaudeModel, responseLength: number): number {
    const tokens = responseLength * 0.25; // Rough estimate
    const pricing: Record<string, number> = {
      'claude-opus-4-20250514': 15.00,              // Claude 4 Opus pricing
      'claude-sonnet-4-20250514': 3.00,             // Claude 4 Sonnet pricing
      'claude-3-5-sonnet-20241022': 3.00,   // Claude 3.5 Sonnet pricing
      'claude-3-5-sonnet-20240620': 3.00,   // Claude 3.5 Sonnet pricing
      'claude-3-opus-20240229': 15.00,
      'claude-3-sonnet-20240229': 3.00,
      'claude-3-haiku-20240307': 0.25,
      'claude-3-5-haiku-20241022': 0.25,
    };
    return (tokens / 1_000_000) * (pricing[model] || 3.00);
  }

  /**
   * Get max tokens for a model
   */
  private getMaxTokensForModel(model: ClaudeModel): number {
    if (model.includes('opus')) return Config.claude.maxTokens.opus;
    if (model.includes('sonnet')) return Config.claude.maxTokens.sonnet;
    if (model.includes('haiku')) return Config.claude.maxTokens.haiku;
    return Config.claude.maxTokens.sonnet; // default
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus() {
    return claudeRateLimiter.getStatus();
  }
}
