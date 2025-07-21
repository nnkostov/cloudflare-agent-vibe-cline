# Enhanced Data Collection System - Deployment Guide

## Overview

This guide covers the deployment of the enhanced data collection system for the GitHub AI Intelligence Agent. The system now includes:

- **Tiered Repository Scanning**: Automatically categorizes repos into 3 tiers based on activity
- **Comprehensive Metrics Collection**: Commits, releases, PRs, issues, star history, fork analysis
- **Enhanced Scoring Algorithms**: More sophisticated analysis of repository potential
- **Optimized for Cloudflare Workers**: Batch processing, extended CPU limits, efficient resource usage

## Pre-Deployment Checklist

### 1. Database Schema Updates

Run the following SQL commands in your D1 database:

```bash
npx wrangler d1 execute github-intelligence --file=schema-updates.sql
```

This will create the new tables:
- `repository_tiers` - Tier assignments and scan tracking
- `commit_metrics` - Detailed commit activity
- `release_history` - Release patterns and frequency
- `pull_request_metrics` - PR activity and contributor data
- `issue_metrics` - Issue resolution and response times
- `star_history` - Daily star growth tracking
- `fork_analysis` - Fork network activity
- `api_usage` - API rate limit monitoring

### 2. Environment Variables

Ensure these are set:
```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ANTHROPIC_API_KEY
```

### 3. Verify Configuration

Check `wrangler.toml` includes:
- Extended CPU limits: `cpu_ms = 300000` (5 minutes)
- Cron trigger: `"0 */6 * * *"` (every 6 hours)

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Build and Test Locally

```bash
npm run dev
```

Test the new endpoints:
- `POST /api/scan/comprehensive` - Run comprehensive scan
- `GET /api/repos/tier?tier=1` - Get Tier 1 repositories
- `GET /api/metrics/comprehensive?repo_id=123` - Get comprehensive metrics
- `GET /api/reports/enhanced` - Get enhanced report with tier data

### 3. Deploy to Cloudflare

```bash
npm run deploy
```

### 4. Initialize the Agent

After deployment, initialize the agent to start scheduled scanning:

```bash
curl -X POST https://your-worker.workers.dev/api/agent/init
```

## New API Endpoints

### Comprehensive Scanning
```bash
# Trigger a comprehensive scan manually
curl -X POST https://your-worker.workers.dev/api/scan/comprehensive
```

### Tier Management
```bash
# Get repositories by tier (1, 2, or 3)
curl https://your-worker.workers.dev/api/repos/tier?tier=1
```

### Enhanced Metrics
```bash
# Get comprehensive metrics for a repository
curl https://your-worker.workers.dev/api/metrics/comprehensive?repo_id=123456
```

### Enhanced Reports
```bash
# Get enhanced report with tier summaries
curl https://your-worker.workers.dev/api/reports/enhanced
```

## Monitoring and Maintenance

### 1. Check Tier Distribution

Monitor how repositories are distributed across tiers:

```sql
SELECT tier, COUNT(*) as count 
FROM repository_tiers 
GROUP BY tier;
```

### 2. Monitor API Usage

Track GitHub API consumption:

```sql
SELECT 
  DATE(timestamp) as date,
  SUM(requests_made) as total_requests,
  AVG(rate_limit_remaining) as avg_remaining
FROM api_usage
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### 3. Scan Coverage

Check repositories needing scans:

```sql
SELECT 
  tier,
  COUNT(CASE WHEN last_deep_scan < datetime('now', '-7 days') THEN 1 END) as needs_deep_scan,
  COUNT(CASE WHEN last_basic_scan < datetime('now', '-1 day') THEN 1 END) as needs_basic_scan
FROM repository_tiers
GROUP BY tier;
```

## Performance Optimization

### 1. Batch Processing

The system processes repositories in batches:
- Tier 1: 20 repos per batch (deep scan)
- Tier 2: 50 repos per batch (basic scan)
- Tier 3: 50 repos per batch (minimal scan)

### 2. Rate Limiting

Built-in delays between API calls:
- Tier 1: 1 second between repos
- Tier 2: 200ms between repos
- Tier 3: Batch processing with 1 second between batches

### 3. CPU Time Management

With 5-minute CPU limit:
- Can process ~150-300 repos per invocation
- Comprehensive scan splits work across multiple invocations if needed

## Troubleshooting

### 1. CPU Limit Exceeded

If you see CPU limit errors:
- Reduce batch sizes in `GitHubAgent.ts`
- Increase delays between API calls
- Split tier processing across multiple scheduled runs

### 2. API Rate Limits

If hitting GitHub rate limits:
- Check `api_usage` table for patterns
- Adjust scan frequencies in tier processing
- Consider using multiple GitHub tokens

### 3. Storage Growth

Monitor D1 storage usage:
```sql
-- Check table sizes
SELECT 
  name,
  SUM(pgsize) as size_bytes
FROM dbstat
GROUP BY name
ORDER BY size_bytes DESC;
```

## Future Enhancements

1. **Cloudflare Queues Integration**
   - Add queue-based processing for better scalability
   - Distribute repository scanning across multiple workers

2. **Advanced Analytics**
   - Implement trend prediction algorithms
   - Add machine learning models for investment scoring

3. **Real-time Monitoring**
   - WebSocket connections for live updates
   - Push notifications for high-value opportunities

## Support

For issues or questions:
1. Check the logs: `npx wrangler tail`
2. Review error alerts in the `alerts` table
3. Monitor the `/api/status` endpoint for system health

## Rollback Plan

If issues arise:

1. Revert to previous version:
```bash
git checkout <previous-commit>
npm run deploy
```

2. The old schema remains compatible - new tables are additive only
3. Disable cron triggers if needed via Cloudflare dashboard

---

**Note**: This enhanced system significantly improves data collection capabilities while remaining within Cloudflare Workers' limits. The tiered approach ensures efficient use of API quotas and processing time.
