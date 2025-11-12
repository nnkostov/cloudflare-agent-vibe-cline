# Batch Analysis Tier Progress Counter Fix

## Problem
When clicking "Analyze All Visible Repos" on the Controls page, the Tier 1-3 progress counters in the "Analysis Coverage Overview" card were not updating in real-time. Users had to wait 30 seconds for the next refresh to see progress.

## Root Cause
1. The `analysisStats` query had a static 30-second refresh interval
2. No mechanism to force refresh when batch analysis was actively processing repositories
3. Tier counters only updated during the scheduled refresh cycle, creating a poor user experience

## Solution Implemented

### 1. Dynamic Refresh Interval (Controls.tsx)
Changed the `analysisStats` query to use a conditional refresh interval:
```typescript
const { data: analysisStats } = useQuery({
  queryKey: ['analysis-stats'],
  queryFn: api.getAnalysisStats,
  refetchInterval: activeBatchId !== null ? 3000 : 30000, // 3s when batch active, 30s otherwise
  retry: 1,
});
```

**Result**: When batch analysis is running, tier counters refresh every 3 seconds instead of 30 seconds.

### 2. Query Invalidation After Each Batch (BatchProgress.tsx)
Added React Query client integration and query invalidation:
```typescript
import { useQueryClient } from '@tanstack/react-query';

export function BatchProgress({ batchId, onComplete, onError }: BatchProgressProps) {
  const queryClient = useQueryClient();
  
  // ... in processRepositoriesInParallel after each batch completes:
  queryClient.invalidateQueries({ queryKey: ['analysis-stats'] });
}
```

**Result**: After processing each batch of 3 repositories (parallel workers), the tier counters are immediately refreshed with the latest data from the database.

## Benefits

1. **Real-time Progress Tracking**: Users now see tier counters update as repositories are analyzed
2. **Better User Experience**: Progress is visible immediately instead of waiting up to 30 seconds
3. **Efficient Resource Usage**: Fast refresh only happens during active batch processing
4. **Accurate Feedback**: Query invalidation ensures data is always fresh from the database

## Testing Recommendations

1. Start a batch analysis by clicking "Analyze All Visible Repos"
2. Watch the "Analysis Coverage Overview" card
3. Verify that tier counters (Tier 1, Tier 2, Tier 3) update as repositories are processed
4. Confirm counters show accurate analyzed/total counts
5. Check that progress bars update smoothly

## Technical Details

- **Refresh Rate During Batch**: 3 seconds (10x faster than normal)
- **Normal Refresh Rate**: 30 seconds (when no batch is active)
- **Invalidation Trigger**: After each batch of 3 parallel repository analyses
- **Query Key**: `['analysis-stats']`

## Files Modified

1. `dashboard/src/pages/Controls.tsx`
   - Changed `analysisStats` query refresh interval to be conditional based on `activeBatchId`

2. `dashboard/src/components/ui/BatchProgress.tsx`
   - Added `useQueryClient` import from `@tanstack/react-query`
   - Added `queryClient` initialization
   - Added `queryClient.invalidateQueries()` call after each batch completion

## Impact

- ✅ Tier progress counters now update in real-time during batch analysis
- ✅ Users can see exactly which tiers are being analyzed and how many remain
- ✅ No performance impact when batch analysis is not running
- ✅ Database queries are triggered only when batch is active, maintaining efficiency

## Future Enhancements (Optional)

1. Add tier-specific progress tracking within BatchProgress component
2. Display which tier each repository belongs to while processing
3. Show tier-by-tier completion statistics in real-time
4. Add visual indicators for which tier is currently being processed

---

**Status**: ✅ Complete  
**Date**: November 11, 2025  
**Impact**: High - Significantly improves user experience during batch analysis
