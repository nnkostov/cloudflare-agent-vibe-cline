# Comprehensive Scan Force Mode Implementation Summary

## Date: January 17, 2025

### Overview
Implemented a force mode for comprehensive scans to ensure a minimum number of repositories are processed, addressing the issue where scans were only processing 2 repositories.

### Changes Made

#### 1. Backend Changes

##### Storage Service Updates (`src/services/storage-enhanced.ts`)
- Modified `getReposNeedingScan` method to accept a `force` parameter
- When `force=true`, the method returns all repositories of the specified tier, ignoring scan timestamps
- This ensures repos are available for processing even if recently scanned

##### GitHubAgent Updates (`src/agents/GitHubAgent-fixed-comprehensive.ts`)
- Added `force` and `minRepos` parameters to `handleComprehensiveScan` method
- Parameters are extracted from query string: `?force=true&min_repos=10`
- Updated `comprehensiveScan` method to accept and pass through these parameters
- Added logic to ensure minimum repos are processed when force mode is enabled
- If processed count is below `minRepos` and `force=true`, additional repos are fetched and processed

##### Tier Processing Methods
- Updated all tier processing methods to accept `force` and `minRepos` parameters
- Pass `force` parameter to `getReposNeedingScan` calls
- **CRITICAL FIX**: Modified MAX_BATCH limits to respect minRepos in force mode:
  - Tier 1: `MAX_BATCH = force ? Math.max(10, minRepos) : 10`
  - Tier 2: `MAX_BATCH = force ? Math.max(20, minRepos) : 20`
  - Tier 3: `MAX_BATCH = force ? Math.max(30, minRepos) : 30`

#### 2. Frontend Changes

##### API Client (`dashboard/src/lib/api.ts`)
- Modified `triggerComprehensiveScan` to accept a `force` parameter
- Appends `?force=true` to the URL when force mode is enabled

##### Controls Page (`dashboard/src/pages/Controls.tsx`)
- Added a checkbox for "Force scan (process at least 10 repos)"
- Added state management for force mode selection
- Pass force mode value to the API call when triggering comprehensive scan

### How It Works

1. **Normal Mode (force=false)**:
   - Only processes repos that haven't been scanned recently
   - Respects the scan intervals (24h for Tier 1, 48h for Tier 2, 72h for Tier 3)
   - May process fewer repos if most have been recently scanned

2. **Force Mode (force=true)**:
   - Ignores scan timestamps and processes all repos in each tier
   - Ensures at least `minRepos` (default 10) are processed
   - If tier processing doesn't meet minimum, additional repos are fetched
   - Useful for testing or when you need to refresh data

### Usage

#### Via Dashboard
1. Navigate to Controls page
2. Check "Force scan (process at least 10 repos)"
3. Click "Run Comprehensive Scan"

#### Via API
```bash
curl -X POST "https://github-ai-intelligence.nkostov.workers.dev/api/agent/scan/comprehensive?force=true&min_repos=10"
```

### Benefits
- Ensures comprehensive scans always process a meaningful number of repositories
- Provides flexibility to override scan intervals when needed
- Improves testing and debugging capabilities
- Maintains backward compatibility (force mode is optional)

### Testing
The implementation has been deployed and tested in production. The force mode successfully processes at least 10 repositories when enabled, solving the original issue of only processing 2 repos.
