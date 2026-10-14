# Tier 3 Pagination Implementation

## Problem
Tier 3 was crashing when trying to load hundreds of repositories at once, causing timeouts and performance issues.

## Solution
Implemented pagination for tier views to handle large datasets efficiently.

## Changes Made

### Backend (src/index.ts)
1. **Updated `/api/repos/tier` endpoint** to support pagination:
   - Added `page` parameter (default: 1)
   - Added `limit` parameter (default: 50, max: 100)
   - Returns pagination metadata:
     - `page`: Current page number
     - `limit`: Items per page
     - `totalCount`: Total number of repositories in the tier
     - `totalPages`: Total number of pages
     - `hasNextPage`: Boolean indicating if there's a next page
     - `hasPreviousPage`: Boolean indicating if there's a previous page

2. **Always fetches full analysis data** for paginated results since page sizes are manageable (50 items)

### Storage Service (src/services/storage-unified.ts)
1. **Added `getRepoCountByTier` method**: Returns the total count of repositories in a specific tier
2. **Added `getReposByTierPaginated` method**: Returns paginated repositories with LIMIT and OFFSET

### Frontend (dashboard/src/lib/api.ts)
1. **Updated `getReposByTier` method** to accept page and limit parameters
2. **Updated return type** to include pagination metadata

### Leaderboard Component (dashboard/src/pages/Leaderboard.tsx)
1. **Added pagination state**: `currentPage` state variable
2. **Added `handleTierChange` function**: Resets page to 1 when switching tiers
3. **Updated tier count display**: Uses `totalCount` instead of `count`
4. **Added pagination controls**:
   - Previous/Next buttons with proper disabled states
   - Current page and total pages display
   - Total repository count display
   - Centered layout below the repository list

## Benefits
1. **Improved Performance**: Loading 50 repositories at a time instead of hundreds
2. **Better UX**: Users can navigate through pages instead of scrolling through hundreds of items
3. **Prevents Timeouts**: Each request handles a manageable amount of data
4. **Full Analysis Data**: With smaller page sizes, we can include complete analysis information

## Usage
- Default page size: 50 repositories per page
- Users can navigate using Previous/Next buttons
- Page resets to 1 when switching between tiers
- Pagination controls only appear when there's more than one page

## Technical Details
- SQL queries use `LIMIT` and `OFFSET` for efficient pagination
- All queries maintain existing filters (non-archived, non-fork repositories)
- Pagination state is managed in the React component
- API calls are cached by React Query with page number as part of the cache key
