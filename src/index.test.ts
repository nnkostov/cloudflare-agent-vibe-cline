import { describe, it, expect } from 'vitest';
import worker from './index';

describe('GitHub AI Intelligence Agent', () => {
  const mockEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [] }),
          first: async () => null,
          run: async () => ({})
        })
      })
    } as any,
    STORAGE: {
      put: async () => {},
      get: async () => null
    } as any,
    GITHUB_AGENT: {
      idFromName: () => ({ id: 'test' }),
      get: () => ({
        fetch: async (req: Request) => {
          const url = new URL(req.url);
          if (url.pathname === '/status') {
            return new Response(JSON.stringify({
              status: 'active',
              dailyStats: {
                repos_scanned: 0,
                analyses_performed: 0,
                alerts_sent: 0,
                total_cost: 0
              }
            }));
          }
          return new Response('OK');
        }
      })
    } as any,
    GITHUB_TOKEN: 'test-token',
    ANTHROPIC_API_KEY: 'test-key'
  };

  describe('Worker', () => {
    it('should return HTML redirect in development mode', async () => {
      const request = new Request('http://localhost/');
      const devEnv = { ...mockEnv, ENVIRONMENT: 'development' };

      const response = await worker.fetch(request, devEnv);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(text).toContain('Redirecting to development server');
    });

    it('should handle CORS preflight requests', async () => {
      const request = new Request('http://localhost/api/scan', {
        method: 'OPTIONS'
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should handle errors gracefully', async () => {
      const request = new Request('http://localhost/api/unknown-endpoint');
      const errorEnv = {
        ...mockEnv,
        GITHUB_AGENT: {
          idFromName: () => ({ id: 'test' }),
          get: () => ({
            fetch: async () => new Response('Not Found', { status: 404 })
          })
        } as any
      };

      const response = await worker.fetch(request, errorEnv);

      expect(response.status).toBe(404);
    });
  });

  describe('API Endpoints', () => {
    it('should handle /api/status endpoint', async () => {
      const request = new Request('http://localhost/api/status');

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });

    it('should handle /api/alerts endpoint', async () => {
      const request = new Request('http://localhost/api/alerts');

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.alerts).toBeDefined();
      expect(Array.isArray(data.alerts)).toBe(true);
    });

    it('should handle /api/repos/trending endpoint', async () => {
      const request = new Request('http://localhost/api/repos/trending');

      const response = await worker.fetch(request, mockEnv);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.repositories).toBeDefined();
      expect(Array.isArray(data.repositories)).toBe(true);
    });

    it('should forward requests to Durable Object', async () => {
      const request = new Request('http://localhost/api/scan', {
        method: 'POST',
        body: JSON.stringify({ topics: ['ai'] })
      });

      const response = await worker.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });
});
