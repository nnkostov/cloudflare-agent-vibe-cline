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
    it('should return API information on root path', async () => {
      const request = new Request('http://localhost/');
      const ctx = {} as any;

      const response = await worker.fetch(request, mockEnv, ctx);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.name).toBe('GitHub AI Intelligence Agent');
      expect(data.version).toBe('1.0.0');
      expect(data.endpoints).toBeDefined();
    });

    it('should handle CORS preflight requests', async () => {
      const request = new Request('http://localhost/api/scan', {
        method: 'OPTIONS'
      });
      const ctx = {} as any;

      const response = await worker.fetch(request, mockEnv, ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should handle errors gracefully', async () => {
      const request = new Request('http://localhost/api/error');
      const errorEnv = {
        ...mockEnv,
        GITHUB_AGENT: {
          idFromName: () => { throw new Error('Test error'); },
          get: () => { throw new Error('Test error'); }
        } as any
      };
      const ctx = {} as any;

      const response = await worker.fetch(request, errorEnv, ctx);
      const data = await response.json() as any;

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    it('should handle /api/status endpoint', async () => {
      const request = new Request('http://localhost/api/status');
      const ctx = {} as any;

      const response = await worker.fetch(request, mockEnv, ctx);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.status).toBe('active');
      expect(data.dailyStats).toBeDefined();
    });

    it('should handle /api/alerts endpoint', async () => {
      const request = new Request('http://localhost/api/alerts');
      const ctx = {} as any;

      const response = await worker.fetch(request, mockEnv, ctx);
      const data = await response.json() as any;

      expect(response.status).toBe(200);
      expect(data.alerts).toBeDefined();
      expect(Array.isArray(data.alerts)).toBe(true);
    });

    it('should handle /api/repos/trending endpoint', async () => {
      const request = new Request('http://localhost/api/repos/trending');
      const ctx = {} as any;

      const response = await worker.fetch(request, mockEnv, ctx);
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
      const ctx = {} as any;

      const response = await worker.fetch(request, mockEnv, ctx);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });
});
