import type { Repository, Analysis, ClaudeModel, Env, CONFIG } from '../types';
import { BaseService } from './base';
import { CONFIG as Config } from '../types';

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export class ClaudeService extends BaseService {
  private apiUrl = 'https://api.anthropic.com/v1/messages';

  /**
   * Analyze a repository using Claude
   */
  async analyzeRepository(
    repo: Repository,
    readme: string,
    model: ClaudeModel = 'claude-3-sonnet-20240229'
  ): Promise<Analysis> {
    return this.handleError(async () => {
      const prompt = this.buildPrompt(repo, readme);
      const response = await this.callClaude(prompt, model);
      return this.parseResponse(response, repo.id, model);
    }, `analyze repository ${repo.full_name}`);
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

Provide a JSON response with this exact structure:
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

Focus on: technical innovation, team quality, market opportunity, scalability, and competitive advantages.
Be critical - only exceptional projects should score above 80.`;
  }

  /**
   * Call Claude API
   */
  private async callClaude(prompt: string, model: ClaudeModel): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
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
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as ClaudeResponse;
    return data.content[0]?.text || '';
  }

  /**
   * Parse Claude response
   */
  private parseResponse(response: string, repoId: string, model: ClaudeModel): Analysis {
    try {
      // Extract JSON from response, handling potential formatting issues
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      
      // Clean up the JSON string to handle common issues
      let jsonStr = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/\n/g, '\\n') // Escape newlines
        .replace(/\r/g, '\\r') // Escape carriage returns
        .replace(/\t/g, '\\t'); // Escape tabs
      
      // Fix common JSON issues
      jsonStr = jsonStr.replace(/([^\\])"/g, '$1\\"'); // Escape unescaped quotes
      jsonStr = jsonStr.replace(/\\\\"/g, '\\"'); // Fix double-escaped quotes
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        repo_id: repoId,
        scores: {
          investment: parsed.scores?.investment || 0,
          innovation: parsed.scores?.innovation || 0,
          team: parsed.scores?.team || 0,
          market: parsed.scores?.market || 0,
        },
        recommendation: parsed.recommendation || 'pass',
        summary: parsed.summary || '',
        strengths: parsed.strengths || [],
        risks: parsed.risks || [],
        questions: parsed.questions || [],
        metadata: {
          model,
          cost: this.estimateCost(model, response.length),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse analysis: ${error}`);
    }
  }

  /**
   * Estimate cost based on model and response length
   */
  private estimateCost(model: ClaudeModel, responseLength: number): number {
    const tokens = responseLength * 0.25; // Rough estimate
    const pricing: Record<string, number> = {
      'claude-3-opus-20240229': 15.00,
      'claude-3-sonnet-20240229': 3.00,
      'claude-3-haiku-20240307': 0.25,
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
}
