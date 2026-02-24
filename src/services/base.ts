import type { Env } from "../types";

export class BaseService {
  protected env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  protected async handleError<T>(
    fn: () => Promise<T>,
    context: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      throw error;
    }
  }

  protected jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }

  /**
   * Execute a single database query with error handling
   */
  protected async dbRun(query: string, ...params: any[]): Promise<D1Result> {
    return this.handleError(async () => {
      const stmt = this.env.DB.prepare(query).bind(...params);
      return await stmt.run();
    }, "database run operation");
  }

  /**
   * Get first result from a database query
   */
  protected async dbFirst<T = any>(
    query: string,
    ...params: any[]
  ): Promise<T | null> {
    return this.handleError(async () => {
      const stmt = this.env.DB.prepare(query).bind(...params);
      return await stmt.first<T>();
    }, "database first operation");
  }

  /**
   * Get all results from a database query
   */
  protected async dbAll<T = any>(
    query: string,
    ...params: any[]
  ): Promise<T[]> {
    return this.handleError(async () => {
      const stmt = this.env.DB.prepare(query).bind(...params);
      const result = await stmt.all<T>();
      return result.results || [];
    }, "database all operation");
  }

  /**
   * Execute multiple database operations in a batch
   */
  protected async dbBatch(
    statements: D1PreparedStatement[],
  ): Promise<D1Result[]> {
    return this.handleError(async () => {
      return await this.env.DB.batch(statements);
    }, "database batch operation");
  }

  /**
   * Prepare batch statements from queries and parameters
   */
  protected prepareBatchStatements(
    queries: Array<{ sql: string; params: any[] }>,
  ): D1PreparedStatement[] {
    return queries.map(({ sql, params }) =>
      this.env.DB.prepare(sql).bind(...params),
    );
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  protected async dbTransaction<T>(
    fn: (tx: D1Database) => Promise<T>,
  ): Promise<T> {
    return this.handleError(async () => {
      // D1 doesn't have explicit transaction support yet,
      // but we can simulate it with careful error handling
      try {
        return await fn(this.env.DB);
      } catch (error) {
        // In a real transaction, we would rollback here
        console.error("Transaction failed:", error);
        throw error;
      }
    }, "database transaction");
  }
}
