# Cloudflare Deployment Guide

## Pre-Deployment Checklist

### 1. Verify Environment Variables
Ensure your `.env` file has all required variables:
- `GITHUB_TOKEN` - GitHub personal access token
- `ANTHROPIC_API_KEY` - Claude API key
- `DATABASE_ID` - Your Cloudflare D1 database ID

### 2. Database Schema Updates
The complete schema is in `schema-complete.sql` and includes:
- All original tables
- Enhanced data collection tables
- Performance indexes
- Both `repository_tiers` and `repo_tiers` tables

### 3. Code Changes Summary
- ✅ Connection pool management
- ✅ Response body cleanup utilities
- ✅ Performance monitoring
- ✅ Stream processing
- ✅ Batch operations
- ✅ Rate limiting for all APIs
- ✅ Enhanced storage services
- ✅ Comprehensive metrics collection

## Deployment Steps

### Step 1: Verify TypeScript Compilation
```bash
npm run typecheck
```

### Step 2: Apply Database Schema
```bash
# Execute the complete schema
npx wrangler d1 execute github-ai-agent --file=schema-complete.sql
```

### Step 3: Deploy to Cloudflare
```bash
# Deploy the worker and durable object
npx wrangler deploy

# Or explicitly deploy to production environment
npx wrangler deploy --env production
```

**Important**: The default deployment now uses `ENVIRONMENT = "production"` to prevent localhost redirects. For development deployments, use `npx wrangler deploy --env development`.

### Step 4: Verify Deployment
```bash
# Check deployment status
npx wrangler tail

# Test the API endpoints
curl https://your-worker.workers.dev/api/status
```

### Step 5: Initialize the Agent
```bash
# Initialize the agent to start monitoring
curl -X POST https://your-worker.workers.dev/api/agent/init
```

## Post-Deployment Verification

### 1. Check Rate Limiting Status
```bash
curl https://your-worker.workers.dev/api/status | jq '.rateLimits'
```

### 2. Test Basic Functionality
```bash
# Get trending repos
curl https://your-worker.workers.dev/api/repos/trending

# Check alerts
curl https://your-worker.workers.dev/api/alerts

# Get daily report
curl https://your-worker.workers.dev/api/reports/daily
```

### 3. Monitor Logs
```bash
# Watch real-time logs
npx wrangler tail --format pretty
```

## Important Notes

1. **First Run**: The agent will need to populate initial data, which may take some time.

2. **Rate Limits**: The system now respects:
   - GitHub API: 30 req/min
   - GitHub Search: 10 req/min
   - Claude API: 5 req/min

3. **Scheduled Scans**: The agent runs comprehensive scans based on tier:
   - Tier 1: Every 6 hours
   - Tier 2: Every 24 hours
   - Tier 3: Every 72 hours

4. **Memory Management**: All operations are optimized for Cloudflare's limits:
   - 128MB memory limit
   - 6 concurrent connections
   - 30-second request timeout

## Troubleshooting

### If deployment fails:
1. Check `wrangler.toml` configuration
2. Verify all environment variables are set
3. Ensure database ID is correct
4. Check for TypeScript errors: `npm run typecheck`

### If API calls fail:
1. Check rate limit status at `/api/status`
2. Verify API keys are valid
3. Check logs for specific errors
4. Monitor connection pool status

### If database queries fail:
1. Verify schema was applied correctly
2. Check database bindings in `wrangler.toml`
3. Look for migration errors in logs

## Rollback Plan

If issues occur:
```bash
# Rollback to previous version
npx wrangler rollback

# Or deploy a specific version
npx wrangler deploy --compatibility-date 2024-01-01
```

## Monitoring

After deployment, monitor:
1. **Performance**: Response times and memory usage
2. **Rate Limits**: Token availability and queue depth
3. **Errors**: Connection timeouts, API failures
4. **Data Collection**: New repositories and metrics

## Next Steps

1. Set up alerts for critical errors
2. Configure monitoring dashboards
3. Schedule regular data backups
4. Plan for scaling if needed
