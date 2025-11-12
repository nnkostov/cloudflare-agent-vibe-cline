# GitHub Search Multi-Topic Fix

## Issue
The Leaderboard page was only showing one trending repository because the GitHub search was only searching for repositories with the "ai" topic, ignoring other configured topics like "llm", "agents", "machine-learning", "gpt", and "langchain".

## Root Cause
In `src/services/github.ts`, the `searchTrendingRepos` method was only using the first topic in the array:
```javascript
const topicQuery = `topic:${topics[0]}`; // Only searches for "ai"
```

## Solution
Updated the search query to include all configured topics using GitHub's OR operator:
```javascript
const topicQuery = topics.length > 0
  ? '(' + topics.map(t => `topic:${t}`).join(' OR ') + ')'
  : 'topic:ai'; // fallback to ai if no topics provided
```

This creates a query like: `(topic:ai OR topic:llm OR topic:agents OR topic:machine-learning OR topic:gpt OR topic:langchain)`

## Expected Impact
- **More repositories discovered**: The search will now find repositories tagged with any of the configured topics, not just "ai"
- **Better diversity**: You'll see repositories focused on different aspects of AI/ML (LLMs, agents, GPT implementations, etc.)
- **Increased trending results**: The Leaderboard should show many more trending repositories

## Testing
Run the test script to verify the fix:
```bash
node test-github-search-fix.js
```

This will show:
1. Results from single topic search (old behavior)
2. Results from multi-topic search (new behavior)
3. Topic distribution analysis
4. Diversity metrics

## Additional Troubleshooting

### If you're still seeing few repositories:

1. **Check Database State**
   ```bash
   node diagnose-tier-assignment-issue.js
   ```
   This will show how many repositories are in your database and their tier distribution.

2. **Force a Comprehensive Scan**
   - Go to the Controls page
   - Enable "Force scan" checkbox
   - Click "Run Comprehensive Scan"
   - This will ensure at least 10 repositories are processed

3. **Verify Agent Initialization**
   - On the Controls page, check if the agent status is "Active"
   - If not, click "Initialize Agent" to start the 6-hour scheduled scanning

4. **Check the Hybrid Trending Algorithm**
   The system uses a hybrid approach when historical growth data isn't available:
   - Recent activity score (40%) - repositories pushed to in last 7 days get highest scores
   - Star velocity (30%) - high star count relative to age
   - Fork ratio (20%) - engagement metric
   - Popularity bonus (10%) - bonus for very popular repos

5. **Manual Quick Scan**
   - Click "Run Quick Scan" on the Controls page
   - This will immediately search GitHub and save new repositories

### Database Queries to Check

Check trending repositories in the database:
```sql
-- Check repositories with recent activity
SELECT r.full_name, r.stars, r.pushed_at, rt.tier,
       julianday('now') - julianday(r.pushed_at) as days_since_push
FROM repositories r
LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE r.is_archived = 0 AND r.is_fork = 0
  AND julianday('now') - julianday(r.pushed_at) < 30
ORDER BY r.stars DESC
LIMIT 20;

-- Check topic distribution
SELECT topics, COUNT(*) as count
FROM repositories
WHERE is_archived = 0 AND is_fork = 0
GROUP BY topics
ORDER BY count DESC
LIMIT 10;
```

## Monitoring

After deploying this fix:
1. The `/api/repos/trending` endpoint should return more repositories
2. The Leaderboard page should display multiple trending repositories
3. The topic diversity should improve significantly

## Related Files
- `src/services/github.ts` - Main fix applied here
- `src/services/github-enhanced.ts` - Enhanced service for comprehensive scanning
- `src/services/storage-unified.ts` - Contains hybrid trending algorithm
- `src/types/index.ts` - Configuration for topics and search strategies
