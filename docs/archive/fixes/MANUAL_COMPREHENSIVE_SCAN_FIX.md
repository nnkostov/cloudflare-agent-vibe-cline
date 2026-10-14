# Manual Comprehensive Scan Fix - Subrequest Limit

## Summary

Fixed the "Too many API requests by single worker invocation" error that occurred when manually triggering a comprehensive scan from the Controls page. The issue was caused by exceeding Cloudflare Workers' limit of 1000 subrequests per invocation.

## Problem

When manually triggering a comprehensive scan, the system was trying to:
- Discover up to 1000 new repositories
- Process 25 Tier 1 repos
- Process 50 Tier 2 repos  
- Process 100 Tier 3 repos
- Analyze multiple repositories with Claude AI

This resulted in 1000+ subrequests, exceeding Cloudflare's limit.

## Solution

Implemented different limits for manual vs scheduled scans:

### 1. Added `isManual` Parameter
- Tracks whether scan was triggered manually from UI or by schedule
- Passes this flag through all processing methods

### 2. Reduced Limits for Manual Scans

**Discovery Phase:**
- Scheduled: 1000 repos
- Manual: 200 repos

**Tier 1 Processing:**
- Scheduled: 25 repos
- Manual: 10 repos

**Tier 2 Processing:**
- Scheduled: 50 repos, analyze top 10
- Manual: 20 repos, analyze top 3

**Tier 3 Processing:**
- Scheduled: 100 repos
- Manual: 30 repos

## Implementation Details

### Updated Methods:
1. `handleComprehensiveScan()` - Sets `isManual = true` for UI-triggered scans
2. `comprehensiveScan()` - Accepts `isManual` parameter
3. `scanGitHub()` - Uses reduced discovery limit for manual scans
4. `processTier1ReposSimplified()` - Reduced batch size for manual scans
5. `processTier2ReposSimplified()` - Reduced batch size and analysis count
6. `processTier3Repos()` - Reduced batch size for manual scans

### Estimated Subrequest Usage (Manual Scan):
- Discovery: ~50-100 subrequests
- Tier 1: ~50 subrequests (10 repos × 5 operations)
- Tier 2: ~120 subrequests (20 repos × 3 ops + 3 analyses × 10 ops)
- Tier 3: ~90 subrequests (30 repos × 3 operations)
- **Total: ~400-500 subrequests** (well under the 1000 limit)

## Benefits

1. **Manual scans now work reliably** without hitting subrequest limits
2. **Discovery remains essential** - still finds 200 new repos per manual scan
3. **Scheduled scans unchanged** - continue with full capacity
4. **User experience improved** - no more error messages

## Usage

The fix is automatic:
- When clicking "Force Comprehensive Scan" in the UI, it uses reduced limits
- Scheduled scans (hourly and 12-hour) continue using full limits
- No user action required

## Future Improvements

If users need more extensive manual scanning:
1. Could add a "Deep Discovery" mode that runs in batches
2. Could implement progressive scanning with real-time updates
3. Could add batch operations to further reduce subrequest count
