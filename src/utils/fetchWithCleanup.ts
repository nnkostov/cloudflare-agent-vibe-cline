/**
 * Fetch utilities with proper response body cleanup for Cloudflare Workers
 * Ensures connections are properly released when responses are not fully consumed
 */

import { RateLimiter, externalApiRateLimiter } from './rateLimiter';

export interface FetchOptions extends RequestInit {
  rateLimiter?: RateLimiter;
}

/**
 * Fetch with automatic response body cleanup on error
 */
export async function fetchWithCleanup(
  url: string | URL | Request, 
  options?: FetchOptions
): Promise<Response> {
  // Apply rate limiting if specified
  if (options?.rateLimiter) {
    await options.rateLimiter.acquire();
  }
  
  const response = await fetch(url, options);
  
  if (!response.ok) {
    // Cancel the body to free up the connection immediately
    response.body?.cancel();
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response;
}

/**
 * Fetch JSON with automatic cleanup
 */
export async function safeJsonFetch<T = any>(
  url: string | URL | Request, 
  options?: FetchOptions
): Promise<T> {
  const response = await fetchWithCleanup(url, options);
  
  try {
    const data = await response.json();
    return data as T;
  } catch (error) {
    // If JSON parsing fails, ensure body is canceled
    response.body?.cancel();
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}

/**
 * Fetch text with automatic cleanup
 */
export async function safeTextFetch(
  url: string | URL | Request, 
  options?: FetchOptions
): Promise<string> {
  const response = await fetchWithCleanup(url, options);
  
  try {
    return await response.text();
  } catch (error) {
    // If text reading fails, ensure body is canceled
    response.body?.cancel();
    throw new Error(`Failed to read text response: ${error}`);
  }
}

/**
 * Fetch with conditional body consumption
 * Only reads body if response matches criteria
 */
export async function conditionalFetch<T = any>(
  url: string | URL | Request,
  options?: FetchOptions,
  shouldConsumeBody: (response: Response) => boolean = (res) => res.ok
): Promise<{ response: Response; data?: T }> {
  // Apply rate limiting if specified
  if (options?.rateLimiter) {
    await options.rateLimiter.acquire();
  }
  
  const response = await fetch(url, options);
  
  if (shouldConsumeBody(response)) {
    try {
      const data = await response.json() as T;
      return { response, data };
    } catch (error) {
      response.body?.cancel();
      throw error;
    }
  } else {
    // Explicitly cancel body if we're not consuming it
    response.body?.cancel();
    return { response };
  }
}

/**
 * Fetch with timeout and cleanup
 */
export async function fetchWithTimeout(
  url: string | URL | Request,
  options?: FetchOptions & { timeout?: number }
): Promise<Response> {
  const { timeout = 30000, rateLimiter, ...fetchOptions } = options || {};
  
  // Apply rate limiting if specified
  if (rateLimiter) {
    await rateLimiter.acquire();
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      response.body?.cancel();
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Batch fetch with connection pooling
 */
export async function batchFetch<T = any>(
  requests: Array<{
    url: string | URL | Request;
    options?: RequestInit;
  }>,
  maxConcurrent: number = 6
): Promise<Array<{ success: boolean; data?: T; error?: Error }>> {
  const results: Array<{ success: boolean; data?: T; error?: Error }> = [];
  
  // Process in batches to respect connection limits
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const batch = requests.slice(i, i + maxConcurrent);
    const batchResults = await Promise.allSettled(
      batch.map(req => safeJsonFetch<T>(req.url, req.options))
    );
    
    results.push(...batchResults.map(result => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value };
      } else {
        return { success: false, error: result.reason };
      }
    }));
  }
  
  return results;
}
