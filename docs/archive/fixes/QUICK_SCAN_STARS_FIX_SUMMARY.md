# Quick Scan Database Constraint Fixes - Summary

## Date: January 16, 2025

### Issues Fixed
1. **First Issue**: `NOT NULL constraint failed: repo_tiers.stars`
2. **Second Issue**: `NOT NULL constraint failed: repo_tiers.next_scan_due`

### Root Cause
The `repo_tiers` table in the database has two columns defined as NOT NULL that weren't being properly handled in the code:
1. `stars` column - wasn't included in the TypeScript interface or INSERT statements
2. `next_scan_due` column - wasn't included in the TypeScript interface or INSERT statements

### Fixes Applied

1. **Updated Type Definition** (`src/types/index.ts`):
   - Added `stars: number;` field to the `RepoTier` interface
   - Added `next_scan_due: string;` field to the `RepoTier` interface

2. **Updated Storage Services**:
   - **`src/services/storage-unified.ts`**:
     - Modified `saveRepoTier` to include both `stars` and `next_scan_due` in the INSERT statement
     - Modified `updateRepoTier` to:
       - Pass `stars: metrics.stars` in the tier object
       - Calculate `next_scan_due` based on tier (1 hour for tier 1, 24 hours for tier 2, 168 hours for tier 3)
       - Pass `next_scan_due: nextScanDue.toISOString()` in the tier object
   
   - **`src/services/storage-enhanced.ts`**:
     - Applied the same fixes as in storage-unified.ts

3. **Database Tables**:
   - The `repo_tiers` table already existed with the correct schema
   - No database migration was needed

### Deployment
- Built the dashboard: `npm run build`
- Deployed to production: `npx wrangler deploy`
- Version ID: dd47a99f-aac8-4367-9fcf-05b58ea911df

### Verification
To verify the fix:
1. Open the dashboard: https://github-ai-intelligence.nkostov.workers.dev/
2. Navigate to the Controls page
3. Click "Run Quick Scan"
4. The scan should now complete successfully without any database constraint errors

### Technical Details
The fix ensures that when repositories are scanned and their tiers are assigned:
- The `stars` count from the repository is properly stored in the `repo_tiers` table
- The `next_scan_due` timestamp is calculated based on the tier and stored
- This allows for:
  - Tier-based filtering and prioritization based on star count
  - Scheduled scanning based on the `next_scan_due` timestamp
  - The tiering logic uses stars as one of the factors (repos with ≥100 stars and high growth velocity go to tier 1)

### Next Scan Due Logic
- **Tier 1 (Hot prospects)**: Next scan in 1 hour
- **Tier 2 (Rising stars)**: Next scan in 24 hours
- **Tier 3 (Long tail)**: Next scan in 168 hours (1 week)

### Files Modified
- `src/types/index.ts` - Added stars and next_scan_due fields to RepoTier interface
- `src/services/storage-unified.ts` - Fixed saveRepoTier and updateRepoTier methods
- `src/services/storage-enhanced.ts` - Fixed saveRepoTier and updateRepoTier methods

The Quick Scan functionality should now work correctly without any database constraint errors.
