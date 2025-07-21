# Production Redirect Fix Guide

## Issue
The production deployment at `https://github-ai-intelligence.nkostov.workers.dev/` was redirecting to `http://localhost:3003/` due to incorrect environment configuration.

## Root Cause
The `ENVIRONMENT` variable was set to `"development"` by default in `wrangler.toml`, causing the production deployment to serve a redirect page instead of the API.

## Solution Applied

### 1. Updated wrangler.toml
Changed the default `ENVIRONMENT` from `"development"` to `"production"`:

```toml
[vars]
ENVIRONMENT = "production"  # Changed from "development"

[env.development]
vars = { ENVIRONMENT = "development" }
```

This ensures that:
- Default deployments use production settings
- Development deployments must explicitly use `--env development`

## Deployment Instructions

### Deploy to Production
```bash
# Standard deployment (now defaults to production)
npx wrangler deploy

# Or explicitly specify production environment
npx wrangler deploy --env production
```

### Deploy to Development
```bash
# Must explicitly specify development environment
npx wrangler deploy --env development
```

## Verification Steps

1. **Check the deployed site**:
   ```bash
   curl https://github-ai-intelligence.nkostov.workers.dev/
   ```
   
   You should see the API documentation HTML page, NOT a redirect to localhost.

2. **Test API endpoints**:
   ```bash
   # Check system status
   curl https://github-ai-intelligence.nkostov.workers.dev/api/status
   
   # Get trending repos
   curl https://github-ai-intelligence.nkostov.workers.dev/api/repos/trending
   ```

3. **Monitor deployment logs**:
   ```bash
   npx wrangler tail
   ```

## Expected Production Behavior

When accessing the root URL in production, you should see:
- A styled HTML page titled "GitHub AI Intelligence API"
- List of available API endpoints
- Instructions for dashboard deployment
- NO redirect to localhost:3003

## Dashboard Deployment (Future Enhancement)

The current setup suggests the dashboard should be deployed separately:

1. **Build the dashboard**:
   ```bash
   cd dashboard
   npm install
   npm run build
   ```

2. **Deploy to Cloudflare Pages**:
   ```bash
   npx wrangler pages deploy dist --project-name github-ai-dashboard
   ```

3. **Configure dashboard to use the API**:
   - Update `dashboard/src/lib/api.ts` to point to the production API URL
   - Or use environment variables for API configuration

## Rollback Instructions

If issues occur after deployment:

```bash
# List recent deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback [deployment-id]
```

## Summary

The fix ensures that:
1. Production deployments no longer redirect to localhost
2. The API is accessible at the production URL
3. Development environment must be explicitly specified
4. The system is ready for separate dashboard deployment

## Next Steps

1. Deploy the updated configuration to production
2. Verify the API is accessible
3. Plan dashboard deployment to Cloudflare Pages
4. Update documentation with the new deployment process
