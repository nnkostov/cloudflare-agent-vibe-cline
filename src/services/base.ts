import type { Env } from '../types';

export abstract class BaseService {
  protected env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  protected async handleError<T>(
    operation: () => Promise<T>, 
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      throw new Error(`Failed to ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
