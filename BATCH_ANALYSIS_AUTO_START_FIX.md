# Batch Analysis Auto-Start Fix

## Issue
The batch analysis was automatically starting when loading the Controls page due to localStorage persistence of the `activeBatchId`.

## Root Cause
The Controls page was storing the `activeBatchId` in localStorage and restoring it on page load. If a batch analysis didn't complete properly or the page was refreshed during analysis, the stored batch ID would trigger the BatchProgress component to start polling automatically.

## Fix Applied

### 1. Removed localStorage Persistence
- Changed `activeBatchId` initialization to always start with `null`
- Removed the `useEffect` that was saving/loading from localStorage
- Batch analysis state is now session-only (not persisted across page loads)

### 2. Created Clear Storage Utility
Created `scripts/utilities/clear-batch-storage.js` with instructions for clearing stuck batch IDs.

## How to Clear Stuck Batch IDs

If you're experiencing auto-starting batch analysis:

### Option 1: Browser Console
1. Open the Controls page
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run: `localStorage.removeItem("activeBatchId")`
5. Refresh the page

### Option 2: Clear Site Data
1. Open DevTools → Application tab
2. Click "Clear site data" under Storage
3. Refresh the page

### Option 3: Run the Utility Script
```bash
node scripts/utilities/clear-batch-storage.js
```

## Expected Behavior After Fix

1. **Page Load**: Controls page loads without starting any batch analysis
2. **Manual Trigger**: Batch analysis only starts when clicking "Analyze All Visible Repos"
3. **No Persistence**: Refreshing the page during batch analysis will not resume it
4. **Clean State**: Each page load starts with a clean state

## Benefits

1. **Predictable Behavior**: Analysis only runs when explicitly triggered
2. **No Surprise Processing**: Won't consume API limits unexpectedly
3. **Clean Sessions**: Each visit to Controls page starts fresh
4. **Better Control**: Users have full control over when analysis runs

## Technical Details

### Before (with localStorage):
```typescript
const [activeBatchId, setActiveBatchId] = useState<string | null>(() => {
  const storedBatchId = localStorage.getItem('activeBatchId');
  return storedBatchId || null;
});

useEffect(() => {
  if (activeBatchId) {
    localStorage.setItem('activeBatchId', activeBatchId);
  } else {
    localStorage.removeItem('activeBatchId');
  }
}, [activeBatchId]);
```

### After (no persistence):
```typescript
const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
```

## Testing

1. Clear any existing localStorage: `localStorage.removeItem("activeBatchId")`
2. Refresh the Controls page
3. Verify no batch analysis starts automatically
4. Click "Analyze All Visible Repos" to verify manual trigger works
5. Refresh during analysis to verify it doesn't resume

The batch analysis system now behaves predictably and only runs when explicitly requested by the user.
